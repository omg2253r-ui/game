import { requireUser } from '../../../../server/access';
import { json, toJob } from '../../../../server/dto';
import { route } from '../../../../server/http';
import { getServices } from '../../../../server/services';
import { AppError } from '../../../../server/types';

export const dynamic = 'force-dynamic';

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const { repo, queue } = await getServices();
  const job = await repo.getJob(id);
  if (!job || job.userId !== user.id) throw new AppError('not_found', 404);
  return json({ job: toJob(job, await queue.position(id)) });
});
