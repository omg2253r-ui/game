import { QUALITY_PRESETS } from '@3d-design/shared';
import { ProviderError } from '../../pipeline';
import type { GenerationContext, GenerationProvider, JobRecord } from '../../types';
import { downloadGlb, fetchJson, sleep, STYLE_HINT } from './common';

const API = 'https://api.tripo3d.ai/v2/openapi/task';

interface TripoEnvelope<T> {
  code: number;
  data: T;
  message?: string;
}
interface TripoTask {
  task_id: string;
  status:
    'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'unknown' | 'banned' | 'expired';
  progress: number;
  output?: { model?: string; pbr_model?: string; base_model?: string };
}

/** Tripo text_to_model task. Docs: https://platform.tripo3d.ai/docs */
export class TripoProvider implements GenerationProvider {
  readonly id = 'tripo';
  constructor(private readonly apiKey: string) {}

  private headers() {
    return { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' };
  }

  async generate(req: JobRecord['request'], ctx: GenerationContext) {
    const preset = QUALITY_PRESETS[req.quality];
    await ctx.onProgress({ stage: 'interpreting', progress: 0.05 });
    const created = await fetchJson<TripoEnvelope<{ task_id: string }>>(API, {
      method: 'POST',
      headers: this.headers(),
      signal: ctx.signal,
      body: JSON.stringify({
        type: 'text_to_model',
        prompt: `${req.prompt}, ${STYLE_HINT[req.style]}`.slice(0, 1024),
        negative_prompt: req.negativePrompt || undefined,
        model_seed: req.seed,
        face_limit: preset.targetTriangles,
        texture: req.quality !== 'draft',
        pbr: req.quality !== 'draft',
        texture_quality: req.quality === 'high' ? 'detailed' : 'standard',
      }),
    });
    if (created.code !== 0)
      throw new ProviderError('provider_failed', created.message ?? `code ${created.code}`);
    const id = created.data.task_id;
    await ctx.onProgress({ stage: 'shaping', progress: 0.1, providerTaskId: id });

    for (;;) {
      const r = await fetchJson<TripoEnvelope<TripoTask>>(`${API}/${id}`, {
        headers: this.headers(),
        signal: ctx.signal,
      });
      const t = r.data;
      if (t.status === 'success') {
        const url = t.output?.pbr_model ?? t.output?.model ?? t.output?.base_model;
        if (!url) throw new ProviderError('provider_failed', 'tripo returned no model');
        return { glb: await downloadGlb(url, ctx.signal) };
      }
      if (['failed', 'cancelled', 'banned', 'expired', 'unknown'].includes(t.status)) {
        throw new ProviderError('provider_failed', `tripo status ${t.status}`);
      }
      const p = (t.progress ?? 0) / 100;
      await ctx.onProgress({ stage: p < 0.6 ? 'shaping' : 'texturing', progress: 0.1 + p * 0.85 });
      await sleep(3000, ctx.signal);
    }
  }
}
