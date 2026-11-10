/** Apply SQL migrations in ./drizzle to DATABASE_URL. */
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    'DATABASE_URL is not set. Copy .env.example to .env and start Postgres (docker compose up -d).',
  );
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: url });
await migrate(drizzle(pool), { migrationsFolder: path.resolve(import.meta.dirname, '../drizzle') });
await pool.end();
console.log('migrations applied');
