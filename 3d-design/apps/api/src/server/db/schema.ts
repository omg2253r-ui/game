import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { ErrorCode, JobStage, MeshStats, Quality, Style } from '@3d-design/shared';
import type { CreditReason, JobRecord } from '../types';

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    /** Null for guest accounts until they sign in (phase 2: Auth.js). */
    email: text('email'),
    credits: integer('credits').notNull().default(0),
    isGuest: boolean('is_guest').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
);

/** Append-only ledger; `users.credits` is the cached balance. */
export const creditTransactions = pgTable(
  'credit_transactions',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    delta: integer('delta').notNull(),
    reason: text('reason').$type<CreditReason>().notNull(),
    refId: text('ref_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('credit_tx_user_idx').on(t.userId)],
);

export const jobs = pgTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    status: text('status').$type<JobRecord['status']>().notNull(),
    stage: text('stage').$type<JobStage>().notNull(),
    progress: real('progress').notNull().default(0),
    request: jsonb('request').$type<JobRecord['request']>().notNull(),
    creditsCharged: integer('credits_charged').notNull(),
    provider: text('provider').notNull(),
    providerTaskId: text('provider_task_id'),
    modelId: text('model_id'),
    errorCode: text('error_code').$type<ErrorCode>(),
    errorDetail: jsonb('error_detail').$type<Record<string, string | number>>(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('jobs_unfinished_idx')
      .on(t.createdAt)
      .where(sql`${t.status} in ('queued', 'running')`),
  ],
);

export const models = pgTable(
  'models',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    jobId: text('job_id').notNull(),
    name: text('name').notNull(),
    prompt: text('prompt').notNull(),
    negativePrompt: text('negative_prompt').notNull().default(''),
    style: text('style').$type<Style>().notNull(),
    quality: text('quality').$type<Quality>().notNull(),
    seed: integer('seed').notNull(),
    provider: text('provider').notNull(),
    fileKey: text('file_key').notNull(),
    thumbnailKey: text('thumbnail_key'),
    stats: jsonb('stats').$type<MeshStats>().notNull(),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    isPublic: boolean('is_public').notNull().default(false),
    allowCommercialUse: boolean('allow_commercial_use').notNull().default(false),
    shareSlug: text('share_slug'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('models_user_created_idx').on(t.userId, t.createdAt),
    uniqueIndex('models_share_slug_idx').on(t.shareSlug),
    index('models_tags_idx').using('gin', t.tags),
  ],
);
