# Table catalogue

This catalogue defines intended tables and invariants. It is not SQL. Naming follows [NAMING-CONVENTIONS.md](NAMING-CONVENTIONS.md); indexing follows [INDEXING.md](INDEXING.md).

## Identity and tenant administration

| Table                 | Purpose                                                                                               | Primary key | Tenant key               | Key constraints                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------- | ----------- | ------------------------ | -------------------------------------------------------------------- |
| `tenants`             | Customer isolation boundary and lifecycle root.                                                       | `id`        | none                     | Unique `slug`; lifecycle state required.                             |
| `tenant_settings`     | Versioned tenant configuration such as branding, locale, security, quotas, and support access policy. | `id`        | `tenant_id`              | Unique active setting namespace/version per tenant.                  |
| `tenant_domains`      | Verified domains for tenant routing, email, and identity discovery.                                   | `id`        | `tenant_id`              | Unique domain globally; verification state required.                 |
| `users`               | Global human identity.                                                                                | `id`        | none                     | Unique verified email/identifier per identity provider policy.       |
| `sessions`            | User session/device state and revocation.                                                             | `id`        | optional selected tenant | Unique token family/hash; revocation and expiry required.            |
| `tenant_memberships`  | User access to one tenant.                                                                            | `id`        | `tenant_id`              | Unique `(tenant_id, user_id)`; status controls access.               |
| `roles`               | Tenant-scoped role definitions.                                                                       | `id`        | `tenant_id`              | Unique `(tenant_id, name)`; system roles protected.                  |
| `permissions`         | Stable global permission catalogue.                                                                   | `id`        | none                     | Unique `key`; never reused with changed meaning.                     |
| `role_permissions`    | Role-to-permission grants with scope.                                                                 | `id`        | `tenant_id`              | Unique `(tenant_id, role_id, permission_id, scope)`.                 |
| `membership_roles`    | Membership-to-role assignment.                                                                        | `id`        | `tenant_id`              | Same-tenant role and membership required.                            |
| `groups`              | Tenant-scoped team/department grouping.                                                               | `id`        | `tenant_id`              | Unique `(tenant_id, name)`.                                          |
| `group_memberships`   | Memberships inside groups.                                                                            | `id`        | `tenant_id`              | Unique `(tenant_id, group_id, membership_id)`.                       |
| `api_tokens`          | Machine/service access tokens.                                                                        | `id`        | `tenant_id`              | Token hashes only; expiry, scope, last use, and revocation required. |
| `operator_elevations` | Time-bound platform operator access to tenant metadata/content.                                       | `id`        | `tenant_id`              | Approval, purpose, scope, expiry, and audit linkage required.        |

## Ticketing

| Table                       | Purpose                                                            | Primary key | Tenant key  | Key constraints                                                                            |
| --------------------------- | ------------------------------------------------------------------ | ----------- | ----------- | ------------------------------------------------------------------------------------------ |
| `organizations`             | Optional requester/customer grouping inside a tenant.              | `id`        | `tenant_id` | Unique `(tenant_id, name)` or external reference.                                          |
| `tickets`                   | Canonical support aggregate root.                                  | `id`        | `tenant_id` | Unique `(tenant_id, public_ref)`; requester, channel, status, priority, version required.  |
| `comments`                  | Public/internal ticket messages.                                   | `id`        | `tenant_id` | Same-tenant ticket; immutable visibility after dispatch.                                   |
| `attachments`               | Uploaded or inbound files linked to comments/tickets.              | `id`        | `tenant_id` | Same-tenant ticket/comment; immutable hash/storage identity; scan state controls download. |
| `file_scan_results`         | Malware/content scan decisions and evidence.                       | `id`        | `tenant_id` | Same-tenant attachment; provider reference deduped.                                        |
| `ticket_links`              | Follow-up, duplicate, related, blocked-by, or split relationships. | `id`        | `tenant_id` | Both tickets same tenant; no self-link.                                                    |
| `ticket_watchers`           | Users/groups subscribed to ticket updates.                         | `id`        | `tenant_id` | Unique watcher target per ticket.                                                          |
| `ticket_assignment_history` | Append-only assignment evidence.                                   | `id`        | `tenant_id` | Same-tenant actor, ticket, agent/group; reason optional.                                   |
| `ticket_field_definitions`  | Tenant custom field configuration.                                 | `id`        | `tenant_id` | Unique key per tenant; type and validation immutable after use unless versioned.           |
| `ticket_field_values`       | Values for custom fields on tickets.                               | `id`        | `tenant_id` | Unique `(tenant_id, ticket_id, field_definition_id)`.                                      |
| `tags`                      | Tenant-scoped ticket tags.                                         | `id`        | `tenant_id` | Unique `(tenant_id, normalized_name)`.                                                     |
| `ticket_tags`               | Ticket-to-tag assignments.                                         | `id`        | `tenant_id` | Unique `(tenant_id, ticket_id, tag_id)`.                                                   |

