# E11-I02 — Workflow Validation & Governance

**Status:** Approved for implementation planning  
**Date:** 2026-08-01  
**Issue:** E11-I02 (Workflow validation & governance)  
**Related:** E11-I01 (definition & versioning — complete), E11-I03 (runtime execution — deferred), E11-I04 (admin UI — deferred)  
**Depends on:** ADR-0010 (workflow definition MVP), ADR-0008 (reject group assignment), ticket lifecycle matrix, E11-I01 module on `feat/e11-i01-workflow-definition`

## Goal

Add a validation and governance layer so Workflow drafts can be dry-run validated and only published when structural, semantic, limit, and cycle-risk checks pass. Provide clone-draft and version-diff APIs. **This issue does not execute workflows.**

## Non-goals (explicit deferrals)

| Deferred to     | Items                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| E11-I03         | Event listeners, matching, action dispatch, outbox, queues, retries, dead-letter, execution history        |
| E11-I03 / later | Cross-workflow causal graphs beyond same-definition cycle risk; scheduled/webhook/email actions            |
| E11-I04 / later | Visual builder; condition grouping/NOT UI; multi-reviewer approval workflows; dashboards                   |
| Organizations   | Group membership refs as first-class (until Groups exist, group refs fail closed per ADR-0008)             |

## Decisions locked

