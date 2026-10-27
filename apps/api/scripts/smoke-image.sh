#!/usr/bin/env bash
# Smoke test for the images built from apps/api/Dockerfile (PLANO, Sprint 19, task 4).
# Creates a disposable database, bootstraps the roles, runs the migrate image twice (the second run must be a
# no-op), boots the API image and waits for /v1/health. Local or CI Postgres only, never production.
#   DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres apps/api/scripts/smoke-image.sh
set -euo pipefail

: "${DATABASE_ADMIN_URL:?set DATABASE_ADMIN_URL (local superuser)}"
API_IMAGE="${API_IMAGE:-erre-api}"
MIGRATE_IMAGE="${MIGRATE_IMAGE:-erre-migrate}"
PORT="${SMOKE_PORT:-3999}"
DB="erre_smoke_$(date +%s)"
CONTAINER="erre-api-smoke-$$"

case "$DATABASE_ADMIN_URL" in
  *@localhost:* | *@127.0.0.1:*) ;;
  *) echo "refusing to run against a non-local database" >&2; exit 1 ;;
esac

admin_base="${DATABASE_ADMIN_URL%/*}"
host_port="${admin_base##*@}"
db_url() { echo "postgres://$1:$1@${host_port}/${DB}"; }

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  psql "$DATABASE_ADMIN_URL" -qc "DROP DATABASE IF EXISTS ${DB} WITH (FORCE)" >/dev/null || true
}
trap cleanup EXIT

psql "$DATABASE_ADMIN_URL" -qc "CREATE DATABASE ${DB}"
DATABASE_ADMIN_URL="${admin_base}/${DB}" pnpm --filter @erre/db -s db:bootstrap

docker run --rm --network host -e DATABASE_MIGRATOR_URL="$(db_url erre_migrator)" "$MIGRATE_IMAGE"
second=$(docker run --rm --network host -e DATABASE_MIGRATOR_URL="$(db_url erre_migrator)" "$MIGRATE_IMAGE" 2>&1)
echo "$second"
[ "$second" = "up to date" ] || { echo "second migrate run should be a no-op" >&2; exit 1; }

docker run -d --name "$CONTAINER" --network host \
  -e PORT="$PORT" \
  -e DATABASE_URL="$(db_url erre_app)" \
  -e DATABASE_JOBS_URL="$(db_url erre_jobs)" \
  -e PUBLIC_API_URL="http://localhost:${PORT}" \
  -e BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  -e GOOGLE_CLIENT_ID=smoke -e GOOGLE_CLIENT_SECRET=smoke \
  -e TRUSTED_ORIGINS="http://localhost:8081,erre://" \
  -e MODULES_ENABLED=errometro,eventos \
  "$API_IMAGE" >/dev/null

for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:${PORT}/v1/health" >/dev/null 2>&1; then
    status=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${PORT}/v1/errometro/state")
    [ "$status" = "401" ] || { echo "expected 401 from a module route, got ${status}" >&2; exit 1; }
    [ "$(docker exec "$CONTAINER" id -un)" = "node" ] || { echo "API must not run as root" >&2; exit 1; }
    echo "smoke ok"
    exit 0
  fi
  sleep 1
done
docker logs "$CONTAINER" >&2
echo "API did not become healthy" >&2
exit 1
