import { z } from 'zod';
import {
  MODEL_NAME_MAX,
  NEGATIVE_PROMPT_MAX,
  PROMPT_MAX,
  PROMPT_MIN,
  QUALITIES,
  SEED_MAX,
  STYLES,
  TAG_LENGTH_MAX,
  TAG_MAX,
} from './presets';

/* ---------- Requests ---------- */

export const GenerateRequestSchema = z.object({
  mode: z.literal('text'),
  prompt: z.string().trim().min(PROMPT_MIN).max(PROMPT_MAX),
  negativePrompt: z.string().trim().max(NEGATIVE_PROMPT_MAX).default(''),
  style: z.enum(STYLES),
  quality: z.enum(QUALITIES),
  /** Omit to let the server pick one; it is returned so the result can be reproduced. */
  seed: z.number().int().min(0).max(SEED_MAX).optional(),
});
export type GenerateRequest = z.input<typeof GenerateRequestSchema>;
export type GenerateRequestParsed = z.output<typeof GenerateRequestSchema>;

const TagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(TAG_LENGTH_MAX)
  .regex(/^[\p{L}\p{M}\p{N} _-]+$/u, 'tag');

export const UpdateModelSchema = z
  .object({
    name: z.string().trim().min(1).max(MODEL_NAME_MAX),
    tags: z
      .array(TagSchema)
      .max(TAG_MAX)
      .transform((t) => [...new Set(t)]),
    isPublic: z.boolean(),
    allowCommercialUse: z.boolean(),
  })
  .partial();
export type UpdateModel = z.input<typeof UpdateModelSchema>;

export const ListModelsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  tag: z.string().trim().toLowerCase().max(TAG_LENGTH_MAX).optional(),
});
export type ListModelsQuery = z.infer<typeof ListModelsQuerySchema>;

/* ---------- Domain objects returned by the API ---------- */

export const JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed'] as const;
export const JOB_STAGES = [
  'queued',
  'interpreting',
  'shaping',
  'texturing',
  'finalizing',
  'done',
] as const;
export type JobStage = (typeof JOB_STAGES)[number];

export const ERROR_CODES = [
  'invalid_request',
  'unauthorized',
  'forbidden',
  'not_found',
  'insufficient_credits',
  'rate_limited',
  'content_copyrighted',
  'content_prohibited',
  'provider_failed',
  'provider_timeout',
  'payload_too_large',
  'unsupported_media_type',
  'internal',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    /** Machine-readable extra context, e.g. the matched term or retry-after seconds. */
    detail: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const JobSchema = z.object({
  id: z.string(),
  status: z.enum(JOB_STATUSES),
  stage: z.enum(JOB_STAGES),
  /** 0..1 */
  progress: z.number().min(0).max(1),
  /** 1-based position among waiting jobs, null once running. */
  queuePosition: z.number().int().nullable(),
  etaSeconds: z.number().int().nullable(),
  request: GenerateRequestSchema.extend({ seed: z.number().int() }),
  creditsCharged: z.number().int(),
  modelId: z.string().nullable(),
  error: z
    .object({
      code: z.enum(ERROR_CODES),
      detail: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    })
    .nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Job = z.infer<typeof JobSchema>;

export const MeshStatsSchema = z.object({
  triangles: z.number().int(),
  vertices: z.number().int(),
  meshes: z.number().int(),
  materials: z.number().int(),
  fileSizeBytes: z.number().int(),
  /** Largest texture edge in px, null if the model uses material factors only. */
  textureMaxSize: z.number().int().nullable(),
  /** Axis-aligned bounds in metres (glTF units). */
  bounds: z.object({ x: z.number(), y: z.number(), z: z.number() }),
});
export type MeshStats = z.infer<typeof MeshStatsSchema>;

export const ModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  prompt: z.string(),
  negativePrompt: z.string(),
  style: z.enum(STYLES),
  quality: z.enum(QUALITIES),
  seed: z.number().int(),
  provider: z.string(),
  stats: MeshStatsSchema,
  tags: z.array(z.string()),
  isPublic: z.boolean(),
  allowCommercialUse: z.boolean(),
  shareSlug: z.string().nullable(),
  hasThumbnail: z.boolean(),
  createdAt: z.string(),
});
export type Model = z.infer<typeof ModelSchema>;

export const MeSchema = z.object({
  userId: z.string(),
  isGuest: z.boolean(),
  credits: z.number().int(),
});
export type Me = z.infer<typeof MeSchema>;

export const CreateJobResponseSchema = z.object({ job: JobSchema, credits: z.number().int() });
export const JobResponseSchema = z.object({ job: JobSchema });
export const ModelResponseSchema = z.object({ model: ModelSchema });
export const ModelListResponseSchema = z.object({
  models: z.array(ModelSchema),
  tags: z.array(z.string()),
});
export const SharedModelResponseSchema = z.object({
  model: ModelSchema.pick({
    id: true,
    name: true,
    style: true,
    stats: true,
    allowCommercialUse: true,
    hasThumbnail: true,
    createdAt: true,
  }),
});
export type SharedModel = z.infer<typeof SharedModelResponseSchema>['model'];
