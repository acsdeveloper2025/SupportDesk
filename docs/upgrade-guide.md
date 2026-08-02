# SupportDesk Enterprise v1.0 — Upgrade Guide

This document outlines standard upgrade procedures, zero-downtime expand/migrate/contract schema rules, version compatibility matrices, and rollback guidelines for SupportDesk Enterprise v1.0.

---

## 1. Versioning & Upgrade Strategy

SupportDesk Enterprise follows [Semantic Versioning 2.0.0](https://semver.org/) (`MAJOR.MINOR.PATCH`):

- **PATCH Releases (v1.0.x)**: Bug fixes, security patches, performance optimizations. Non-breaking schema changes.
- **MINOR Releases (v1.x.0)**: Backward-compatible feature additions, new API endpoints, database schema additions.
- **MAJOR Releases (vX.0.0)**: Breaking architectural or API changes, executed via formal deprecation windows and expand/migrate/contract cycles.

---

## 2. Zero-Downtime Migration Pattern (Expand / Migrate / Contract)

Database schema modifications must never break currently executing API instances. All database changes follow a 3-phase pattern across multiple releases:

```mermaid
graph LR
    Phase1[Phase 1: EXPAND] --> Phase2[Phase 2: MIGRATE] --> Phase3[Phase 3: CONTRACT]
    Phase1 -.->|New columns added nullable or default| DualWrite[App writes to both old & new]
    Phase2 -.->|Throttled background job| Backfill[Backfill historical rows]
    Phase3 -.->|Subsequent release| DropOld[Drop old column / table]
```

### Phase 1: Expand (Release N)

Add new columns, tables, or indexes. New columns **must** be nullable or contain safe default values so existing API code continues to function seamlessly.

### Phase 2: Migrate (Release N+1)

Update API application code to write to both old and new fields (dual-write). Execute background jobs to backfill historical database rows.

### Phase 3: Contract (Release N+2)

Once all API services are updated and historical data backfill is verified, remove old fields and unused database objects in a separate migration.

---

## 3. Standard Upgrade Workflow (e.g. Upgrading to v1.0.1)

Follow this step-by-step procedure to upgrade a production instance:

### Step 1: Pre-Upgrade Verification

1. Verify backup completion (refer to [Backup & Restore Guide](file:///Users/mayurkulkarni/Downloads/SupportDesk/docs/backup-restore-guide.md)).
2. Review target release notes (`docs/release-notes-v1.0.x.md`).
3. Check open maintenance window and notify administrators.

### Step 2: Database Migration Execution

Deploy database migrations before updating API code:

```bash
cd apps/api
DATABASE_URL="postgresql://user:pass@db-host:5432/supportdesk" pnpm exec prisma migrate deploy
```

### Step 3: Application Deployment (Rolling Update)

Perform a rolling update on container clusters:

```bash
# Kubernetes rolling update
kubectl set image deployment/supportdesk-api api=enterprise/supportdesk-api:v1.0.1 -n supportdesk
kubectl set image deployment/supportdesk-web web=enterprise/supportdesk-web:v1.0.1 -n supportdesk

# Verify rollout status
kubectl rollout status deployment/supportdesk-api -n supportdesk
kubectl rollout status deployment/supportdesk-web -n supportdesk
```

---

## 4. Rollback Strategy & Emergency Recovery

If critical anomalies or unexpected errors occur post-upgrade:

1. **Roll Back Container Deployment**:
   ```bash
   kubectl rollout undo deployment/supportdesk-api -n supportdesk
   kubectl rollout undo deployment/supportdesk-web -n supportdesk
   ```
2. **Database Schema Rollback**:
   Because migrations follow expand/migrate/contract rules, newly added columns do not break rolled-back API code. No destructive database rollback is needed for minor/patch upgrades.
