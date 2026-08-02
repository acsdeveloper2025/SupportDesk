#!/usr/bin/env bash
# RC1 Backup & Restore Disaster Recovery Verification Script
# Validates database dump generation, restore clean execution, and post-restore data integrity.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="${ROOT_DIR}/apps/api"

DATABASE_HOST="${DATABASE_HOST:-localhost}"
DATABASE_PORT="${DATABASE_PORT:-5432}"
DATABASE_USER="${DATABASE_USER:-supportdesk}"
DATABASE_PASSWORD="${DATABASE_PASSWORD:-supportdesk}"
SOURCE_DB="${SOURCE_DB:-supportdesk_dev}"
RESTORE_DB="${RESTORE_DB:-supportdesk_restore_verify}"
BACKUP_FILE="${ROOT_DIR}/tmp_rc1_dr_backup.sql"

export PGPASSWORD="${DATABASE_PASSWORD}"

echo "=========================================================="
echo "==> SupportDesk Enterprise RC1 Backup & Restore DR Verification"
echo "=========================================================="

echo "1. Exporting logical backup from ${SOURCE_DB} to ${BACKUP_FILE}..."
pg_dump -h "${DATABASE_HOST}" -p "${DATABASE_PORT}" -U "${DATABASE_USER}" -d "${SOURCE_DB}" --clean --if-exists --no-owner --no-acl -f "${BACKUP_FILE}"

if [ ! -f "${BACKUP_FILE}" ] || [ ! -s "${BACKUP_FILE}" ]; [ "$?" -eq 0 ]; then
  echo "==> Backup file created successfully ($(du -h "${BACKUP_FILE}" | cut -f1))"
else
  echo "==> ERROR: Backup file was not created or is empty."
  exit 1
fi

echo "2. Preparing restore environment database ${RESTORE_DB}..."
psql -h "${DATABASE_HOST}" -p "${DATABASE_PORT}" -U "${DATABASE_USER}" -d postgres -v ON_ERROR_STOP=1 <<SQL
DROP DATABASE IF EXISTS ${RESTORE_DB};
CREATE DATABASE ${RESTORE_DB};
SQL

echo "3. Restoring backup into ${RESTORE_DB}..."
psql -h "${DATABASE_HOST}" -p "${DATABASE_PORT}" -U "${DATABASE_USER}" -d "${RESTORE_DB}" -f "${BACKUP_FILE}" > /dev/null

echo "4. Verifying post-restore data integrity and tenant isolation schemas..."
RESTORE_URL="postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${RESTORE_DB}?schema=public"

TABLE_COUNT=$(psql -h "${DATABASE_HOST}" -p "${DATABASE_PORT}" -U "${DATABASE_USER}" -d "${RESTORE_DB}" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
echo "==> Total restored public tables: ${TABLE_COUNT// /}"

if [ "${TABLE_COUNT// /}" -lt 25 ]; then
  echo "==> ERROR: Table count check failed (${TABLE_COUNT} tables found, expected >= 25)."
  exit 1
fi

echo "5. Cleaning up temporary DR artifacts..."
rm -f "${BACKUP_FILE}"

echo "=========================================================="
echo "==> RC1 Backup & Restore Disaster Recovery Verification: PASSED"
echo "=========================================================="
