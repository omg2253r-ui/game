import path from 'node:path';
import { z } from 'zod';

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    /** HMAC key for the session cookie. Required in production. */
    SESSION_SECRET: z.string().min(32).optional(),
    /** Postgres. Omit to use the JSON-file store (single process, dev only). */
    DATABASE_URL: z.string().url().optional(),
    /** Redis for BullMQ + rate limiting. Omit to use the in-process queue. */
    REDIS_URL: z.string().url().optional(),
    /** With Redis: also run a queue worker inside the API process. */
    RUN_WORKER_IN_API: bool.default(true),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(2),

    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().default('auto'),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    /**
     * Redirect downloads to short-lived presigned URLs instead of streaming
     * through the API. Off by default: it needs bucket CORS for the web origin,
     * and not every S3-compatible store supports presigning.
     */
    S3_SIGNED_DOWNLOADS: bool.default(false),

    AI_PROVIDER: z.enum(['mock', 'meshy', 'tripo']).default('mock'),
    MESHY_API_KEY: z.string().optional(),
    TRIPO_API_KEY: z.string().optional(),
    /** Multiplier on the mock provider's simulated delays (0 = instant). */
    MOCK_DELAY_SCALE: z.coerce.number().min(0).max(10).default(1),
    PROVIDER_TIMEOUT_SECONDS: z.coerce.number().int().min(30).default(900),

    STARTER_CREDITS: z.coerce.number().int().min(0).default(50),
    RATE_LIMIT_USER_PER_MIN: z.coerce.number().int().min(1).default(6),
    RATE_LIMIT_IP_PER_MIN: z.coerce.number().int().min(1).default(30),
    /** Trust X-Forwarded-For (set true only behind a proxy you control). */
    TRUST_PROXY: bool.default(false),

    DATA_DIR: z.string().default('.data'),
  })
  .superRefine((env, ctx) => {
    const need = (key: keyof typeof env, why: string) => {
      if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: `required ${why}` });
    };
    if (env.NODE_ENV === 'production') need('SESSION_SECRET', 'in production');
    if (env.STORAGE_DRIVER === 's3') {
      need('S3_ENDPOINT', 'when STORAGE_DRIVER=s3');
      need('S3_BUCKET', 'when STORAGE_DRIVER=s3');
      need('S3_ACCESS_KEY_ID', 'when STORAGE_DRIVER=s3');
      need('S3_SECRET_ACCESS_KEY', 'when STORAGE_DRIVER=s3');
    }
    if (env.AI_PROVIDER === 'meshy') need('MESHY_API_KEY', 'when AI_PROVIDER=meshy');
    if (env.AI_PROVIDER === 'tripo') need('TRIPO_API_KEY', 'when AI_PROVIDER=tripo');
    if (env.REDIS_URL && !env.DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'required when REDIS_URL is set (queue workers need a shared database)',
      });
    }
  });

export type Config = z.infer<typeof EnvSchema> & { sessionSecret: string; dataDir: string };

let cached: Config | undefined;

export function getConfig(): Config {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    // Hosts with an ephemeral disk (Render free, most containers) lose these on restart.
    if (!env.DATABASE_URL)
      console.warn(
        '[config] DATABASE_URL not set: accounts and the library live in a local JSON file and are lost when the container restarts.',
      );
    if (env.STORAGE_DRIVER === 'local')
      console.warn(
        '[config] STORAGE_DRIVER=local: model files are lost when the container restarts. Use s3 (Supabase Storage, R2…).',
      );
    if (env.AI_PROVIDER === 'mock')
      console.warn(
        '[config] AI_PROVIDER=mock: models come from the procedural stand-in, not an AI model.',
      );
  }
  cached = {
    ...env,
    sessionSecret: env.SESSION_SECRET ?? 'dev-only-session-secret-change-me-0000000000',
    // Runtime data location, not a build input: keep it out of file tracing.
    dataDir: path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.DATA_DIR),
  };
  return cached;
}
