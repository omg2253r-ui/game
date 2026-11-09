import type {
  ErrorCode,
  GenerateRequestParsed,
  JobStage,
  MeshStats,
  Quality,
  Style,
} from '@3d-design/shared';

export interface UserRecord {
  id: string;
  credits: number;
  isGuest: boolean;
  createdAt: string;
}

export interface JobRecord {
  id: string;
  userId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  stage: JobStage;
  progress: number;
  request: GenerateRequestParsed & { seed: number };
  creditsCharged: number;
  provider: string;
  providerTaskId: string | null;
  modelId: string | null;
  errorCode: ErrorCode | null;
  errorDetail: Record<string, string | number> | null;
  startedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModelRecord {
  id: string;
  userId: string;
  jobId: string;
  name: string;
  prompt: string;
  negativePrompt: string;
  style: Style;
  quality: Quality;
  seed: number;
  provider: string;
  fileKey: string;
  thumbnailKey: string | null;
  stats: MeshStats;
  tags: string[];
  isPublic: boolean;
  allowCommercialUse: boolean;
  shareSlug: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export type CreditReason = 'starter_grant' | 'generation' | 'refund';

export interface Repository {
  getUser(id: string): Promise<UserRecord | null>;
  createUser(id: string, starterCredits: number): Promise<UserRecord>;
  /**
   * Atomically applies `delta` to the balance and writes a ledger row.
   * Returns the new balance, or null if the balance would go negative.
   */
  adjustCredits(
    userId: string,
    delta: number,
    reason: CreditReason,
    refId: string,
  ): Promise<number | null>;

  createJob(job: JobRecord): Promise<void>;
  updateJob(id: string, patch: Partial<Omit<JobRecord, 'id' | 'userId'>>): Promise<JobRecord>;
  getJob(id: string): Promise<JobRecord | null>;
  /** Jobs in queued/running state, oldest first. */
  listUnfinishedJobs(): Promise<JobRecord[]>;

  createModel(model: ModelRecord): Promise<void>;
  getModel(id: string): Promise<ModelRecord | null>;
  getModelByShareSlug(slug: string): Promise<ModelRecord | null>;
  listModels(userId: string, filter: { q?: string; tag?: string }): Promise<ModelRecord[]>;
  listTags(userId: string): Promise<string[]>;
  updateModel(id: string, patch: Partial<Omit<ModelRecord, 'id' | 'userId'>>): Promise<ModelRecord>;
}

export interface StoredObject {
  body: Uint8Array;
  contentType: string;
}

export interface Storage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  /** Short-lived direct download URL, when the backend supports it. */
  signedUrl?(key: string, filename: string, expiresSeconds: number): Promise<string>;
}

export interface JobQueue {
  enqueue(jobId: string): Promise<void>;
  /** 1-based position among waiting jobs; null if running or unknown. */
  position(jobId: string): Promise<number | null>;
  close(): Promise<void>;
}

export interface ProgressUpdate {
  stage: JobStage;
  progress: number;
  providerTaskId?: string;
}

export interface GenerationContext {
  onProgress(update: ProgressUpdate): void | Promise<void>;
  signal: AbortSignal;
}

export interface GenerationOutput {
  /** Binary glTF. Post-processing (licence, stats) happens outside the provider. */
  glb: Uint8Array;
}

/** Adapter boundary: every text-to-3D vendor implements this and nothing else. */
export interface GenerationProvider {
  readonly id: string;
  generate(request: JobRecord['request'], ctx: GenerationContext): Promise<GenerationOutput>;
}

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    public readonly detail?: Record<string, string | number>,
  ) {
    super(code);
  }
}
