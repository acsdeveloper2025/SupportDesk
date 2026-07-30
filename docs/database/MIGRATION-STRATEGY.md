# Migration strategy

Database change safety follows [../18-deployment-cicd.md](../18-deployment-cicd.md), [../AGENTS.md](../../AGENTS.md), and the tenant isolation rules in [../06-tenant-isolation.md](../06-tenant-isolation.md). This document defines process only; it does not generate SQL.

## Expand, migrate, contract

1. **Expand:** add backward-compatible structures, nullable columns, new tables, new indexes, or dual-write targets.
2. **Migrate:** backfill tenant-aware data in throttled, checkpointed jobs with observability and validation.
3. **Switch:** move reads/writes through feature flags or compatibility code after validation.
4. **Stabilize:** wait through the rollback window while old and new shapes remain compatible.
5. **Contract:** remove old structures in a later release after usage telemetry and rollback risk are cleared.

## Required migration metadata

Each migration plan must document:

- Requirement and ADR links.
- Owned module and reviewers.
- Affected tables and tenant-owned relationships.
- Backward/forward compatibility behavior.
- Expected row counts and largest-tenant impact.
- Lock, replication, queue, and storage risks.
- Backfill checkpoint key and throttle controls.
- Validation queries or integrity checks described in prose.
- Rollback or roll-forward procedure.
- Backup/restore expectations.

## Tenant-aware backfills

Backfills must process bounded tenant batches, track progress, emit metrics, and be resumable. They must not cross tenant boundaries in memory, logs, temporary tables, exports, or failure reports. Failures for one tenant must not silently skip that tenant or corrupt other tenants.

## Validation

Before contraction, validate:

- Row counts and ownership match expectations.
- Foreign-key and uniqueness invariants hold.
- Tenant IDs are present on owned rows.
- Search/reporting projections can rebuild.
- Audit and outbox continuity remain intact.
- Restore tests preserve tenant ownership.

## Partitioning and scale

Partitioning is an implementation option, not an excuse to weaken domain invariants. Candidate tables are listed in [ERD.md](ERD.md). Partitioning decisions require a decision record covering query patterns, retention, backup/restore, tenant mobility, operational complexity, and failure modes.

## Prohibited changes

- Destructive same-release schema contraction.
- Stop-the-world migrations for large tenant-owned tables.
- Unbounded backfills.
- Silent partial migration.
- Cross-tenant staging files or logs.
- Reusing stable IDs, enum values, or permission keys with changed meaning.
