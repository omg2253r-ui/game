import { sharedModel } from '../../../../../server/access';
import { sendThumbnail } from '../../../../../server/files';
import { route } from '../../../../../server/http';

export const dynamic = 'force-dynamic';

export const GET = route(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) =>
  sendThumbnail(await sharedModel((await ctx.params).slug)),
);
