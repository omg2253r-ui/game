import { ListModelsQuerySchema } from '@3d-design/shared';
import { requireUser } from '../../../server/access';
import { json, toModel } from '../../../server/dto';
import { route } from '../../../server/http';
import { getServices } from '../../../server/services';

export const dynamic = 'force-dynamic';

export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const query = ListModelsQuerySchema.parse({
    q: url.searchParams.get('q') || undefined,
    tag: url.searchParams.get('tag') || undefined,
  });
  const { repo } = await getServices();
  const [models, tags] = await Promise.all([
    repo.listModels(user.id, query),
    repo.listTags(user.id),
  ]);
  return json({ models: models.map(toModel), tags });
});
