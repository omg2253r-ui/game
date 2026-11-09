import { QUALITY_PRESETS } from '@3d-design/shared';
import { ProviderError } from '../../pipeline';
import type { GenerationContext, GenerationProvider, JobRecord } from '../../types';
import { downloadGlb, fetchJson, sleep, STYLE_HINT } from './common';

const API = 'https://api.meshy.ai/openapi/v2/text-to-3d';

interface MeshyTask {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'EXPIRED';
  progress: number;
  model_urls?: { glb?: string };
  task_error?: { message?: string };
}

/**
 * Meshy text-to-3D (two-step: untextured preview, then PBR refine).
 * Draft quality stops after the preview. Docs: https://docs.meshy.ai
 */
export class MeshyProvider implements GenerationProvider {
  readonly id = 'meshy';
  constructor(private readonly apiKey: string) {}

  private headers() {
    return { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' };
  }

  async generate(req: JobRecord['request'], ctx: GenerationContext) {
    const preset = QUALITY_PRESETS[req.quality];
    await ctx.onProgress({ stage: 'interpreting', progress: 0.05 });
    const preview = await fetchJson<{ result: string }>(API, {
      method: 'POST',
      headers: this.headers(),
      signal: ctx.signal,
      body: JSON.stringify({
        mode: 'preview',
        prompt: `${req.prompt}, ${STYLE_HINT[req.style]}`.slice(0, 600),
        negative_prompt: req.negativePrompt || undefined,
        art_style: 'realistic',
        seed: req.seed,
        topology: 'triangle',
        target_polycount: preset.targetTriangles,
        should_remesh: true,
      }),
    });
    await ctx.onProgress({ stage: 'shaping', progress: 0.1, providerTaskId: preview.result });
    let task = await this.wait(
      preview.result,
      ctx,
      0.1,
      req.quality === 'draft' ? 0.95 : 0.5,
      'shaping',
    );

    if (req.quality !== 'draft') {
      const refine = await fetchJson<{ result: string }>(API, {
        method: 'POST',
        headers: this.headers(),
        signal: ctx.signal,
        body: JSON.stringify({ mode: 'refine', preview_task_id: preview.result, enable_pbr: true }),
      });
      await ctx.onProgress({ stage: 'texturing', progress: 0.5, providerTaskId: refine.result });
      task = await this.wait(refine.result, ctx, 0.5, 0.95, 'texturing');
    }

    const url = task.model_urls?.glb;
    if (!url) throw new ProviderError('provider_failed', 'meshy returned no glb');
    return { glb: await downloadGlb(url, ctx.signal) };
  }

  private async wait(
    id: string,
    ctx: GenerationContext,
    from: number,
    to: number,
    stage: 'shaping' | 'texturing',
  ) {
    for (;;) {
      const task = await fetchJson<MeshyTask>(`${API}/${id}`, {
        headers: this.headers(),
        signal: ctx.signal,
      });
      if (task.status === 'SUCCEEDED') return task;
      if (task.status === 'FAILED' || task.status === 'CANCELED' || task.status === 'EXPIRED') {
        throw new ProviderError('provider_failed', task.task_error?.message ?? task.status);
      }
      await ctx.onProgress({ stage, progress: from + ((to - from) * (task.progress ?? 0)) / 100 });
      await sleep(3000, ctx.signal);
    }
  }
}
