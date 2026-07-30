# Database design

This section expands the conceptual model in [../12-data-model.md](../12-data-model.md) into an implementation-ready, vendor-neutral database specification. It defines ownership, constraints, indexes, naming, migration safety, tenant isolation, and scale considerations without generating SQL.

## Documents

- [ERD](ERD.md): entity relationships and ownership boundaries.
- [Tables](TABLES.md): table responsibilities, primary keys, foreign keys, uniqueness, audit columns, and lifecycle rules.
- [Indexing](INDEXING.md): lookup, queue, reporting, search-projection, outbox, and retention index strategy.
- [Naming conventions](NAMING-CONVENTIONS.md): tables, columns, IDs, timestamps, enums, constraints, and indexes.
- [Migration strategy](MIGRATION-STRATEGY.md): expand/migrate/contract, tenant-aware backfills, validation, rollback, and partitioning.

## Design principles

1. Tenant-owned rows carry immutable `tenant_id`.
2. Cross-tenant joins, constraints, caches, exports, and analytics are prohibited unless explicitly classified as platform metadata and reviewed.
3. Domain tables remain authoritative. Search, analytics, notifications, and reports are projections.
4. Mutable aggregate roots use optimistic concurrency through `version`.
5. Material writes create audit evidence and outbox records atomically, as required by [../05-architecture.md](../05-architecture.md) and [../audit-events.md](../audit-events.md).
6. Hard deletion never destroys legally required audit or legal-hold evidence.

## Tenant isolation strategy

SupportDesk starts with shared infrastructure and row-level tenant isolation, consistent with [ADR-0001](../adr/ADR-0001.md) and [ADR-0003](../adr/ADR-0003.md). Dedicated database, schema, or region placement can be introduced as a future isolation tier after OQ-02 is resolved in [../decision-log.md](../decision-log.md).

Every tenant-owned foreign-key relationship must either include `tenant_id` on both sides or be validated by an equivalent database/domain invariant. IDs exposed through APIs are opaque public identifiers; internal storage keys are not used for cross-tenant lookup.

## Audit columns

Mutable domain/configuration tables should include:

- `id`
- `tenant_id` when tenant-owned
- `public_id` or domain reference when exposed outside the database
- `created_at`, `created_by_actor_id`, `created_by_actor_type`
- `updated_at`, `updated_by_actor_id`, `updated_by_actor_type`
- `deleted_at`, `deleted_by_actor_id`, `delete_reason` when soft deletion applies
- `version`
- `correlation_id` for material changes where useful

Append-only tables such as audit events, outbox events, provider attempts, and workflow execution records do not use mutable update columns except monotonic state transition metadata.

## Scale posture

NFR-03 in [../15-non-functional-requirements.md](../15-non-functional-requirements.md) sets an ambitious baseline. Designs must assume tenant skew, high-cardinality tickets, large audit history, attachment growth, outbox bursts, and long retention windows. The indexing and migration documents define minimum strategies; implementation must validate them with [../16-testing-quality.md](../16-testing-quality.md) performance suites before committing production scale.
