import { licenseNotice, QUALITY_PRESETS, type ErrorCode } from '@3d-design/shared';
import { finaliseGlb } from './gltf';
import { newId } from './ids';
import type { Services } from './services';
import { AppError, type JobRecord, type ModelRecord } from './types';

export class ProviderError extends Error {
  constructor(
    public readonly code: Extract<ErrorCode, 'provider_failed' | 'provider_timeout'>,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Short human name from the prompt: the first clause. Thai writes clauses
 * separated by spaces, so for Thai text the first space-delimited phrase is
 * the object ("ดาบเวทย์ ใบดาบเหล็ก…" → "ดาบเวทย์").
 */
export function nameFromPrompt(prompt: string): string {
  let first =
    prompt.split(/[,.\n;:]|\s(?:with|and|that|made of)\s|และ|ที่มี/i)[0]!.trim() || prompt.trim();
  if (/[\u0E00-\u0E7F]/.test(first) && first.includes(' ')) first = first.split(/\s+/)[0]!;
  first = first.replace(/^(a|an|the)\s+/i, '');
  first = first.charAt(0).toUpperCase() + first.slice(1);
  return first.length > 48 ? `${first.slice(0, 47)}…` : first;
}

export function etaSeconds(job: JobRecord, queuePosition: number | null): number | null {
  if (job.status === 'succeeded' || job.status === 'failed') return null;
  const total = QUALITY_PRESETS[job.request.quality].etaSeconds;
  if (job.status === 'queued') return total * ((queuePosition ?? 1) - 1) + total;
  if (!job.startedAt) return total;
  const elapsed = (Date.now() - Date.parse(job.startedAt)) / 1000;
  // Blend the preset estimate with what progress implies, once there is some.
  const projected = job.progress > 0.1 ? elapsed / job.progress : total;
  return Math.max(1, Math.round(projected - elapsed));
}

/** Runs one job to completion. Never throws: failures are recorded and refunded. */
export async function runGeneration(services: Services, jobId: string): Promise<void> {
  const { repo, storage, provider, config } = services;
  const job = await repo.getJob(jobId);
  if (!job || job.status === 'succeeded' || job.status === 'failed') return;

  await repo.updateJob(jobId, {
    status: 'running',
    stage: 'interpreting',
    progress: Math.max(job.progress, 0.02),
    startedAt: new Date().toISOString(),
  });

  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), config.PROVIDER_TIMEOUT_SECONDS * 1000);
  let lastWrite = 0;

  try {
    const out = await provider.generate(job.request, {
      signal: abort.signal,
      onProgress: async (u) => {
        const now = Date.now();
        if (now - lastWrite < 250 && u.progress < 1) return; // throttle DB writes
        lastWrite = now;
        await repo.updateJob(jobId, {
          stage: u.stage,
          progress: Math.min(0.97, u.progress),
          ...(u.providerTaskId && { providerTaskId: u.providerTaskId }),
        });
      },
    });

    await repo.updateJob(jobId, { stage: 'finalizing', progress: 0.98 });
    const modelId = newId('mdl');
    const createdAt = new Date().toISOString();
    const license = licenseNotice({
      modelId,
      ownerId: job.userId,
      createdAt,
      provider: provider.id,
      allowCommercialUse: false,
    });
    const { glb, stats } = await finaliseGlb(out.glb, {
      license,
      generator: `3D Design (${provider.id})`,
      modelId,
    });
    const fileKey = `models/${job.userId}/${modelId}.glb`;
    await storage.put(fileKey, glb, 'model/gltf-binary');

    const model: ModelRecord = {
      id: modelId,
      userId: job.userId,
      jobId,
      name: nameFromPrompt(job.request.prompt),
      prompt: job.request.prompt,
      negativePrompt: job.request.negativePrompt,
      style: job.request.style,
      quality: job.request.quality,
      seed: job.request.seed,
      provider: provider.id,
      fileKey,
      thumbnailKey: null,
      stats,
      tags: [],
      isPublic: false,
      allowCommercialUse: false,
      shareSlug: null,
      createdAt,
      deletedAt: null,
    };
    await repo.createModel(model);
    await repo.updateJob(jobId, { status: 'succeeded', stage: 'done', progress: 1, modelId });
  } catch (e) {
    const code: ErrorCode = abort.signal.aborted
      ? 'provider_timeout'
      : e instanceof ProviderError
        ? e.code
        : e instanceof AppError
          ? e.code
          : 'provider_failed';
    console.error(`[pipeline] job ${jobId} failed (${code})`, e);
    await repo.updateJob(jobId, { status: 'failed', errorCode: code, errorDetail: null });
    if (job.creditsCharged > 0) {
      await repo.adjustCredits(job.userId, job.creditsCharged, 'refund', jobId);
    }
  } finally {
    clearTimeout(timeout);
  }
}
