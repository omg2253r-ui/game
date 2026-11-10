import { getServices } from '../../../server/services';

export async function GET() {
  const { provider, config } = await getServices();
  return Response.json({
    ok: true,
    provider: provider.id,
    database: config.DATABASE_URL ? 'postgres' : 'file',
    queue: config.REDIS_URL ? 'bullmq' : 'inline',
    storage: config.STORAGE_DRIVER,
  });
}
