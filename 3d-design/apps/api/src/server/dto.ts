import type { Job, Model } from '@3d-design/shared';
import { NextResponse } from 'next/server';
import { etaSeconds } from './pipeline';
import type { JobRecord, ModelRecord } from './types';

export function toJob(r: JobRecord, queuePosition: number | null): Job {
  return {
    id: r.id,
    status: r.status,
    stage: r.stage,
    progress: r.progress,
    queuePosition: r.status === 'queued' ? queuePosition : null,
    etaSeconds: etaSeconds(r, queuePosition),
    request: r.request,
    creditsCharged: r.creditsCharged,
    modelId: r.modelId,
    error: r.errorCode
      ? { code: r.errorCode, ...(r.errorDetail && { detail: r.errorDetail }) }
      : null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export function toModel(r: ModelRecord): Model {
  return {
    id: r.id,
    name: r.name,
    prompt: r.prompt,
    negativePrompt: r.negativePrompt,
    style: r.style,
    quality: r.quality,
    seed: r.seed,
    provider: r.provider,
    stats: r.stats,
    tags: r.tags,
    isPublic: r.isPublic,
    allowCommercialUse: r.allowCommercialUse,
    shareSlug: r.isPublic ? r.shareSlug : null,
    hasThumbnail: Boolean(r.thumbnailKey),
    createdAt: r.createdAt,
  };
}

export const json = <T>(body: T, init: ResponseInit = {}) =>
  NextResponse.json(body, {
    ...init,
    headers: { 'Cache-Control': 'no-store', ...(init.headers as Record<string, string>) },
  });