## Configuration, automation, SLA, and notifications

| Table                            | Purpose                                            | Primary key | Tenant key  | Key constraints                                            |
| -------------------------------- | -------------------------------------------------- | ----------- | ----------- | ---------------------------------------------------------- |
| `workflows`                      | Draft/published workflow container.                | `id`        | `tenant_id` | Unique `(tenant_id, key)`.                                 |
| `workflow_versions`              | Immutable workflow rules/actions.                  | `id`        | `tenant_id` | Unique `(tenant_id, workflow_id, version_number)`.         |
| `workflow_executions`            | Evaluation record for event and workflow version.  | `id`        | `tenant_id` | Unique dedupe key for event/workflow version.              |
| `workflow_action_attempts`       | Ordered action attempt states.                     | `id`        | `tenant_id` | Monotonic terminal/retry state.                            |
| `business_schedules`             | Schedule container.                                | `id`        | `tenant_id` | Unique `(tenant_id, key)`.                                 |
| `business_schedule_versions`     | Immutable working hours/holiday definitions.       | `id`        | `tenant_id` | Unique `(tenant_id, schedule_id, version_number)`.         |
| `sla_policies`                   | SLA policy container.                              | `id`        | `tenant_id` | Unique `(tenant_id, key)`.                                 |
| `sla_policy_versions`            | Immutable SLA condition/target rules.              | `id`        | `tenant_id` | Unique priority per tenant/version set.                    |
| `sla_targets`                    | Active/historical response and resolution targets. | `id`        | `tenant_id` | Unique active target per ticket/type/application.          |
| `sla_evaluations`                | SLA selection/recalculation evidence.              | `id`        | `tenant_id` | References captured policy and schedule versions.          |
| `notification_templates`         | Template container.                                | `id`        | `tenant_id` | Unique `(tenant_id, key)`.                                 |
| `notification_template_versions` | Immutable localized template content.              | `id`        | `tenant_id` | Unique `(tenant_id, template_id, locale, version_number)`. |
| `notification_preferences`       | User/membership notification preferences.          | `id`        | `tenant_id` | Unique recipient/channel/event preference.                 |
| `notification_intents`           | Provider-neutral send intent.                      | `id`        | `tenant_id` | Unique dedupe key per recipient/channel/template/event.    |
| `notification_attempts`          | Provider send attempts and terminal state.         | `id`        | `tenant_id` | Provider event IDs unique where supplied.                  |
| `email_messages`                 | Inbound/outbound email metadata and threading.     | `id`        | `tenant_id` | Provider/message ID unique within channel.                 |

## Governance, operations, and projections

| Table                | Purpose                                            | Primary key | Tenant key  | Key constraints                                                      |
| -------------------- | -------------------------------------------------- | ----------- | ----------- | -------------------------------------------------------------------- |
| `audit_events`       | Immutable business/security evidence.              | `id`        | `tenant_id` | Append-only; actor, action, target, outcome, instant required.       |
| `outbox_events`      | Durable event publication and side-effect trigger. | `id`        | `tenant_id` | Unique event/deduplication key; monotonic processing state.          |
| `export_jobs`        | Async tenant-scoped exports and reports.           | `id`        | `tenant_id` | Requester, filters, format, state, expiry, and audit link required.  |
| `retention_policies` | Tenant/data-class retention configuration.         | `id`        | `tenant_id` | Unique data class per tenant/version.                                |
| `legal_holds`        | Preservation exceptions.                           | `id`        | `tenant_id` | Scope, authority, expiry/review date, and release evidence required. |
| `idempotency_keys`   | Mutation dedupe records.                           | `id`        | `tenant_id` | Unique `(tenant_id, actor_id, operation, key_hash)`.                 |
| `webhook_deliveries` | Future outbound webhook delivery state.            | `id`        | `tenant_id` | Dedupe and signature material references required.                   |

## Soft delete and retention

Soft deletion is a lifecycle state, not an authorization bypass. Soft-deleted records remain tenant-scoped, hidden from ordinary reads, visible through authorized audit/recovery flows, and excluded from active uniqueness only when policy explicitly permits key reuse. Legal hold overrides deletion. Retention jobs must record audit events and preserve referential integrity.
