import { ownModel } from '../../../../../server/access';
import { sendModelFile } from '../../../../../server/files';
import { route } from '../../../../../server/http';

export const dynamic = 'force-dynamic';

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { model } = await ownModel((await ctx.params).id);
  return sendModelFile(model);
});
