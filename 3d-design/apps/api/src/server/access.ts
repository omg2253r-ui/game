import { currentUser } from './session';
import { getServices } from './services';
import { AppError, type ModelRecord, type UserRecord } from './types';

export async function requireUser(): Promise<UserRecord> {
  const user = await currentUser({ create: false });
  if (!user) throw new AppError('unauthorized', 401);
  return user;
}

/** Owner-only access. Other users get 404, not 403, so ids are not probeable. */
export async function ownModel(id: string): Promise<{ user: UserRecord; model: ModelRecord }> {
  const user = await requireUser();
  const { repo } = await getServices();
  const model = await repo.getModel(id);
  if (!model || model.userId !== user.id) throw new AppError('not_found', 404);
  return { user, model };
}

export async function sharedModel(slug: string): Promise<ModelRecord> {
  const { repo } = await getServices();
  const model = await repo.getModelByShareSlug(slug);
  if (!model || !model.isPublic) throw new AppError('not_found', 404);
  return model;
}

/**
 * ASCII file name for asset pipelines (some importers and CI tools choke on
 * non-ASCII paths), plus the RFC 5987 UTF-8 name for browsers that want it.
 * The short id suffix keeps two "ดาบ" downloads from overwriting each other.
 */
export function downloadName(name: string, id: string, ext: string): string {
  const ascii = name
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 40);
  return `${ascii || 'model'}-${id.slice(-6)}.${ext}`;
}

export function attachmentHeader(name: string, id: string, ext: string): string {
  return `attachment; filename="${downloadName(name, id, ext)}"; filename*=UTF-8''${encodeURIComponent(name)}.${ext}`;
}
