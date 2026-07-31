# E11-I01 — Workflow Definition & Basic Publish

**Status:** Approved for implementation planning  
**Date:** 2026-07-31  
**Issue:** E11-I01 (Workflow draft/version model)  
**Related:** E11-I02 (validation & governance), E11-I03 (execution engine), E11-I04 (admin UI)  
**Depends on patterns from:** ADR-005 (versioned published configuration), Issue #26 SLA engine (`ConfigPublicationState`, draft/publish lifecycle)

## Goal

Let Tenant Admins create, edit, version, publish, pause, and soft-delete Workflows with a structurally validated definition model. Published versions are immutable and ready for a future execution engine. **This issue does not execute workflows.**

## Non-goals (explicit deferrals)

| Deferred to     | Items                                                                                                                                                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E11-I02         | Deep semantic validation; illegal state transitions; unknown field/reference checks; circular dependency / infinite-loop prevention; action & condition depth limits; version comparison API; draft cloning API; publish approval gate; validation reports |
| E11-I03         | Event listeners; trigger dispatcher; rule/condition evaluation; action execution; execution history; retries; failure handling; timeline integration; notifications from actions; SLA start/stop runtime                                                   |
| E11-I04 / later | Visual builder; webhooks; custom scripts; scheduled workflows; email/SMS actions; complex branching; loops                                                                                                                                                 |

## Decisions locked

1. **Issue split:** Implement E11-I01 / I02 / I03 as separate stages (not one collapsed MVP).
2. **I01 boundary (Option B):** Full draft/publish lifecycle with **basic structural validation** only. Publish is usable; safety hardening is I02.
3. **Catalog (Option A):** Full trigger / condition / action catalog is declared and stored now; never executed in I01.
4. **Storage (Option A):** JSON documents on `workflow_versions` for `triggers`, `conditions`, and `actions`.
5. **Pause model (Option C):** Container-level enable/pause plus version publish/retire. Pause does not mutate published version rows.
6. **Architecture (Approach 1):** Mirror the SLA config module shape; do not extract a shared versioned-config framework in this issue.

## Architecture

New NestJS module: `apps/api/src/workflows/`.

```text
workflows/
  workflows.module.ts
  workflows.controller.ts
  workflows.service.ts
  workflows.repository.ts
  dto/workflows.dto.ts
  domain/workflow-definition.ts      # types + pure structural validators
  domain/workflow-definition.spec.ts
```

- Domain validators must not depend on Prisma, Nest, or HTTP.
- No ticketing hooks, no SLA engine calls, no executor in I01.
- Base branch: `feat/issue-26-sla-engine` (reuse `ConfigPublicationState` and SLA publish patterns). If SLA merges to `main` first, branch from `main`.

## Data model

### `workflows` (container)

| Field                                 | Notes                                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `id`, `tenantId`                      | UUID; tenant isolation on every query                                                                               |
| `key`                                 | Unique per tenant (`VARCHAR(100)`)                                                                                  |
| `name`, `description`                 | Admin-facing                                                                                                        |
| `priority`                            | Integer; unique among non-deleted workflows in the tenant (same uniqueness spirit as published SLA policy priority) |
| `enabled`                             | Boolean; `false` when paused                                                                                        |
| `pausedAt`, `pausedReason`            | Set on pause; cleared on resume                                                                                     |
| `activeVersionNumber`                 | Nullable until first publish                                                                                        |
| `version`                             | Optimistic concurrency for container mutations                                                                      |
| `createdAt`, `updatedAt`, `deletedAt` | Soft delete                                                                                                         |

### `workflow_versions`

| Field                          | Notes                                                                  |
| ------------------------------ | ---------------------------------------------------------------------- |
| `id`, `tenantId`, `workflowId` | FKs with tenant cascade                                                |
| `versionNumber`                | Monotonic per workflow; unique `(tenantId, workflowId, versionNumber)` |
| `state`                        | `ConfigPublicationState`: `DRAFT` / `PUBLISHED` / `RETIRED`            |
| `triggers`                     | JSON array                                                             |
| `conditions`                   | JSON array                                                             |
| `actions`                      | JSON array (ordered)                                                   |
| `publishedAt`                  | Set when transitioning to `PUBLISHED`                                  |
| `createdAt`, `updatedAt`       | Draft rows remain mutable until publish                                |

### Lifecycle

1. **Create** → container + version `1` as `DRAFT`.
2. **PATCH** → update existing draft fields; if no draft exists, clone latest version into `versionNumber = latest + 1` as `DRAFT`, then apply edits.
3. **Publish** → require a draft; mark prior `PUBLISHED` versions `RETIRED`; set draft to `PUBLISHED` with `publishedAt`; set container `activeVersionNumber`.
4. **Pause** → `enabled=false`, set `pausedAt` / `pausedReason`; published version unchanged.
5. **Resume** → `enabled=true`, clear pause fields.
6. **Soft delete** → set `deletedAt`; hide from default lists; retain versions for audit/history.

Published version JSON is immutable after publish (no in-place edits).

## Definition catalog (stored, not executed)

### Triggers

At least one required. Allowed types:

- `ticket.created`
- `ticket.status_changed`
- `ticket.assigned`
- `comment.added`
- `sla.warning`
- `sla.breached`

Shape (illustrative): `{ "type": "ticket.created" }` or with optional filters reserved for later (`fromStatus` / `toStatus` only structurally typed if present).

### Conditions

Optional. Each condition:

- `ordinal` (unique non-negative int within the version)
- `field`: `status` | `priority` | `type` | `channel` | `tags` | `requester` | `group` | `assignee`
- `operator`: `eq` | `neq` | `in` | `not_in` | `contains` (tags) — enum-validated only
- `value`: JSON-compatible scalar or array matching operator shape at the schema level

