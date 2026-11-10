import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import type { JobQueue } from '../types';

export const QUEUE_NAME = 'generations';

const connection = (url: string) => new IORedis(url, { maxRetriesPerRequest: null });

export class BullQueue implements JobQueue {
  private readonly queue: Queue;

  constructor(redisUrl: string) {
    this.queue = new Queue(QUEUE_NAME, { connection: connection(redisUrl) });
  }

  async enqueue(jobId: string) {
    // jobId doubles as the BullMQ id, so re-enqueueing after a restart is idempotent.
    await this.queue.add(
      'generate',
      { jobId },
      { jobId, removeOnComplete: 1000, removeOnFail: 1000, attempts: 1 },
    );
  }

  async position(jobId: string) {
    const waiting = await this.queue.getWaiting(0, 500);
    // getWaiting returns newest first.
    const ids = waiting.map((j) => j.id).reverse();
    const i = ids.indexOf(jobId);
    return i === -1 ? null : i + 1;
  }

  async close() {
    await this.queue.close();
  }
}

export function startBullWorker(
  redisUrl: string,
  concurrency: number,
  process: (jobId: string) => Promise<void>,
): Worker {
  const worker = new Worker<{ jobId: string }>(QUEUE_NAME, async (job) => process(job.data.jobId), {
    connection: connection(redisUrl),
    concurrency,
  });
  worker.on('failed', (job, err) => console.error(`[worker] job ${job?.id} failed`, err));
  return worker;
}
