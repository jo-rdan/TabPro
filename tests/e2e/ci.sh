#!/usr/bin/env bash
# Runs the end-to-end tests inside a GitHub Actions job that has a Postgres
# service (DATABASE_URL set). Used by the ops bot before it merges anything.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
yarn -s build
(cd server && npx drizzle-kit migrate >/dev/null)
(cd server && PORT=3099 CLIENT_URL=http://localhost:5199 \
  PAWAPAY_API_TOKEN=fake-test-token PAWAPAY_BASE_URL=http://localhost:3098 \
  NODE_TLS_REJECT_UNAUTHORIZED=0 VAPID_PUBLIC_KEY=BN1WjYdFaRJGeLI_bwwEqPGyyki_umEOR7ys5wA1dilR_50BUGE5NU6yTjCXRHaBs1m0GNPJ0UjDzoKozLWKGyc VAPID_PRIVATE_KEY=U654T5SlyDptUP8iTr6udaHtzRwYPQOPX1oSUzBl7Tk \
  exec node dist/app.js > /tmp/tabpro-ci-server.log 2>&1) &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT
for _ in $(seq 1 30); do curl -sf http://localhost:3099/health >/dev/null && break; sleep 1; done
API_URL=http://localhost:3099 node tests/e2e/run.mjs
