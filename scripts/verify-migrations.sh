#!/usr/bin/env bash
# Verify Prisma migrations apply cleanly to a fresh PostgreSQL database
# and that migrations match schema.prisma (zero drift).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="${ROOT_DIR}/apps/api"

DATABASE_HOST="${DATABASE_HOST:-localhost}"
DATABASE_PORT="${DATABASE_PORT:-5432}"
DATABASE_USER="${DATABASE_USER:-supportdesk}"
DATABASE_PASSWORD="${DATABASE_PASSWORD:-supportdesk}"
VERIFY_DB="${VERIFY_DB:-supportdesk_migrate_verify}"
SHADOW_DB="${SHADOW_DB:-supportdesk_shadow}"

export PGPASSWORD="${DATABASE_PASSWORD}"

echo "==> Recreating verification database ${VERIFY_DB}"
psql -h "${DATABASE_HOST}" -p "${DATABASE_PORT}" -U "${DATABASE_USER}" -d postgres -v ON_ERROR_STOP=1 <<SQL
DROP DATABASE IF EXISTS ${VERIFY_DB};
CREATE DATABASE ${VERIFY_DB};
DROP DATABASE IF EXISTS ${SHADOW_DB};
CREATE DATABASE ${SHADOW_DB};
SQL

VERIFY_URL="postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${VERIFY_DB}?schema=public"
SHADOW_URL="postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${SHADOW_DB}?schema=public"

echo "==> prisma migrate deploy"
(
  cd "${API_DIR}"
  DATABASE_URL="${VERIFY_URL}" pnpm exec prisma migrate deploy
)

echo "==> prisma migrate diff (expect: No difference detected)"
(
  cd "${API_DIR}"
  DATABASE_URL="${VERIFY_URL}" pnpm exec prisma migrate diff \
    --from-migrations prisma/migrations \
    --to-schema-datamodel prisma/schema.prisma \
    --shadow-database-url "${SHADOW_URL}"
)

echo "==> prisma generate (required before schema integration tests)"
(
  cd "${API_DIR}"
  DATABASE_URL="${VERIFY_URL}" pnpm exec prisma generate
)

echo "==> schema integration tests"
(
  cd "${API_DIR}"
  DATABASE_URL="${VERIFY_URL}" RUN_DB_INTEGRATION=1 pnpm exec vitest run src/ticketing/ticket-schema.integration.spec.ts
)

echo "==> Migration verification PASSED"
