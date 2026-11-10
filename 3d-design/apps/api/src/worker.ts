/**
 * Standalone queue consumer for BullMQ mode:
 *   REDIS_URL=… DATABASE_URL=… pnpm worker
 * Run as many as you have GPU/API budget for; the API can then set
 * RUN_WORKER_IN_API=false.
 */
import { getConfig } from './server/config';
import { buildServices } from './server/services';

const config = getConfig();
if (!config.REDIS_URL) {
  console.error(
    'REDIS_URL is not set. Without Redis the API process runs jobs itself; no worker needed.',
  );
  process.exit(1);
}
const services = await buildServices(config, { runWorker: true });
console.log(
  `[worker] consuming generations with ${services.provider.id}, concurrency ${config.WORKER_CONCURRENCY}`,
);
