import { sharedModel } from '../../../../server/access';
import { json, toModel } from '../../../../server/dto';
import { route } from '../../../../server/http';

export const dynamic = 'force-dynamic';

/** Public view of a shared model: no prompt, seed or owner id. */
export const GET = route(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const m = toModel(await sharedModel((await ctx.params).slug));
  return json({
    model: {
      id: m.id,
      name: m.name,
      style: m.style,
      stats: m.stats,
      allowCommercialUse: m.allowCommercialUse,
      hasThumbnail: m.hasThumbnail,
      createdAt: m.createdAt,
    },
  });
});
