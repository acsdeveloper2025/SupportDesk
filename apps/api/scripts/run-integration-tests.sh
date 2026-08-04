#!/usr/bin/env bash
# Run PostgreSQL-backed integration tests against a dedicated test database.
#
# The integration specs are destructive (they truncate all tables), so they
# must never run against the development or production database. This script
# provisions a throwaway `supportdesk_test` database, applies migrations, and
# runs the suite against it.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(dirname "${SCRIPT_DIR}")"
ROOT_DIR="$(dirname "${API_DIR}")"

DATABASE_HOST="${DATABASE_HOST:-localhost}"
DATABASE_PORT="${DATABASE_PORT:-5432}"
DATABASE_USER="${DATABASE_USER:-supportdesk}"
DATABASE_PASSWORD="${DATABASE_PASSWORD:-supportdesk}"
TEST_DB="${TEST_DB:-supportdesk_test}"

export PGPASSWORD="${DATABASE_PASSWORD}"

echo "==> Recreating dedicated integration test database ${TEST_DB}"
psql -h "${DATABASE_HOST}" -p "${DATABASE_PORT}" -U "${DATABASE_USER}" -d postgres -v ON_ERROR_STOP=1 <<SQL
DROP DATABASE IF EXISTS ${TEST_DB};
CREATE DATABASE ${TEST_DB};
SQL

TEST_URL="postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${TEST_DB}?schema=public"

echo "==> prisma migrate deploy"
(
  cd "${API_DIR}"
  DATABASE_URL="${TEST_URL}" pnpm exec prisma migrate deploy
)

echo "==> running integration specs"
(
  cd "${API_DIR}"
  DATABASE_URL="${TEST_URL}" pnpm exec vitest run src/**/*.spec.ts
)