1. **Approach:** Validation service + governance endpoints (not publish-only, not full governance platform).
2. **Reference policy (Option A):** Assignee/requester user IDs must exist and be active in-tenant; `groupId` / condition field `group` are **rejected** until Organizations/Groups ship.
3. **Branch:** `feat/e11-i02-workflow-validation` from current E11-I01 tip (stacked on PR #34 lineage).
4. **Publish gate:** Full validation must pass before a draft becomes `PUBLISHED`; fail closed with structured report.
5. **Create/update:** Keep fast structural + limit checks; full semantic/reference checks available via validate API and required at publish.
6. **Condition model:** Remain flat AND list (depth = 1). Nested/grouped condition trees are rejected if present.
7. **Cycle detection (MVP):** Same-definition cycle risk only (e.g. `ticket.status_changed` + `change_status` that can re-enter indefinitely via the transition graph). Cross-workflow recursion is **documented as deferred** (requires execution graph).
8. **Permissions:** Reuse I01 keys; no new permission keys. Validate/diff → `workflow.read`; clone-draft → `workflow.update`.
9. **New ADR:** ADR-0011 records I02 validation/governance semantics (does not renumber ADR-0010).

## Architecture

Extend `apps/api/src/workflows/`:

```text
workflows/
  domain/
    workflow-definition.ts          # existing structural catalog (keep)
    workflow-validation.ts          # pure report builders: limits, semantics, cycle risk
    workflow-validation.spec.ts
    workflow-diff.ts                # pure version JSON diff
    workflow-diff.spec.ts
  workflow-validation.service.ts    # Nest: DB-backed reference checks + orchestrates pure validators
  workflows.service.ts              # wire publish gate; clone-draft; validate; diff
  workflows.controller.ts           # new routes
  dto/…                             # report + clone + diff DTOs
```

- Pure validators must not import Prisma/Nest/HTTP.
- `WorkflowValidationService` may use Prisma/RBAC-adjacent user lookups for reference checks.
- No ticketing mutation hooks, no SLA engine execution, no outbox.

## Validation model

### Report shape

```ts
interface WorkflowValidationIssue {
  code: string;           // stable machine code
  severity: "error" | "warning";
  path: string;           // e.g. "actions[2].params.status"
  message: string;        // safe human message
}

interface WorkflowValidationReport {
  valid: boolean;         // true iff zero errors (warnings allowed)
  errors: WorkflowValidationIssue[];
  warnings: WorkflowValidationIssue[];
}
```

### Rule categories

| Category    | Rules                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Structural  | Required triggers/actions; catalog enums; unique ordinals; action param shapes; UUID format where IDs expected                        |
| Semantic    | Status/priority/type/channel enum values; `change_status` legality vs ticket transition matrix; trigger from/to status legality       |
| References  | User IDs in assign/requester/assignee conditions exist + active in tenant; **group refs → error `WORKFLOW_GROUP_UNSUPPORTED`**        |
| Limits      | Max triggers, conditions, actions; max definition serialized size; nesting depth ≤ 1 for conditions                                   |
| Cycle risk  | Detect same-definition loops that can re-fire via status-change triggers after `change_status` actions (error, not warning)           |
| Duplicates  | Duplicate trigger types with identical from/to; duplicate ordinals (already structural)                                               |

### Suggested stable codes

- `WORKFLOW_REQUIRED_FIELD`
- `WORKFLOW_UNKNOWN_TRIGGER` / `WORKFLOW_UNKNOWN_CONDITION` / `WORKFLOW_UNKNOWN_ACTION`
- `WORKFLOW_DUPLICATE_ORDINAL`
- `WORKFLOW_INVALID_PARAM`
- `WORKFLOW_ILLEGAL_TRANSITION`
- `WORKFLOW_UNKNOWN_USER`
- `WORKFLOW_GROUP_UNSUPPORTED`
- `WORKFLOW_LIMIT_EXCEEDED`
- `WORKFLOW_NESTING_UNSUPPORTED`
- `WORKFLOW_CYCLE_RISK`
- `WORKFLOW_INVALID_UUID`

### Limits (initial constants — document in ADR-0011)

| Limit                         | Value |
| ----------------------------- | ----- |
| Max triggers                  | 10    |
| Max conditions                | 25    |
| Max actions                   | 25    |
| Max definition JSON bytes     | 64 KiB|
| Max condition nesting depth   | 1     |

Tune only via ADR change + tests; do not invent runtime feature flags in I02.

### Publish behavior

1. Load draft definition.
2. Run full validation (structural + semantic + refs + limits + cycle).
3. If `valid === false`, abort transaction; return HTTP **400** with report body (and optional audit `workflow.publish` / `FAILURE`).
4. If valid, existing I01 publish transaction (retire prior published → publish draft → audit `workflow.published`).

### Create / PATCH behavior

- Continue calling structural + limit validators (fail fast).
- Do not require DB reference checks on every keystroke-equivalent PATCH (those run on validate/publish).

## Governance APIs

Add only these endpoints (document in `docs/api/workflows.md`):

| Method / URI | Authz | Behavior |
| ------------ | ----- | -------- |
| `POST /api/v1/workflows/{workflow_id}/validate` | `workflow.read` | Validate current draft (or optional body definition override for dry-run). Returns `WorkflowValidationReport`. No mutation. |
| `POST /api/v1/workflows/{workflow_id}/clone-draft` | `workflow.update` | Clone specified `versionNumber` (default: latest published, else latest version) into a new `DRAFT` at `max+1`. Fails if a draft already exists (`CONFLICT`). Audit `workflow.draft_cloned`. |
| `GET /api/v1/workflows/{workflow_id}/versions/{fromVersion}/diff/{toVersion}` | `workflow.read` | Structured diff of triggers/conditions/actions/metadata between two version numbers. |

Existing I01 routes remain; publish gains the validation gate. Version history remains available via `GET /workflows/{id}` (no separate history list unless already documented).

### Diff response (minimal)

```ts
{
  fromVersion: number;
  toVersion: number;
  changes: Array<{ path: string; change: "added" | "removed" | "changed"; before?: unknown; after?: unknown }>;
}
```

## Immutability & cloning

- Published and retired version JSON remain immutable.
- Clone copies triggers/conditions/actions JSON only; does not change container `key` / `priority` / `enabled`.
- PATCH auto-draft-from-latest (I01) stays; `clone-draft` is explicit and fails if draft exists (clearer than silent merge).

## RBAC & audit

| Event | When |
| ----- | ---- |
| `workflow.validated` | Successful validate API call (metadata: `valid`, errorCount). Optional on failure too with `outcome=FAILURE`. |
| `workflow.draft_cloned` | Clone-draft success (`fromVersion`, `toVersion`). |
| `workflow.published` | Unchanged success path. |
| Publish blocked | Prefer `outcome=FAILURE` audit with report codes summary (no huge payloads). |

Permissions: no new keys. Soft-deleted workflows remain hidden (same as I01).

## Data / migrations

- **No new tables required** for I02 MVP (reports are ephemeral API responses).
- If OpenAPI/DTO-only: no Prisma migration.
- Do not introduce `workflow_executions` or outbox tables.

## Documentation updates (same PR)

- `docs/api/workflows.md` — mark I02 APIs Implemented; update deferred table
- `docs/adr/ADR-0011.md` + README + decision-log
- `docs/errors.md` — validation codes
- `docs/audit-events.md` — new actions
- `docs/09-ticket-lifecycle.md` / `docs/workflow-matrix.md` — note publish gate if needed
- CHANGELOG Unreleased

## Tests

| Layer | Coverage |
| ----- | -------- |
| Unit | Each rule category; group rejection; limit boundaries; cycle risk true/false; diff |
| Integration (Postgres) | Publish blocked on illegal transition / unknown user / group ref; validate API; clone-draft conflict; diff; tenant isolation |
| OpenAPI smoke | New paths present in generated docs string / swagger document |

## Quality gates

All must pass on the I02 branch:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm security:scan
pnpm run ci
```

## Out of scope reminder

Do **not** implement workflow runtime execution, background workers, transactional outbox, queues, email, webhooks, scheduled execution, or dashboard integration.

## Acceptance checklist

- [ ] Validation report returned from validate API and on failed publish
- [ ] Publish refuses invalid drafts (fail closed)
- [ ] Group refs rejected; user refs checked in-tenant
- [ ] Limits enforced
- [ ] Same-definition cycle risk detected
- [ ] Clone-draft and version diff work with RBAC + audit
- [ ] Published versions remain immutable
- [ ] Docs/OpenAPI/ADR-0011 updated
- [ ] Quality gates green
- [ ] Stop for approval before E11-I03

## Open implementation notes (non-blocking)

1. Exact HTTP status for validation failure: prefer **400 Bad Request** with report body for consistency with current Nest `BadRequestException` usage in workflows; document as `VALIDATION_FAILED` / business-rule style in `docs/errors.md`.
2. Ticket transition matrix source: reuse existing ticketing domain transition rules if present; otherwise encode the documented matrix once in `workflow-validation.ts` and cite `docs/workflow-matrix.md`.
