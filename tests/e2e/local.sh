#!/usr/bin/env bash
# Runs the end-to-end tests locally against a throwaway database.
#   yarn test:e2e:local
# Uses the Postgres server from server/.env (DATABASE_URL), creates a
# separate "tabpro_test" database, and drops it afterwards.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEV_URL="$(grep '^DATABASE_URL=' "$ROOT/server/.env" | cut -d= -f2-)"
TEST_URL="${DEV_URL%/*}/tabpro_test"
PORT=3099
export JWT_SECRET="local-e2e-secret"

# A leftover server from an earlier run would answer with old code.
if curl -sf "http://localhost:$PORT/health" >/dev/null; then
  echo "Port $PORT is busy (old test server?). Stop it first: lsof -ti:$PORT | xargs kill" >&2; exit 1
fi

psql "$DEV_URL" -qc "drop database if exists tabpro_test" -c "create database tabpro_test" 2>/dev/null
(cd "$ROOT/server" && DATABASE_URL="$TEST_URL" npx drizzle-kit migrate >/dev/null && yarn -s build)

(cd "$ROOT/server" && DATABASE_URL="$TEST_URL" PORT=$PORT CLIENT_URL=http://localhost:5199 \
  PAWAPAY_API_TOKEN=fake-test-token PAWAPAY_BASE_URL=http://localhost:3098 \
  node dist/app.js > /tmp/tabpro-e2e-server.log 2>&1) &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null; psql "$DEV_URL" -qc "drop database if exists tabpro_test" 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do curl -sf "http://localhost:$PORT/health" >/dev/null && break; sleep 1; done
API_URL="http://localhost:$PORT" DATABASE_URL="$TEST_URL" node "$ROOT/tests/e2e/run.mjs"
