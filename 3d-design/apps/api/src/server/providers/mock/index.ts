import type { GenerationContext, GenerationProvider, JobRecord } from '../../types';
import { BUILDERS } from './archetypes';
import { interpret } from './interpret';
import { makeCtx } from './parts';
import { partsToGlb } from './glb';
import { voxelize } from './voxelize';

const BASE_MS = { draft: 3000, standard: 6000, high: 10000 } as const;
const VOXEL_RES = { draft: 16, standard: 26, high: 40 } as const;

/**
 * Offline stand-in for a real text-to-3D model. It reads a few keywords
 * (object, colour, material, mood) and builds a seeded procedural mesh, so
 * the whole product — queue, progress, viewer, export — works without an API
 * key. It is not AI; the UI labels results from this provider as samples.
 */
export class MockProvider implements GenerationProvider {
  readonly id = 'mock';
  constructor(private readonly delayScale: number) {}

  async generate(request: JobRecord['request'], ctx: GenerationContext) {
    const total = BASE_MS[request.quality] * this.delayScale;
    await this.tick(ctx, 'interpreting', 0.03, 0.15, total * 0.15);
    const interp = interpret(
      request.prompt,
      request.negativePrompt,
      request.style,
      request.quality,
    );

    await this.tick(ctx, 'shaping', 0.15, 0.6, total * 0.45);
    let parts = BUILDERS[interp.archetype](makeCtx(interp, request.seed));
    if (request.style === 'voxel') parts = voxelize(parts, VOXEL_RES[request.quality]);

    await this.tick(ctx, 'texturing', 0.6, 0.95, total * 0.4);
    const glb = await partsToGlb(parts, request.style, interp.archetype);
    return { glb };
  }

  private async tick(
    ctx: GenerationContext,
    stage: 'interpreting' | 'shaping' | 'texturing',
    from: number,
    to: number,
    ms: number,
  ) {
    const steps = Math.max(1, Math.round(ms / 200));
    for (let s = 0; s <= steps; s++) {
      if (ctx.signal.aborted) throw new Error('aborted');
      await ctx.onProgress({ stage, progress: from + ((to - from) * s) / steps });
      if (ms > 0 && s < steps) await new Promise((r) => setTimeout(r, ms / steps));
    }
  }
}
