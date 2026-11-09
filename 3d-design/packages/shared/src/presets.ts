/**
 * Generation presets shared by the API (pricing, provider params) and the UI
 * (labels, confirm dialog). Change numbers here and both sides follow.
 */

export const STYLES = ['realistic', 'low-poly', 'stylized', 'anime', 'voxel'] as const;
export type Style = (typeof STYLES)[number];

export const QUALITIES = ['draft', 'standard', 'high'] as const;
export type Quality = (typeof QUALITIES)[number];

export interface QualityPreset {
  /** Upper bound on triangles the provider is asked to produce. */
  targetTriangles: number;
  /** Texture edge length in pixels requested from providers that texture. */
  textureSize: number;
  /** Credits debited when the job is accepted. Refunded on failure. */
  credits: number;
  /** Rough wall-clock estimate used for the ETA before real progress arrives. */
  etaSeconds: number;
}

export const QUALITY_PRESETS: Record<Quality, QualityPreset> = {
  draft: { targetTriangles: 5_000, textureSize: 1024, credits: 2, etaSeconds: 30 },
  standard: { targetTriangles: 20_000, textureSize: 2048, credits: 5, etaSeconds: 90 },
  high: { targetTriangles: 60_000, textureSize: 4096, credits: 10, etaSeconds: 180 },
};

export const creditCost = (quality: Quality): number => QUALITY_PRESETS[quality].credits;

export const PROMPT_MIN = 3;
export const PROMPT_MAX = 600;
export const NEGATIVE_PROMPT_MAX = 300;
export const SEED_MAX = 2_147_483_647;
export const TAG_MAX = 12;
export const TAG_LENGTH_MAX = 24;
export const MODEL_NAME_MAX = 80;
export const THUMBNAIL_MAX_BYTES = 512 * 1024;