I01 treats conditions as an **AND** list (document for I03). Combinators / nesting deferred to I02 depth limits if introduced later.

### Actions

At least one required. Ordered by unique `ordinal` (strict ascending, no duplicates).

| `type`                   | Params (structural)                                |
| ------------------------ | -------------------------------------------------- |
| `change_status`          | `status`                                           |
| `assign`                 | `assigneeUserId` and/or `groupId`                  |
| `add_internal_comment`   | `body`                                             |
| `create_notification`    | `eventType`, optional `recipient` hint             |
| `sla_start` / `sla_stop` | optional `targetType` (`response` \| `resolution`) |

Unknown types rejected. Param presence checked lightly (required keys exist and types look right); semantic legality (e.g. illegal transition) is I02.

## API

| Method   | Path                                      | Permission         |
| -------- | ----------------------------------------- | ------------------ |
| `GET`    | `/api/v1/workflows`                       | `workflow.read`    |
| `GET`    | `/api/v1/workflows/{workflow_id}`         | `workflow.read`    |
| `POST`   | `/api/v1/workflows`                       | `workflow.create`  |
| `PATCH`  | `/api/v1/workflows/{workflow_id}`         | `workflow.update`  |
| `POST`   | `/api/v1/workflows/{workflow_id}/publish` | `workflow.publish` |
| `POST`   | `/api/v1/workflows/{workflow_id}/pause`   | `workflow.pause`   |
| `POST`   | `/api/v1/workflows/{workflow_id}/resume`  | `workflow.pause`   |
| `DELETE` | `/api/v1/workflows/{workflow_id}`         | `workflow.update`  |

- List: containers with active/draft summary (not full version history).
- Get: container + ordered versions.
- Create/PATCH body includes name, description, priority, triggers, conditions, actions (PATCH partial; definition fields update the draft).
- Pause body: optional `reason`.
- Soft delete via `DELETE`.
- OpenAPI documented in `docs/api/workflows.md` and Nest Swagger decorators.

## RBAC

Seed and grant permissions per `docs/permissions-matrix.md`:

- `workflow.read`
- `workflow.create`
- `workflow.update`
- `workflow.publish`
- `workflow.pause`

Default: Tenant Admin can manage; Agents do not create/update/publish by default. Fail closed when tenant context or permission is uncertain.

## Audit

Emit append-only audit events (tenant-scoped):

| Action                   | When        |
| ------------------------ | ----------- |
| `workflow.created`       | Create      |
| `workflow.draft_updated` | Draft PATCH |
| `workflow.published`     | Publish     |
| `workflow.paused`        | Pause       |
| `workflow.resumed`       | Resume      |
| `workflow.deleted`       | Soft delete |

Update `docs/audit-events.md` for any new action keys beyond the existing `workflow.published` / `workflow.paused`. Defer `workflow.execution_failed` to I03.

## Basic validation (I01)

Reject with `VALIDATION_FAILED` when:

- Required fields missing (`key`, `name`, ≥1 trigger, ≥1 action)
- Trigger / condition field / operator / action type not in enum catalog
- Duplicate condition or action `ordinal`
- Action ordinals not a strict total order
- Malformed JSON shapes (wrong types for known params)
- Invalid `key` format (align with SLA/key conventions)

Reject with `CONFLICT` when:

- Duplicate `(tenantId, key)`
- Duplicate tenant `priority` among non-deleted workflows
- Optimistic concurrency mismatch on container `version`

Reject with `BUSINESS_RULE_FAILED` when:

- Publish with no draft
- Pause when already paused / resume when not paused

Reject with `NOT_FOUND` / `AUTH_FORBIDDEN` for missing tenant resources and denied RBAC.

## Testing

- **Unit:** `workflow-definition` structural validators (enums, required, ordinals, empty lists).
- **PostgreSQL integration:** create → edit draft → publish → new draft from published → second publish (prior published immutable & retired); pause/resume; soft delete; tenant isolation negatives; RBAC deny; audit row presence.
- **OpenAPI:** path/operation coverage for the new endpoints.
- **Not in I01:** execution, ticket event hooks, SLA runtime, deep semantic validation cases.

## Documentation updates (same PR)

- `docs/api/workflows.md` (new)
- `docs/api/README.md` (link)
- `docs/audit-events.md` (new action keys)
- `docs/decision-log.md` + short ADR for workflow definition MVP semantics (catalog, JSON storage, pause vs retire, AND conditions)
- `docs/database/TABLES.md` if column details need expansion beyond existing workflow table rows
- `docs/09-ticket-lifecycle.md` / `docs/workflow-matrix.md` only if wording must note “definition shipped; execution deferred”

## Acceptance criteria

- [ ] Admins can CRUD workflow containers and edit draft definitions under RBAC.
- [ ] Publish produces an immutable published version and retires the previous published version.
- [ ] Pause/resume toggles container enablement without altering published JSON.
- [ ] Soft delete hides workflows while retaining version history.
- [ ] Structural validation rejects invalid enums, empty triggers/actions, and duplicate ordinals.
- [ ] No runtime execution paths exist.
- [ ] Audit events recorded for create, draft update, publish, pause, resume, delete.
- [ ] OpenAPI + unit + PostgreSQL integration tests pass.
- [ ] Docs and ADR/decision-log updated.

## Implementation notes

- Prefer following SLA policy service flows for draft auto-create and publish transactions.
- Keep files small; put pure validation in `domain/`.
- Never expose Prisma entities directly in API responses; map to versioned DTOs.
- UTC timestamps only.
- Do not seed executable default workflows that mutate tickets in I01 (optional inert example is unnecessary unless useful for tests).
