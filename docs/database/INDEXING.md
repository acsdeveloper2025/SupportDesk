# Indexing strategy

Indexes must support tenant isolation, queue performance, auditability, and future scale. Exact syntax is implementation-specific and intentionally omitted.

## Required patterns

- Every tenant-owned table has a leading `tenant_id` access path for common lookups.
- Public API lookups use `(tenant_id, public_id)` or `(tenant_id, public_ref)`, not global sequential identifiers.
- Foreign-key relationships used in joins have supporting indexes on the referencing columns.
- Active-record queries include lifecycle/status columns in composite indexes where selectivity justifies it.
- Large append-only tables support time-window queries and retention scans.

## Core composite indexes

| Area               | Suggested access path                                                                                                                                                                                                                                    | Purpose                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Tenant lookup      | `tenants(slug)`                                                                                                                                                                                                                                          | Routing and administration.                   |
| Membership         | `user_roles(tenant_id, user_id, revoked_at)` for M2; future `tenant_memberships(tenant_id, user_id, status)` when richer memberships ship                                                                                                                | Authentication and authorization.             |
| Roles              | `role_permissions(tenant_id, role_id, permission_id, scope)`                                                                                                                                                                                             | Permission evaluation.                        |
| Groups             | `group_memberships(tenant_id, group_id, membership_id)`                                                                                                                                                                                                  | Assignment and scoped queues.                 |
| Ticket reference   | `tickets(tenant_id, public_ref)`                                                                                                                                                                                                                         | Stable ticket lookup.                         |
| Agent queue        | `tickets(tenant_id, assigned_agent_id, status, priority, updated_at)`                                                                                                                                                                                    | Agent workload views.                         |
| Group queue        | `tickets(tenant_id, assigned_group_id, status, priority, sla_due_at)`                                                                                                                                                                                    | Group triage.                                 |
| Ticket list/sort   | `tickets(tenant_id, created_at)`, `(tenant_id, updated_at)`, `(tenant_id, due_date)`, `(tenant_id, priority)`, `(tenant_id, assigned_group_id)`                                                                                                          | List/search filter and sort paths.            |
| Ticket text search | GIN trigram on `tickets.public_ref`, `tickets.title`, `tickets.description` (pg_trgm)                                                                                                                                                                    | Case-insensitive partial search (`#24`).      |
| SLA risk           | `sla_targets(tenant_id, state, due_at)`                                                                                                                                                                                                                  | Breach warning and dashboard jobs.            |
| Comments           | `comments(tenant_id, ticket_id, created_at)`                                                                                                                                                                                                             | Timeline rendering.                           |
| Attachments        | `attachments(tenant_id, ticket_id, scan_state, created_at)`                                                                                                                                                                                              | Quarantine and ticket access.                 |
| Audit              | `audit_events(tenant_id, action, instant)` and `audit_events(tenant_id, target_type, target_id, instant)`                                                                                                                                                | Investigation and export.                     |
| Auth tokens        | `auth_tokens(tenant_id, user_id, purpose, state)` and `auth_tokens(expires_at)`                                                                                                                                                                          | Verification/recovery token lifecycle.        |
| Outbox             | `outbox_events(state, available_at, tenant_id)`                                                                                                                                                                                                          | Worker claiming and backlog visibility.       |
| Notifications      | `notifications(tenant_id, recipient_user_id, created_at)`, `notifications(tenant_id, recipient_user_id, read_at)`, `notification_preferences(tenant_id, user_id, event_type, channel)` unique, `notification_intents(tenant_id, state, next_attempt_at)` | In-app inbox, preferences, retry/suppression. |
| Email              | `email_messages(tenant_id, provider_message_id)`                                                                                                                                                                                                         | Deduplication and threading.                  |
| Exports            | `export_jobs(tenant_id, requester_id, state, created_at)`                                                                                                                                                                                                | User export list and operations.              |
| Retention          | `retention_policies(tenant_id, data_class)` and time indexes on expirable rows                                                                                                                                                                           | Deletion/legal-hold processing.               |

## Unique constraints

Minimum uniqueness requirements:

- `tenants.slug`
- `tenant_domains.domain`
- `user_roles(tenant_id, user_id, role_id)` for M2 role assignment
- Future `tenant_memberships(tenant_id, user_id)` when richer membership administration ships
- `roles(tenant_id, name)`
- `groups(tenant_id, name)`
- `permissions.key`
- `auth_tokens.token_hash`
- `tickets(tenant_id, public_ref)`
- `comments(tenant_id, channel, provider_source_id)` when provider identity exists
- `attachments(tenant_id, storage_identity)`
- `workflow_versions(tenant_id, workflow_id, version_number)`
- `sla_policy_versions(tenant_id, sla_policy_id, version_number)`
- `business_schedule_versions(tenant_id, schedule_id, version_number)`
- `notification_template_versions(tenant_id, template_id, locale, version_number)`
- `idempotency_keys(tenant_id, actor_id, operation, key_hash)`

## Search indexes

Issue #24 (`E05-I09`) implements **authoritative PostgreSQL search** against ticket tables (not a projection). Trigram GIN indexes accelerate `ILIKE` partial matches under tenant filters. Future external search engines (Epic 14) remain projections that must reauthorize against source data as required by [../06-tenant-isolation.md](../06-tenant-isolation.md).

Search indexes are projections, not authorities, when a dedicated search engine is later introduced. Index documents must include tenant key, resource type, resource ID, authorization scope hints, deletion state, source version, and indexed timestamp. Search results must be reauthorized against source data as required by [../06-tenant-isolation.md](../06-tenant-isolation.md).

## Reporting indexes and aggregates

Reports should prefer bounded, tenant-scoped aggregate tables or materialized projections over scanning transactional ticket history. Aggregates must retain source version/watermark, rebuild procedure, and authorization rules. Cross-tenant operational aggregates may use pseudonymous tenant keys only after privacy review.

## Index lifecycle

Index additions and removals follow [MIGRATION-STRATEGY.md](MIGRATION-STRATEGY.md). Large indexes must be created online where supported, monitored for lock and replication impact, and validated before old access paths are removed.
