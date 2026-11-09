import type { JobQueue } from '../types';

/**
 * In-process FIFO used when REDIS_URL is not set. Jobs survive a restart
 * because the services container re-enqueues unfinished jobs from the DB.
 */
export class InlineQueue implements JobQueue {
  private waiting: string[] = [];
  private running = new Set<string>();

  constructor(
    private readonly concurrency: number,
    private readonly process: (jobId: string) => Promise<void>,
  ) {}

  async enqueue(jobId: string) {
    if (this.waiting.includes(jobId) || this.running.has(jobId)) return;
    this.waiting.push(jobId);
    this.pump();
  }

  async position(jobId: string) {
    const i = this.waiting.indexOf(jobId);
    return i === -1 ? null : i + 1;
  }

  private pump() {
    while (this.running.size < this.concurrency && this.waiting.length > 0) {
      const id = this.waiting.shift()!;
      this.running.add(id);
      void this.process(id)
        .catch((e) => console.error(`[queue] job ${id} crashed`, e))
        .finally(() => {
          this.running.delete(id);
          this.pump();
        });
    }
  }

  async close() {
    this.waiting = [];
  }
}
