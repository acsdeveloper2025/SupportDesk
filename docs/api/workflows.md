# Workflows API

Related: [../09-ticket-lifecycle.md](../09-ticket-lifecycle.md), [../workflow-matrix.md](../workflow-matrix.md), [../adr/ADR-0010.md](../adr/ADR-0010.md), [../permissions-matrix.md](../permissions-matrix.md).

Implemented in E11-I01 (Workflow definition MVP). **Execution** (event evaluation, action dispatch, deduplication, dead-letter) is **Deferred** to E11-I03. **Deep validation** (reference checks, cycle detection, transition legality at publish) is **Deferred** to E11-I02. This slice stores draft/published workflow definitions with structural catalog validation only.

| Method / URI                                   | Authentication        | Authorization      | Request                                                                                | Response               | Validation                                                                   | Errors                                       | Page/filter/sort | Rate limit         | Example                   | Status      |
| ---------------------------------------------- | --------------------- | ------------------ | -------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------- | -------------------------------------------- | ---------------- | ------------------ | ------------------------- | ----------- |
| `GET /api/v1/workflows`                        | Active tenant session | `workflow.read`    | None                                                                                   | Workflow list          | Active membership; excludes soft-deleted                                     | `AUTH_FORBIDDEN`                             | None             | Normal read        | Admin workflow list.      | Implemented |
| `GET /api/v1/workflows/{workflow_id}`          | Active tenant session | `workflow.read`    | None                                                                                   | Workflow + versions    | Same tenant; not soft-deleted                                                | `NOT_FOUND`, `AUTH_FORBIDDEN`                | None             | Normal read        | Open workflow detail.     | Implemented |
| `POST /api/v1/workflows`                       | Active tenant session | `workflow.create`  | `key`, `name`, `priority`, `triggers`, `actions`; optional `description`, `conditions` | Created workflow draft | Structural catalog validation; unique key; unique priority among non-deleted | `VALIDATION_FAILED`, `CONFLICT`              | None             | Sensitive mutation | Create routing workflow.  | Implemented |
| `PATCH /api/v1/workflows/{workflow_id}`        | Active tenant session | `workflow.update`  | Optional `name`, `description`, `priority`, `triggers`, `conditions`, `actions`        | Updated workflow       | Draft auto-created from latest when missing; published versions immutable    | `NOT_FOUND`, `VALIDATION_FAILED`, `CONFLICT` | None             | Sensitive mutation | Edit draft triggers.      | Implemented |
| `POST /api/v1/workflows/{workflow_id}/publish` | Active tenant session | `workflow.publish` | None                                                                                   | Published workflow     | Draft required; prior published version retired                              | `NOT_FOUND`, `BUSINESS_RULE_FAILED`          | None             | Sensitive mutation | Publish draft.            | Implemented |
| `POST /api/v1/workflows/{workflow_id}/pause`   | Active tenant session | `workflow.pause`   | Optional `reason`                                                                      | Paused workflow        | Must be enabled                                                              | `NOT_FOUND`, `BUSINESS_RULE_FAILED`          | None             | Sensitive mutation | Pause faulty workflow.    | Implemented |
| `POST /api/v1/workflows/{workflow_id}/resume`  | Active tenant session | `workflow.pause`   | None                                                                                   | Resumed workflow       | Must be paused                                                               | `NOT_FOUND`, `BUSINESS_RULE_FAILED`          | None             | Sensitive mutation | Resume after maintenance. | Implemented |
| `DELETE /api/v1/workflows/{workflow_id}`       | Active tenant session | `workflow.update`  | None                                                                                   | `204 No Content`       | Soft delete; evidence retained                                               | `NOT_FOUND`, `AUTH_FORBIDDEN`                | None             | Sensitive mutation | Retire obsolete workflow. | Implemented |

## Definition catalog (structural validation)

Triggers: `ticket.created`, `ticket.status_changed`, `ticket.assigned`, `comment.added`, `sla.warning`, `sla.breached`.

Conditions: fields `status`, `priority`, `type`, `channel`, `tags`, `requester`, `group`, `assignee`; operators `eq`, `neq`, `in`, `not_in`, `contains`. All conditions are ANDed (E11-I02 may add grouping).

Actions: `change_status`, `assign`, `add_internal_comment`, `create_notification`, `sla_start`, `sla_stop`. Params validated per action type; no arbitrary code.

## Lifecycle semantics

- **Draft:** mutable `workflow_versions` row with `state=DRAFT`; definition stored as JSON on the version row.
- **Publish:** draft becomes `PUBLISHED`; previous published version becomes `RETIRED` (immutable history).
- **Pause:** sets `enabled=false` on the workflow container; does not retire published versions.
- **Resume:** clears pause flags; does not republish.
- **Soft delete:** sets `deleted_at`; hidden from ordinary reads; priority may be reused by another workflow.

Priority uniqueness is enforced in application logic among non-deleted workflows (no DB unique on priority alone).

## Deferred scope

| Milestone | Scope                                                                                          | Status   |
| --------- | ---------------------------------------------------------------------------------------------- | -------- |
| E11-I02   | Deep validation: reference integrity, cycle detection, transition legality at publish          | Deferred |
| E11-I03   | Workflow execution engine: event matching, ordered action dispatch, deduplication, dead-letter | Deferred |
