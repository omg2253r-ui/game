import { THUMBNAIL_MAX_BYTES } from '@3d-design/shared';
import { ownModel } from '../../../../../server/access';
import { sendThumbnail, sniffImage } from '../../../../../server/files';
import { assertSameOrigin, route } from '../../../../../server/http';
import { getServices } from '../../../../../server/services';
import { AppError } from '../../../../../server/types';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { model } = await ownModel((await ctx.params).id);
  return sendThumbnail(model);
});

/** The browser renders the thumbnail from the viewer canvas and uploads it once. */
export const PUT = route(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { model, user } = await ownModel((await ctx.params).id);
  const { storage, repo, rateLimiter } = await getServices();
  const retryAfter = await rateLimiter.hit(`thumb:${user.id}`, 30, 60);
  if (retryAfter > 0) throw new AppError('rate_limited', 429, { retryAfter });

  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > THUMBNAIL_MAX_BYTES)
    throw new AppError('payload_too_large', 413, { maxBytes: THUMBNAIL_MAX_BYTES });
  const body = new Uint8Array(await req.arrayBuffer());
  const sig = sniffImage(body, req.headers.get('content-type'));
  const key = `thumbs/${model.userId}/${model.id}.${sig.ext}`;
  if (model.thumbnailKey && model.thumbnailKey !== key) await storage.delete(model.thumbnailKey);
  await storage.put(key, body, sig.type);
  await repo.updateModel(model.id, { thumbnailKey: key });
  return new Response(null, { status: 204 });
});
