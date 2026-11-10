# One container serving the API and the built web app.
# Works on Render (free web service), Railway, Fly.io, Koyeb or any Docker host.
FROM node:22-slim

ENV NEXT_TELEMETRY_DISABLED=1 \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable

WORKDIR /app

# Install with only the manifests first so this layer is cached between deploys.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build:single

ENV NODE_ENV=production
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["sh", "scripts/start.sh"]
