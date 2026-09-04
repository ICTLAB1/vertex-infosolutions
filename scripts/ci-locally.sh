#!/usr/bin/env bash
# Run what CI runs, in the order CI runs it, against the database CI has.
#
# CI's database is migrated and never seeded, and its build step has no
# DATABASE_URL at all. Both of those have caught things that a run against a
# seeded local database could not: four tests that assumed a seeded catalogue,
# and a sitemap that needed a database to prerender. Running the suite the
# comfortable way and pushing is how those reached the deploy gate.
#
#   ./scripts/ci-locally.sh
#
# Needs a local Postgres. It creates and drops its own scratch database, so it
# never touches your development data.
set -euo pipefail

SCRATCH="${CI_SCRATCH_DB:-vertex_ci_local}"
ADMIN="${DATABASE_ADMIN_URL:-postgresql://vertex@127.0.0.1:5433/postgres}"
SCRATCH_URL="${ADMIN%/*}/$SCRATCH?schema=public"

cleanup() { psql "$ADMIN" -qc "DROP DATABASE IF EXISTS \"$SCRATCH\";" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> typecheck";  npm run typecheck
echo "==> lint";       npm run lint

echo "==> empty database, migrations only — the way CI has it"
cleanup
psql "$ADMIN" -qc "CREATE DATABASE \"$SCRATCH\";" >/dev/null
DATABASE_URL="$SCRATCH_URL" npx prisma migrate deploy

echo "==> tests against it"
DATABASE_URL="$SCRATCH_URL" npx vitest run

echo "==> build with no database at all"
DATABASE_URL="" npm run build

echo
echo "All green — this is what CI will see."
