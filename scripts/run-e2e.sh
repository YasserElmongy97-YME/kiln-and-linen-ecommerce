#!/usr/bin/env bash
# Builds nothing: expects `npm run build` to have run. Starts the app on a spare port, runs the HTTP-level
# end-to-end suite against it, then stops the app. Requires a migrated and seeded database in DATABASE_URL.
set -euo pipefail

PORT="${E2E_PORT:-3100}"
export E2E_BASE_URL="http://localhost:${PORT}"
export APP_URL="${E2E_BASE_URL}"
export E2E_ADMIN_EMAIL="e2e-admin@example.test"
export E2E_ADMIN_PASSWORD="$(openssl rand -hex 12)"

ADMIN_EMAIL="$E2E_ADMIN_EMAIL" ADMIN_PASSWORD="$E2E_ADMIN_PASSWORD" npm run --silent admin:create

npx next start -p "$PORT" > /tmp/e2e-server.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  curl -fs -o /dev/null "$E2E_BASE_URL/api/auth/me" && break
  sleep 1
done

npm run --silent test:e2e
