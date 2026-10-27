# syntax=docker/dockerfile:1
# API image (PLANO, Sprint 19, task 4). Build from the repository root:
#   docker build -f apps/api/Dockerfile -t erre-api .                   # API (default target)
#   docker build -f apps/api/Dockerfile --target migrate -t erre-migrate .  # migrations, a separate step
# Both runtime images hold only bundled JavaScript (apps/api/build.mjs) and Node: no node_modules, no sources.
ARG NODE_IMAGE=node:22.23-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0 TURBO_TELEMETRY_DISABLED=1
RUN corepack enable

# Keeps only @erre/api and the workspace packages it depends on, so unrelated changes don't bust the cache.
FROM base AS prune
WORKDIR /repo
COPY . .
RUN npx --yes turbo@2.11.7 prune @erre/api --docker

FROM base AS build
WORKDIR /repo
COPY --from=prune /repo/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=prune /repo/out/full/ .
RUN pnpm turbo run build --filter=@erre/api \
 && mkdir -p /out/migrations \
 && find packages/*/migrations modules/*/db/migrations -name '*.sql' -not -path 'modules/_*' | tar -cf - -T - | tar -xf - -C /out/migrations

# Runs pending migrations as erre_migrator (DATABASE_MIGRATOR_URL), before the new API starts.
# Never bootstraps roles or rolls back: those are operator tasks run by a human (AGENTS.md, rule 1).
FROM ${NODE_IMAGE} AS migrate
ENV NODE_ENV=production MIGRATIONS_ROOT=/app/migrations
WORKDIR /app
COPY --from=build /out/migrations ./migrations
COPY --from=build /repo/apps/api/dist/migrate.js /repo/apps/api/dist/migrate.js.map ./
USER node
CMD ["node", "--enable-source-maps", "migrate.js", "migrate"]

FROM ${NODE_IMAGE} AS api
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build /repo/apps/api/dist/index.js /repo/apps/api/dist/index.js.map ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/v1/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "--enable-source-maps", "index.js"]
