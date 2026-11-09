import { UpdateModelSchema } from '@3d-design/shared';
import { ownModel } from '../../../../server/access';
import { json, toModel } from '../../../../server/dto';
import { restampLicense } from '../../../../server/files';
import { assertSameOrigin, readJson, route } from '../../../../server/http';
import { newId } from '../../../../server/ids';
import { getServices } from '../../../../server/services';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { model } = await ownModel((await ctx.params).id);
  return json({ model: toModel(model) });
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { model } = await ownModel((await ctx.params).id);
  const patch = await readJson(req, UpdateModelSchema);
  const { repo } = await getServices();
  const next: Parameters<typeof repo.updateModel>[1] = { ...patch };
  if (patch.isPublic === true && !model.shareSlug) next.shareSlug = newId('s', 10).slice(2);
  // Turning sharing off kills the old link instead of leaving it guessable later.
  if (patch.isPublic === false) next.shareSlug = null;
  let updated = await repo.updateModel(model.id, next);
  if (
    patch.allowCommercialUse !== undefined &&
    patch.allowCommercialUse !== model.allowCommercialUse
  ) {
    updated = await repo.updateModel(model.id, { stats: await restampLicense(updated) });
  }
  return json({ model: toModel(updated) });
});

export const DELETE = route(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { model } = await ownModel((await ctx.params).id);
  const { repo, storage } = await getServices();
  await repo.updateModel(model.id, {
    deletedAt: new Date().toISOString(),
    isPublic: false,
    shareSlug: null,
  });
  await Promise.all([
    storage.delete(model.fileKey),
    model.thumbnailKey ? storage.delete(model.thumbnailKey) : Promise.resolve(),
  ]);
  return new Response(null, { status: 204 });
});
