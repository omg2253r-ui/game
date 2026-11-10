import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRepository } from './db/memory';
import { sniffImage } from './files';
import { nameFromPrompt, runGeneration } from './pipeline';
import { InlineQueue } from './queue/inline';
import { MemoryRateLimiter } from './ratelimit';
import { sessionToken, verifySessionToken } from './session';
import type { Services } from './services';
import { LocalStorage } from './storage/local';
import { AppError, type GenerationProvider, type JobRecord } from './types';
import { MockProvider } from './providers/mock';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'd3-test-'));

describe('session tokens', () => {
  const secret = 'x'.repeat(40);
  it('round-trips and rejects tampering', () => {
    const token = sessionToken('usr_abc', secret);
    expect(verifySessionToken(token, secret)).toBe('usr_abc');
    expect(verifySessionToken(token.replace('usr_abc', 'usr_abd'), secret)).toBeNull();
    expect(verifySessionToken(token, 'y'.repeat(40))).toBeNull();
    expect(verifySessionToken('garbage', secret)).toBeNull();
  });
});

describe('MemoryRepository credits', () => {
  it('never lets a balance go negative and keeps a ledger', async () => {
    const repo = new MemoryRepository(null);
    await repo.createUser('u1', 5);
    expect(await repo.adjustCredits('u1', -5, 'generation', 'j1')).toBe(0);
    expect(await repo.adjustCredits('u1', -1, 'generation', 'j2')).toBeNull();
    expect((await repo.getUser('u1'))!.credits).toBe(0);
  });

  it('persists to disk and reloads', async () => {
    const file = path.join(tmp(), 'db.json');
    const repo = new MemoryRepository(file);
    await repo.createUser('u1', 7);
    await new Promise((r) => setTimeout(r, 120));
    expect((await new MemoryRepository(file).getUser('u1'))!.credits).toBe(7);
  });
});

describe('InlineQueue', () => {
  it('runs FIFO with bounded concurrency and reports positions', async () => {
    const order: string[] = [];
    const gates = new Map<string, () => void>();
    const q = new InlineQueue(
      1,
      (id) => new Promise<void>((res) => gates.set(id, () => (order.push(id), res()))),
    );
    await q.enqueue('a');
    await q.enqueue('b');
    await q.enqueue('c');
    expect(await q.position('a')).toBeNull(); // running
    expect(await q.position('b')).toBe(1);
    expect(await q.position('c')).toBe(2);
    gates.get('a')!();
    await vi.waitFor(() => expect(gates.has('b')).toBe(true));
    gates.get('b')!();
    await vi.waitFor(() => expect(gates.has('c')).toBe(true));
    gates.get('c')!();
    await vi.waitFor(() => expect(order).toEqual(['a', 'b', 'c']));
  });
});

describe('MemoryRateLimiter', () => {
  it('allows up to the limit then returns a retry-after', async () => {
    const rl = new MemoryRateLimiter();
    for (let i = 0; i < 3; i++) expect(await rl.hit('k', 3, 60)).toBe(0);
    expect(await rl.hit('k', 3, 60)).toBeGreaterThan(0);
  });
});

describe('sniffImage', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  it('accepts when type and magic bytes agree', () => {
    expect(sniffImage(png, 'image/png').ext).toBe('png');
  });
  it('rejects a mismatched declared type or an oversized body', () => {
    expect(() => sniffImage(png, 'image/jpeg')).toThrow(AppError);
    expect(() =>
      sniffImage(new TextEncoder().encode('<svg onload=alert(1)>'), 'image/png'),
    ).toThrow(AppError);
    expect(() => sniffImage(new Uint8Array(600 * 1024), 'image/png')).toThrow(AppError);
  });
});

describe('nameFromPrompt', () => {
  it('keeps the object, not the whole description', () => {
    expect(nameFromPrompt('ดาบเวทย์ ใบดาบเหล็กขัดเงา ด้ามจับพันหนัง')).toBe('ดาบเวทย์');
    expect(nameFromPrompt('A magic sword with a polished blade')).toBe('Magic sword');
  });
});

describe('runGeneration', () => {
  async function setup(provider: GenerationProvider) {
    const repo = new MemoryRepository(null);
    await repo.createUser('u1', 10);
    await repo.adjustCredits('u1', -5, 'generation', 'job_1');
    const now = new Date().toISOString();
    const job: JobRecord = {
      id: 'job_1',
      userId: 'u1',
      status: 'queued',
      stage: 'queued',
      progress: 0,
      request: {
        mode: 'text',
        prompt: 'blue vase',
        negativePrompt: '',
        style: 'stylized',
        quality: 'draft',
        seed: 1,
      },
      creditsCharged: 5,
      provider: provider.id,
      providerTaskId: null,
      modelId: null,
      errorCode: null,
      errorDetail: null,
      startedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await repo.createJob(job);
    const services = {
      repo,
      storage: new LocalStorage(tmp()),
      provider,
      config: { PROVIDER_TIMEOUT_SECONDS: 60 },
    } as unknown as Services;
    return { repo, services };
  }

  it('stores the model and marks the job succeeded', async () => {
    const { repo, services } = await setup(new MockProvider(0));
    await runGeneration(services, 'job_1');
    const job = (await repo.getJob('job_1'))!;
    expect(job.status).toBe('succeeded');
    const model = (await repo.getModel(job.modelId!))!;
    expect(model.stats.triangles).toBeGreaterThan(0);
    expect(await services.storage.get(model.fileKey)).not.toBeNull();
    expect((await repo.getUser('u1'))!.credits).toBe(5);
  });

  it('refunds credits when the provider fails', async () => {
    const failing: GenerationProvider = {
      id: 'broken',
      generate: async () => {
        throw new Error('boom');
      },
    };
    const { repo, services } = await setup(failing);
    await runGeneration(services, 'job_1');
    expect((await repo.getJob('job_1'))!).toMatchObject({
      status: 'failed',
      errorCode: 'provider_failed',
    });
    expect((await repo.getUser('u1'))!.credits).toBe(10);
  });
});
