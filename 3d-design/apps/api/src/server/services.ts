import path from 'node:path';
import { getConfig, type Config } from './config';
import { MemoryRepository } from './db/memory';
import { PostgresRepository } from './db/postgres';
import { runGeneration } from './pipeline';
import { createProvider } from './providers';
import { BullQueue, startBullWorker } from './queue/bullmq';
import { InlineQueue } from './queue/inline';
import { MemoryRateLimiter, RedisRateLimiter, type RateLimiter } from './ratelimit';
import { LocalStorage } from './storage/local';
import { S3Storage } from './storage/s3';
import type { GenerationProvider, JobQueue, Repository, Storage } from './types';

export interface Services {
  config: Config;
  repo: Repository;
  storage: Storage;
  queue: JobQueue;
  provider: GenerationProvider;
  rateLimiter: RateLimiter;
}

export interface BuildOptions {
  /** Start a queue consumer in this process. False for API-only replicas. */
  runWorker: boolean;
}

export async function buildServices(config: Config, opts: BuildOptions): Promise<Services> {
  const repo: Repository = config.DATABASE_URL
    ? new PostgresRepository(config.DATABASE_URL)
    : new MemoryRepository(path.join(config.dataDir, 'db.json'));

  const storage: Storage =
    config.STORAGE_DRIVER === 's3'
      ? new S3Storage({
          endpoint: config.S3_ENDPOINT!,
          region: config.S3_REGION,
          bucket: config.S3_BUCKET!,
          accessKeyId: config.S3_ACCESS_KEY_ID!,
          secretAccessKey: config.S3_SECRET_ACCESS_KEY!,
        })
      : new LocalStorage(path.join(config.dataDir, 'storage'));

  const provider = createProvider(config);
  const rateLimiter = config.REDIS_URL
    ? new RedisRateLimiter(config.REDIS_URL)
    : new MemoryRateLimiter();

  // The queue needs `services` to run jobs, and `services` needs the queue:
  // the closure reads `services` only when a job runs, after it is assigned below.
  const process = (jobId: string) => runGeneration(services, jobId);
  let queue: JobQueue;
  if (config.REDIS_URL) {
    queue = new BullQueue(config.REDIS_URL);
    if (opts.runWorker) startBullWorker(config.REDIS_URL, config.WORKER_CONCURRENCY, process);
  } else {
    queue = new InlineQueue(config.WORKER_CONCURRENCY, process);
  }
  const services: Services = { config, repo, storage, provider, rateLimiter, queue };

  // Recover jobs interrupted by a restart: queued ones go back in line,
  // running ones restart from scratch (providers are idempotent per seed).
  if (opts.runWorker || !config.REDIS_URL) {
    for (const job of await repo.listUnfinishedJobs()) {
      if (job.status === 'running')
        await repo.updateJob(job.id, { status: 'queued', stage: 'queued', progress: 0 });
      await services.queue.enqueue(job.id);
    }
  }
  return services;
}

const g = globalThis as unknown as { __services?: Promise<Services> };

/** Process-wide singleton (survives Next.js dev hot reloads). */
export function getServices(): Promise<Services> {
  if (!g.__services) {
    const config = getConfig();
    g.__services = buildServices(config, { runWorker: config.RUN_WORKER_IN_API });
    g.__services.catch(() => {
      g.__services = undefined;
    });
  }
  return g.__services;
}
