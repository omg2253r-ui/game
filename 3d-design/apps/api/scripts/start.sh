#!/bin/sh
# Production entrypoint: apply migrations (when a database is configured),
# then serve API + UI on $PORT (Render, Railway, Fly… set it).
set -e
if [ -n "$DATABASE_URL" ]; then
  node --import tsx scripts/migrate.ts
fi
exec ./node_modules/.bin/next start --port "${PORT:-3001}" --hostname 0.0.0.0
