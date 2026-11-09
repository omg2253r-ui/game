import type { MeshStats } from './schemas';

export type Engine = 'unity' | 'unreal' | 'godot' | 'roblox';
export type CompatLevel = 'ready' | 'needs-step' | 'over-limit';

export interface EngineCompat {
  engine: Engine;
  level: CompatLevel;
  /** i18n key for the one-line explanation shown under the engine name. */
  noteKey:
    | 'compat.unity.gltfast'
    | 'compat.unreal.ready'
    | 'compat.godot.ready'
    | 'compat.roblox.ready'
    | 'compat.roblox.tooMany'
    | 'compat.mobile.heavy';
  /** Values interpolated into the note. */
  vars?: Record<string, number>;
}

/** Roblox rejects a MeshPart above this many triangles. */
export const ROBLOX_MAX_TRIANGLES = 20_000;
/** Above this we warn that the asset is heavy for mobile game targets. */
export const MOBILE_HEAVY_TRIANGLES = 100_000;

/**
 * GLB compatibility per engine. Rules are intentionally conservative and kept
 * in one place so they are easy to update when engines change their importers.
 */
export function engineCompatibility(stats: Pick<MeshStats, 'triangles'>): EngineCompat[] {
  const heavy = stats.triangles > MOBILE_HEAVY_TRIANGLES;
  return [
    heavy
      ? { engine: 'unity', level: 'needs-step', noteKey: 'compat.mobile.heavy' }
      : { engine: 'unity', level: 'needs-step', noteKey: 'compat.unity.gltfast' },
    { engine: 'unreal', level: 'ready', noteKey: 'compat.unreal.ready' },
    { engine: 'godot', level: 'ready', noteKey: 'compat.godot.ready' },
    stats.triangles > ROBLOX_MAX_TRIANGLES
      ? {
          engine: 'roblox',
          level: 'over-limit',
          noteKey: 'compat.roblox.tooMany',
          vars: { max: ROBLOX_MAX_TRIANGLES },
        }
      : {
          engine: 'roblox',
          level: 'ready',
          noteKey: 'compat.roblox.ready',
          vars: { max: ROBLOX_MAX_TRIANGLES },
        },
  ];
}
