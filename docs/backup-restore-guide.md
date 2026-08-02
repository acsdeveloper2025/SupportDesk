# SupportDesk Enterprise v1.0 — Backup & Restore Guide

This guide describes database backup strategies, Point-in-Time Recovery (PITR), disaster recovery procedures, tenant data extraction, and automated restore verification for SupportDesk Enterprise v1.0.

---

## 1. Backup Strategy Overview

SupportDesk Enterprise relies on PostgreSQL 16 as its primary relational store. A robust backup policy requires two complementary approaches:

1. **Continuous Physical Backups (WAL Archiving)**: Enables Point-in-Time Recovery (PITR) to any second within a 30-day retention window.
2. **Scheduled Logical Backups (`pg_dump`)**: Daily automated logical database dumps stored in offsite, encrypted object storage (S3 / GCS).

---

## 2. Automated Daily Logical Backup

### Automated Script Configuration

Run the provided backup script via a daily cron job:

```bash
0 2 * * * /usr/local/bin/supportdesk-backup.sh >> /var/log/supportdesk-backup.log 2>&1
```

### Script Content (`supportdesk-backup.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/backups/supportdesk"
FILENAME="supportdesk_prod_${TIMESTAMP}.sql.gz"
S3_BUCKET="s3://enterprise-supportdesk-backups-prod"

mkdir -p "${BACKUP_DIR}"

echo "Starting logical database backup at $(date)..."
PGPASSWORD="${DATABASE_PASSWORD}" pg_dump \
  -h "${DATABASE_HOST}" \
  -U "${DATABASE_USER}" \
  -d "${DATABASE_NAME}" \
  --format=custom \
  --compress=9 \
  --file="${BACKUP_DIR}/${FILENAME}"

echo "Uploading backup to remote object storage..."
aws s3 cp "${BACKUP_DIR}/${FILENAME}" "${S3_BUCKET}/${FILENAME}" --sse aws:kms

echo "Cleaning local backups older than 7 days..."
find "${BACKUP_DIR}" -type f -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed successfully."
```

---

## 3. Disaster Recovery & Database Restore Procedure

In the event of database corruption or regional outage, follow these steps to restore service:

### Step 1: Provision Clean PostgreSQL Target

Ensure a clean target PostgreSQL database instance is running with identical major version (PostgreSQL 16) and matching database users.

### Step 2: Download & Verify Backup Artifact

```bash
aws s3 cp s3://enterprise-supportdesk-backups-prod/supportdesk_prod_20260802_020000.sql.gz ./
```

### Step 3: Execute Restore Command

```bash
export PGPASSWORD="your-database-password"

# Recreate target database
psql -h db.example.com -U supportdesk -d postgres -c "DROP DATABASE IF EXISTS supportdesk_restored;"
psql -h db.example.com -U supportdesk -d postgres -c "CREATE DATABASE supportdesk_restored;"

# Restore schema and data using pg_restore
pg_restore -h db.example.com -U supportdesk -d supportdesk_restored -v --clean --if-exists --no-owner --no-acl supportdesk_prod_20260802_020000.sql.gz
```

### Step 4: Run Post-Restore Verification Script

Execute the automated DR verification script:

```bash
DATABASE_HOST="db.example.com" SOURCE_DB="supportdesk_restored" bash scripts/rc1-backup-restore-dr.sh
```

---

## 4. Tenant Data Extraction (Single-Tenant Export)

For tenant data portability or compliance requests, single-tenant data can be extracted using tenant-isolated query parameters:

```sql
COPY (
  SELECT * FROM "Ticket" WHERE "tenantId" = 'tenant_uuid_here'
) TO '/tmp/tenant_tickets.csv' WITH CSV HEADER;
```

---

## 5. Restore Verification Policy

- **Frequency**: Backup restore procedures must be tested automatically at least once per month using the automated verification harness in `scripts/rc1-backup-restore-dr.sh`.
- **Recovery Time Objective (RTO)**: Target RTO is < 1 hour.
- **Recovery Point Objective (RPO)**: Target RPO is < 5 minutes via continuous WAL log streaming.
