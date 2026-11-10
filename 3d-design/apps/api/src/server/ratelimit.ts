import IORedis from 'ioredis';

export interface RateLimiter {
  /** Returns seconds until the window resets when over the limit, else 0. */
  hit(key: string, limit: number, windowSeconds: number): Promise<number>;
}

/** Fixed-window counter. Good enough for abuse prevention on one node. */
export class MemoryRateLimiter implements RateLimiter {
  private windows = new Map<string, { count: number; resetAt: number }>();

  async hit(key: string, limit: number, windowSeconds: number) {
    const now = Date.now();
    let w = this.windows.get(key);
    if (!w || w.resetAt <= now) {
      w = { count: 0, resetAt: now + windowSeconds * 1000 };
      this.windows.set(key, w);
      if (this.windows.size > 10_000) this.sweep(now);
    }
    w.count += 1;
    return w.count > limit ? Math.ceil((w.resetAt - now) / 1000) : 0;
  }

  private sweep(now: number) {
    for (const [k, w] of this.windows) if (w.resetAt <= now) this.windows.delete(k);
  }
}

/** Shared across API instances. */
export class RedisRateLimiter implements RateLimiter {
  private readonly redis: IORedis;
  constructor(url: string) {
    this.redis = new IORedis(url, { maxRetriesPerRequest: 2 });
  }

  async hit(key: string, limit: number, windowSeconds: number) {
    const k = `rl:${key}`;
    const [[, count], [, ttl]] = (await this.redis.multi().incr(k).pttl(k).exec()) as [
      [null, number],
      [null, number],
    ];
    if (ttl < 0) await this.redis.pexpire(k, windowSeconds * 1000);
    return count > limit ? Math.ceil(Math.max(ttl, 1000) / 1000) : 0;
  }
}
