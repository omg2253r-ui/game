import {
  ApiErrorSchema,
  CreateJobResponseSchema,
  JobResponseSchema,
  MeSchema,
  ModelListResponseSchema,
  ModelResponseSchema,
  SharedModelResponseSchema,
  type ErrorCode,
  type GenerateRequest,
  type Job,
  type ListModelsQuery,
  type UpdateModel,
} from '@3d-design/shared';
import type { ZodType } from 'zod';

export class ApiRequestError extends Error {
  constructor(
    public readonly code: ErrorCode | 'network',
    public readonly status: number,
    public readonly detail: Record<string, string | number> = {},
  ) {
    super(code);
  }
}

async function request<T>(
  schema: ZodType<T> | null,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body && typeof init.body === 'string' && { 'Content-Type': 'application/json' }),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiRequestError('network', 0);
  }
  if (!res.ok) {
    const parsed = ApiErrorSchema.safeParse(await res.json().catch(() => null));
    if (parsed.success) {
      throw new ApiRequestError(parsed.data.error.code, res.status, parsed.data.error.detail);
    }
    throw new ApiRequestError('internal', res.status);
  }
  if (!schema || res.status === 204) return undefined as T;
  // Validate responses with the same schemas the server uses: drift fails loudly.
  return schema.parse(await res.json());
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  me: () => request(MeSchema, '/api/me'),

  generate: (body: GenerateRequest & { requestId: string }) =>
    request(CreateJobResponseSchema, '/api/generations', { method: 'POST', body: json(body) }),

  job: (id: string) => request(JobResponseSchema, `/api/generations/${id}`),

  models: (q: ListModelsQuery) => {
    const params = new URLSearchParams();
    if (q.q) params.set('q', q.q);
    if (q.tag) params.set('tag', q.tag);
    const qs = params.toString();
    return request(ModelListResponseSchema, `/api/models${qs ? `?${qs}` : ''}`);
  },

  model: (id: string) => request(ModelResponseSchema, `/api/models/${id}`),

  updateModel: (id: string, patch: UpdateModel) =>
    request(ModelResponseSchema, `/api/models/${id}`, { method: 'PATCH', body: json(patch) }),

  deleteModel: (id: string) => request(null, `/api/models/${id}`, { method: 'DELETE' }),

  uploadThumbnail: (id: string, blob: Blob) =>
    request(null, `/api/models/${id}/thumbnail`, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': blob.type },
    }),

  shared: (slug: string) => request(SharedModelResponseSchema, `/api/share/${slug}`),

  fileUrl: (id: string) => `/api/models/${id}/file`,
  thumbnailUrl: (id: string, bust?: string) =>
    `/api/models/${id}/thumbnail${bust ? `?v=${bust}` : ''}`,
  sharedFileUrl: (slug: string) => `/api/share/${slug}/file`,
  sharedThumbnailUrl: (slug: string) => `/api/share/${slug}/thumbnail`,
  shareLink: (slug: string) => `${location.origin}/s/${slug}`,
};

/**
 * Live job updates over Server-Sent Events, falling back to polling if the
 * stream cannot be opened (some proxies buffer SSE). Returns an unsubscribe.
 */
export function watchJob(id: string, onJob: (job: Job) => void): () => void {
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const done = (j: Job) => j.status === 'succeeded' || j.status === 'failed';

  const poll = async () => {
    if (closed) return;
    try {
      const { job } = await api.job(id);
      onJob(job);
      if (done(job)) return;
    } catch {
      /* transient; keep polling */
    }
    timer = setTimeout(poll, 1500);
  };

  const source =
    typeof EventSource !== 'undefined' ? new EventSource(`/api/generations/${id}/events`) : null;
  if (!source) void poll();
  else {
    source.onmessage = (e) => {
      const parsed = JobResponseSchema.safeParse(JSON.parse(e.data as string));
      if (!parsed.success) return;
      onJob(parsed.data.job);
      if (done(parsed.data.job)) source.close();
    };
    source.onerror = () => {
      // Stream ended or failed: switch to polling, which stops on a terminal state.
      source.close();
      if (!closed) void poll();
    };
  }
  return () => {
    closed = true;
    source?.close();
    if (timer) clearTimeout(timer);
  };
}

/** Download via fetch so errors surface as messages, not a broken tab. */
export async function downloadFile(url: string, fallbackName: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: 'same-origin' });
  } catch {
    // Cross-origin signed URLs (S3/R2) without CORS: let the browser handle it.
    window.location.assign(url);
    return;
  }
  if (!res.ok) {
    const parsed = ApiErrorSchema.safeParse(await res.json().catch(() => null));
    throw new ApiRequestError(parsed.success ? parsed.data.error.code : 'internal', res.status);
  }
  const blob = await res.blob();
  // The server's ASCII name is the one asset pipelines handle everywhere.
  const cd = res.headers.get('content-disposition') ?? '';
  const name = /filename="([^"]+)"/i.exec(cd)?.[1] ?? fallbackName;
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
