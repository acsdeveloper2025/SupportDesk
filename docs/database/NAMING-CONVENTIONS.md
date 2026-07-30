# Database naming conventions

These conventions keep schema, API, documentation, and logs aligned with [../glossary.md](../glossary.md).

## General

- Use lowercase `snake_case` for tables, columns, constraints, and indexes.
- Use plural table names: `tickets`, `comments`, `audit_events`.
- Use singular domain names in prose and API schemas: Ticket, Comment, Audit Event.
- Use `_id` suffix for internal identifiers and `_ref` for human-facing references.
- Use `_at` suffix for UTC instants and `_date` only for calendar dates without time.
- Use `_state` for lifecycle state machines and `_status` for user-facing domain statuses when the glossary already uses status.

## Identifiers

| Name                  | Meaning                                                               |
| --------------------- | --------------------------------------------------------------------- |
| `id`                  | Internal primary key.                                                 |
| `tenant_id`           | Immutable tenant ownership key.                                       |
| `public_id`           | Opaque stable API identifier where separate from `id`.                |
| `public_ref`          | Human-visible tenant-scoped reference such as ticket number.          |
| `external_id`         | Identifier from a trusted external system, always scoped by provider. |
| `provider_message_id` | Email/provider message identity for deduplication.                    |
| `correlation_id`      | End-to-end request/event trace identifier.                            |

## Standard columns

Mutable aggregate roots:

- `created_at`
- `created_by_actor_id`
- `created_by_actor_type`
- `updated_at`
- `updated_by_actor_id`
- `updated_by_actor_type`
- `deleted_at`
- `deleted_by_actor_id`
- `delete_reason`
- `version`

Append-only records:

- `occurred_at` for domain/audit event time
- `recorded_at` for persistence time when different
- `state_changed_at` for monotonic processing records

## Enums

Enum values use lowercase stable tokens, matching [../13-rest-conventions.md](../13-rest-conventions.md). Never reuse an enum value with changed meaning. Deprecate old values before removal and preserve compatibility for stored history.

Examples:

- Ticket status: `new`, `open`, `pending`, `on_hold`, `solved`, `closed`
- Processing state: `pending`, `processing`, `retrying`, `succeeded`, `failed`, `dead_lettered`
- Attachment scan state: `pending`, `scanning`, `clean`, `infected`, `blocked`, `failed`

## Constraint and index names

Use descriptive names:

- Primary key: `pk_<table>`
- Foreign key: `fk_<table>__<referenced_table>__<column>`
- Unique: `uq_<table>__<columns>`
- Check: `ck_<table>__<rule>`
- Index: `idx_<table>__<columns_or_purpose>`

When names become too long for a database engine, abbreviate only after preserving readability in documentation.

## Tenant consistency

Tenant-owned foreign keys should make tenant consistency obvious in naming and constraints. A relationship from `comments` to `tickets` should demonstrate that both rows share the same `tenant_id`. If the database cannot enforce a composite relationship directly, the domain layer and migration validation must compensate, and the exception must be documented.
