import { and, arrayContains, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import type { CreditReason, JobRecord, ModelRecord, Repository, UserRecord } from '../types';
import * as schema from './schema';

type Db = NodePgDatabase<typeof schema>;

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
const date = (s: string | null | undefined): Date | null | undefined =>
  s === undefined ? undefined : s === null ? null : new Date(s);

function toUser(r: typeof schema.users.$inferSelect): UserRecord {
  return { id: r.id, credits: r.credits, isGuest: r.isGuest, createdAt: r.createdAt.toISOString() };
}

function toJob(r: typeof schema.jobs.$inferSelect): JobRecord {
  return {
    ...r,
    startedAt: iso(r.startedAt),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function toModel(r: typeof schema.models.$inferSelect): ModelRecord {
  return { ...r, createdAt: r.createdAt.toISOString(), deletedAt: iso(r.deletedAt) };
}

/** Escape LIKE wildcards so a search for "50%" is literal. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export class PostgresRepository implements Repository {
  readonly pool: pg.Pool;
  private readonly db: Db;

  constructor(url: string) {
    this.pool = new pg.Pool({ connectionString: url, max: 10 });
    this.db = drizzle(this.pool, { schema });
  }

  async getUser(id: string) {
    const [r] = await this.db.select().from(schema.users).where(eq(schema.users.id, id));
    return r ? toUser(r) : null;
  }

  async createUser(id: string, starterCredits: number) {
    return this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(schema.users)
        .values({ id, credits: starterCredits })
        .onConflictDoNothing()
        .returning();
      if (inserted[0]) {
        await tx
          .insert(schema.creditTransactions)
          .values({ userId: id, delta: starterCredits, reason: 'starter_grant', refId: id });
        return toUser(inserted[0]);
      }
      const [r] = await tx.select().from(schema.users).where(eq(schema.users.id, id));
      return toUser(r!);
    });
  }

  async adjustCredits(userId: string, delta: number, reason: CreditReason, refId: string) {
    return this.db.transaction(async (tx) => {
      // Conditional UPDATE is the lock: two concurrent debits cannot both pass.
      const [r] = await tx
        .update(schema.users)
        .set({ credits: sql`${schema.users.credits} + ${delta}` })
        .where(and(eq(schema.users.id, userId), sql`${schema.users.credits} + ${delta} >= 0`))
        .returning({ credits: schema.users.credits });
      if (!r) return null;
      await tx.insert(schema.creditTransactions).values({ userId, delta, reason, refId });
      return r.credits;
    });
  }

  async createJob(job: JobRecord) {
    await this.db.insert(schema.jobs).values({
      ...job,
      startedAt: date(job.startedAt)!,
      createdAt: new Date(job.createdAt),
      updatedAt: new Date(job.updatedAt),
    });
  }

  async updateJob(id: string, patch: Partial<JobRecord>) {
    const { startedAt, createdAt: _c, updatedAt: _u, ...rest } = patch;
    const [r] = await this.db
      .update(schema.jobs)
      .set({
        ...rest,
        ...(startedAt !== undefined && { startedAt: date(startedAt) }),
        updatedAt: new Date(),
      })
      .where(eq(schema.jobs.id, id))
      .returning();
    if (!r) throw new Error(`job ${id} not found`);
    return toJob(r);
  }

  async getJob(id: string) {
    const [r] = await this.db.select().from(schema.jobs).where(eq(schema.jobs.id, id));
    return r ? toJob(r) : null;
  }

  async listUnfinishedJobs() {
    const rows = await this.db
      .select()
      .from(schema.jobs)
      .where(inArray(schema.jobs.status, ['queued', 'running']))
      .orderBy(asc(schema.jobs.createdAt));
    return rows.map(toJob);
  }

  async createModel(m: ModelRecord) {
    await this.db.insert(schema.models).values({
      ...m,
      createdAt: new Date(m.createdAt),
      deletedAt: date(m.deletedAt)!,
    });
  }

  async getModel(id: string) {
    const [r] = await this.db
      .select()
      .from(schema.models)
      .where(and(eq(schema.models.id, id), isNull(schema.models.deletedAt)));
    return r ? toModel(r) : null;
  }

  async getModelByShareSlug(slug: string) {
    const [r] = await this.db
      .select()
      .from(schema.models)
      .where(and(eq(schema.models.shareSlug, slug), isNull(schema.models.deletedAt)));
    return r ? toModel(r) : null;
  }

  async listModels(userId: string, filter: { q?: string; tag?: string }) {
    const m = schema.models;
    const conds = [eq(m.userId, userId), isNull(m.deletedAt)];
    if (filter.tag) conds.push(arrayContains(m.tags, [filter.tag]));
    if (filter.q) {
      const pattern = `%${likeEscape(filter.q)}%`;
      conds.push(
        or(
          ilike(m.name, pattern),
          ilike(m.prompt, pattern),
          sql`exists (select 1 from unnest(${m.tags}) t where t ilike ${pattern})`,
        )!,
      );
    }
    const rows = await this.db
      .select()
      .from(m)
      .where(and(...conds))
      .orderBy(desc(m.createdAt))
      .limit(500);
    return rows.map(toModel);
  }

  async listTags(userId: string) {
    const rows = await this.db.execute<{ tag: string }>(
      sql`select distinct unnest(tags) as tag from models where user_id = ${userId} and deleted_at is null order by tag`,
    );
    return rows.rows.map((r) => r.tag);
  }

  async updateModel(id: string, patch: Partial<ModelRecord>) {
    const { createdAt: _c, deletedAt, ...rest } = patch;
    const [r] = await this.db
      .update(schema.models)
      .set({ ...rest, ...(deletedAt !== undefined && { deletedAt: date(deletedAt) }) })
      .where(eq(schema.models.id, id))
      .returning();
    if (!r) throw new Error(`model ${id} not found`);
    return toModel(r);
  }
}
