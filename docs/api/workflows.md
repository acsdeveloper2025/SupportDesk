# Workflows API

Related: [../09-ticket-lifecycle.md](../09-ticket-lifecycle.md), [../workflow-matrix.md](../workflow-matrix.md), [../adr/ADR-0010.md](../adr/ADR-0010.md), [../adr/ADR-0011.md](../adr/ADR-0011.md), [../permissions-matrix.md](../permissions-matrix.md).

Implemented through **E11-I02** (definition + validation/governance). **Execution** remains **Deferred** to E11-I03.

| Method / URI                                                    | Authentication        | Authorization      | Request                                                                                | Response                                                                   | Validation                                           | Errors                                       | Page/filter/sort | Rate limit         | Example                     | Status      |
| --------------------------------------------------------------- | --------------------- | ------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------- | ---------------- | ------------------ | --------------------------- | ----------- |
| `GET /api/v1/workflows`                                         | Active tenant session | `workflow.read`    | None                                                                                   | Workflow list                                                              | Excludes soft-deleted                                | `AUTH_FORBIDDEN`                             | None             | Normal read        | Admin workflow list.        | Implemented |
| `GET /api/v1/workflows/{workflow_id}`                           | Active tenant session | `workflow.read`    | None                                                                                   | Workflow + versions                                                        | Same tenant                                          | `NOT_FOUND`, `AUTH_FORBIDDEN`                | None             | Normal read        | Open workflow detail.       | Implemented |
| `GET /api/v1/workflows/{workflow_id}/versions/{from}/diff/{to}` | Active tenant session | `workflow.read`    | Path version numbers                                                                   | Diff (`fromVersion`, `toVersion`, `generatedAt`, `changeCount`, `changes`) | Immutable JSON snapshots                             | `NOT_FOUND`, `VALIDATION_FAILED`             | None             | Normal read        | Compare v1 vs v2.           | Implemented |
| `POST /api/v1/workflows`                                        | Active tenant session | `workflow.create`  | `key`, `name`, `priority`, `triggers`, `actions`; optional `description`, `conditions` | Created draft                                                              | Draft structural + limits; unique key/priority       | `VALIDATION_FAILED`, `CONFLICT`              | None             | Sensitive mutation | Create routing workflow.    | Implemented |
| `PATCH /api/v1/workflows/{workflow_id}`                         | Active tenant session | `workflow.update`  | Optional draft fields                                                                  | Updated workflow                                                           | Draft auto-created when missing; published immutable | `NOT_FOUND`, `VALIDATION_FAILED`, `CONFLICT` | None             | Sensitive mutation | Edit draft triggers.        | Implemented |
| `POST /api/v1/workflows/{workflow_id}/validate`                 | Active tenant session | `workflow.read`    | Optional definition override                                                           | `WorkflowValidationReport` (`schemaVersion: 1`)                            | Full publish-grade validation                        | `NOT_FOUND`, `VALIDATION_FAILED`             | None             | Normal read        | Dry-run before publish.     | Implemented |
| `POST /api/v1/workflows/{workflow_id}/clone-draft`              | Active tenant session | `workflow.update`  | Optional `fromVersion`                                                                 | Workflow with new draft                                                    | Fails if draft exists                                | `NOT_FOUND`, `CONFLICT`                      | None             | Sensitive mutation | Clone published into draft. | Implemented |
| `POST /api/v1/workflows/{workflow_id}/publish`                  | Active tenant session | `workflow.publish` | None                                                                                   | Published workflow                                                         | Full validation gate; prior published retired        | `NOT_FOUND`, `VALIDATION_FAILED`             | None             | Sensitive mutation | Publish draft.              | Implemented |
| `POST /api/v1/workflows/{workflow_id}/pause`                    | Active tenant session | `workflow.pause`   | Optional `reason`                                                                      | Paused workflow                                                            | Must be enabled                                      | `NOT_FOUND`, `BUSINESS_RULE_FAILED`          | None             | Sensitive mutation | Pause faulty workflow.      | Implemented |
| `POST /api/v1/workflows/{workflow_id}/resume`                   | Active tenant session | `workflow.pause`   | None                                                                                   | Resumed workflow                                                           | Must be paused                                       | `NOT_FOUND`, `BUSINESS_RULE_FAILED`          | None             | Sensitive mutation | Resume after maintenance.   | Implemented |
| `DELETE /api/v1/workflows/{workflow_id}`                        | Active tenant session | `workflow.update`  | None                                                                                   | `204 No Content`                                                           | Soft delete                                          | `NOT_FOUND`, `AUTH_FORBIDDEN`                | None             | Sensitive mutation | Retire obsolete workflow.   | Implemented |

## Validation report

```json
{
  "schemaVersion": 1,
  "valid": false,
  "errors": [
    { "code": "WORKFLOW_CYCLE_RISK", "severity": "error", "path": "actions[0]", "message": "..." }
  ],
  "warnings": []
}
```

Issues are sorted by `path`, then `severity`, then `code`. Warnings never block publish.

## Definition catalog

Triggers: `ticket.created`, `ticket.status_changed`, `ticket.assigned`, `comment.added`, `sla.warning`, `sla.breached`.

Conditions: fields `status`, `priority`, `type`, `channel`, `tags`, `requester`, `assignee` ( `group` rejected until Organizations/Groups ); operators `eq`, `neq`, `in`, `not_in`, `contains`. Flat AND only.

Actions: `change_status`, `assign` (user only), `add_internal_comment`, `create_notification`, `sla_start`, `sla_stop`.

## Lifecycle semantics

- **Draft / Publish / Pause / Resume / Soft delete:** unchanged from E11-I01; publish now requires a valid full validation report.
- **Clone-draft:** copies an immutable version snapshot into `versionNumber = max+1` as `DRAFT`.
- **Diff:** compares stored JSON snapshots only.

## Deferred scope

| Milestone | Scope                                                                                                  | Status   |
| --------- | ------------------------------------------------------------------------------------------------------ | -------- |
| E11-I03   | Workflow execution engine: event matching, ordered action dispatch, deduplication, dead-letter, outbox | Deferred |
