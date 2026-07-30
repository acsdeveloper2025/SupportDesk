# Tenant isolation

The Tenant is the non-negotiable ownership boundary. Users may have multiple Tenant Memberships but every request selects exactly one Tenant context.

| Control               | Requirement                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| TEN-01 Context        | Resolve Tenant context from authenticated membership and trusted routing, never an unverified body field. Propagate it in typed context.             |
| TEN-02 Data           | Every Tenant-owned entity includes immutable `tenant_id`; uniqueness and relationships include or verify it. Shared tables are allow-listed.         |
| TEN-03 Access         | The data-access layer injects Tenant predicates and database-level enforcement is required where supported. Elevated paths are separate and audited. |
| TEN-04 Async          | Messages carry Tenant, correlation, schema version, and deduplication identity; consumers revalidate scope.                                          |
| TEN-05 Derived stores | Cache and search keys/index filters namespace Tenant; result authorization is rechecked at the source of truth.                                      |
| TEN-06 Files          | Object keys and signed access are Tenant-scoped, short-lived, purpose-bound, and authorized against the Ticket.                                      |
| TEN-07 Operations     | Logs, metrics, traces, exports, backups, restores, and support tooling prevent content mixing and enforce least privilege.                           |
| TEN-08 Lifecycle      | Provision, suspend, export, retention, and deletion are state machines with audit evidence and failure recovery.                                     |

## Negative acceptance criteria

For each resource and role, tests attempt guessed IDs, altered Tenant headers, foreign relationships, cross-Tenant search terms, reused signed URLs, poisoned cache keys, forged jobs, export filters, and operator paths. All must deny without revealing existence. Property tests generate multiple Tenants and prove every returned or mutated owned entity matches context. Restore drills validate one Tenant cannot be restored into another identity.

Dedicated database or region placement is a future isolation tier, not assumed; see OQ-02 in the [decision log](decision-log.md).
