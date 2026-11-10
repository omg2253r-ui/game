import fs from 'node:fs';
import path from 'node:path';
import type { CreditReason, JobRecord, ModelRecord, Repository, UserRecord } from '../types';

interface Snapshot {
  users: Record<string, UserRecord>;
  jobs: Record<string, JobRecord>;
  models: Record<string, ModelRecord>;
  ledger: { userId: string; delta: number; reason: CreditReason; refId: string; at: string }[];
}

const empty = (): Snapshot => ({ users: {}, jobs: {}, models: {}, ledger: [] });

/**
 * Single-process store persisted to a JSON file so `pnpm dev` keeps your
 * library across restarts without Postgres. Not for production: no locking
 * between processes, whole-file rewrites.
 */
export class MemoryRepository implements Repository {
  private data: Snapshot;
  private writeTimer: NodeJS.Timeout | null = null;

  constructor(private readonly file: string | null) {
    this.data = empty();
    if (file && fs.existsSync(file)) {
      try {
        this.data = { ...empty(), ...(JSON.parse(fs.readFileSync(file, 'utf8')) as Snapshot) };
      } catch {
        // A corrupt dev snapshot should not block startup.
        fs.renameSync(file, `${file}.corrupt-${Date.now()}`);
      }
    }
  }

  private persist(): void {
    if (!this.file || this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      const file = this.file!;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data));
      fs.renameSync(tmp, file);
    }, 50);
  }

  async getUser(id: string) {
    return this.data.users[id] ?? null;
  }

  async createUser(id: string, starterCredits: number) {
    const existing = this.data.users[id];
    if (existing) return existing;
    const user: UserRecord = { id, credits: 0, isGuest: true, createdAt: new Date().toISOString() };
    this.data.users[id] = user;
    await this.adjustCredits(id, starterCredits, 'starter_grant', id);
    return this.data.users[id]!;
  }

  async adjustCredits(userId: string, delta: number, reason: CreditReason, refId: string) {
    const user = this.data.users[userId];
    if (!user) return null;
    const next = user.credits + delta;
    if (next < 0) return null;
    user.credits = next;
    this.data.ledger.push({ userId, delta, reason, refId, at: new Date().toISOString() });
    this.persist();
    return next;
  }

  async createJob(job: JobRecord) {
    this.data.jobs[job.id] = structuredClone(job);
    this.persist();
  }

  async updateJob(id: string, patch: Partial<JobRecord>) {
    const job = this.data.jobs[id];
    if (!job) throw new Error(`job ${id} not found`);
    Object.assign(job, patch, { updatedAt: new Date().toISOString() });
    this.persist();
    return structuredClone(job);
  }

  async getJob(id: string) {
    const job = this.data.jobs[id];
    return job ? structuredClone(job) : null;
  }

  async listUnfinishedJobs() {
    return Object.values(this.data.jobs)
      .filter((j) => j.status === 'queued' || j.status === 'running')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((j) => structuredClone(j));
  }

  async createModel(model: ModelRecord) {
    this.data.models[model.id] = structuredClone(model);
    this.persist();
  }

  async getModel(id: string) {
    const m = this.data.models[id];
    return m && !m.deletedAt ? structuredClone(m) : null;
  }

  async getModelByShareSlug(slug: string) {
    const m = Object.values(this.data.models).find((x) => x.shareSlug === slug && !x.deletedAt);
    return m ? structuredClone(m) : null;
  }

  async listModels(userId: string, filter: { q?: string; tag?: string }) {
    const q = filter.q?.toLowerCase();
    return Object.values(this.data.models)
      .filter((m) => m.userId === userId && !m.deletedAt)
      .filter((m) => !filter.tag || m.tags.includes(filter.tag))
      .filter(
        (m) =>
          !q ||
          m.name.toLowerCase().includes(q) ||
          m.prompt.toLowerCase().includes(q) ||
          m.tags.some((t) => t.includes(q)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((m) => structuredClone(m));
  }

  async listTags(userId: string) {
    const tags = new Set<string>();
    for (const m of Object.values(this.data.models)) {
      if (m.userId === userId && !m.deletedAt) m.tags.forEach((t) => tags.add(t));
    }
    return [...tags].sort();
  }

  async updateModel(id: string, patch: Partial<ModelRecord>) {
    const m = this.data.models[id];
    if (!m) throw new Error(`model ${id} not found`);
    Object.assign(m, patch);
    this.persist();
    return structuredClone(m);
  }
}
