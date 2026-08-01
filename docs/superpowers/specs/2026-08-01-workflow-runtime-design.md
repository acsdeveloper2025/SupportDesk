# E11-I03 — Workflow Runtime & Transactional Outbox

**Status:** Approved for implementation planning  
**Date:** 2026-08-01  
**Issue:** E11-I03 (workflow execution engine)  
**Related:** E11-I01 (definition), E11-I02 (validation & governance), E08-I01 (notification intents, minimal in-scope), ADR-0007 (outbox deferral lifted by this design), decision-log ADR-004  
**Depends on:** E11-I02 merged; Ticket Module + SLA engine baselines

## Goal

Run deterministic, tenant-scoped Workflow automation from durable domain events: transactional outbox, async worker pipeline, ordered actions, retries, dead-lettering, recursion limits, execution history, and minimal notification intents. **Provider email/SMS delivery remains deferred.**

## Non-goals (explicit deferrals)

| Deferred to     | Items                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| Later E08       | Notification provider workers, templates routing depth, digests              |
| E11-I04 / later | Visual builder, webhooks, custom scripts, schedules, complex branching/loops |
| Later ops       | Full multi-region outbox, sub-100ms automation UX, parallel action execution |
| Product UI      | Rich execution debugger beyond admin list + ticket timeline summaries        |

## Decisions locked (design session)

1. **Packaging:** Bundle transactional outbox + workflow runtime in one E11-I03 milestone (Option A).
2. **Execution model:** Fully async — request path commits domain + audit + outbox only (Option A).
3. **Recursion:** Depth-budget chain via `automationDepth`; platform hard max 3; tenant may only lower (Option A).
4. **Action transactions:** One DB transaction per action; resume from `workflow_action_attempts` (Option A).
5. **Notifications:** Minimal `notification_intents` + dedupe in-scope; no provider send (Option A).
6. **Retry/failure:** Bounded retries → dead-letter + audit/ops intent; optional failure-threshold auto-pause (Option A).
7. **SLA actions:** In-process calls to existing SLA module inside the action TX (Option A).
8. **Topology:** Shared `outbox_events` + single dispatcher worker with typed handlers (Approach 1).

## Architecture

```text
API / SLA job / prior workflow action
  └─ TX: domain + audit_events + outbox_events(PENDING)
        ↓
Outbox claimer (SKIP LOCKED + lease)
  └─ Dispatcher → WorkflowRuntime (primary consumer in E11-I03)
        ↓
Match enabled + published workflows by trigger (priority ASC)
  └─ workflow_executions (deduped)
        ↓
Condition AND-eval on event snapshot
  └─ For each action ordinal:
        TX: domain service + audit + child outbox(depth+1)
            + notification_intents (if applicable)
            + workflow_action_attempts SUCCEEDED
```

New / extended Nest areas (illustrative):

```text
apps/api/src/
  outbox/           # schema access, publisher, claimer, admin replay
  workflows/
    runtime/        # dispatcher hook, matcher, condition eval, executor
    domain/         # pure evaluators (no Prisma)
```

- Domain evaluators must not depend on Prisma, Nest, or HTTP.
- Action executors call existing ticket/comment/SLA services with an `AutomationActor` + tenant context.
- Fail closed on missing tenant context.

---

## 1. Event model

### Domain event types (outbox `eventType`)

| eventType                      | Producer              | Snapshot includes                                     |
| ------------------------------ | --------------------- | ----------------------------------------------------- |
| `ticket.created`               | ticket create         | ticket fields needed for conditions + `ticketVersion` |
| `ticket.status_changed`        | status transition     | `fromStatus`, `toStatus`, ticket snapshot + version   |
| `ticket.assigned`              | assignee/group change | before/after assignee/group + snapshot                |
| `comment.added`                | comment create        | comment id, visibility, author, ticket snapshot       |
| `sla.warning` / `sla.breached` | SLA engine            | ticket id, target type, policy/version refs, snapshot |

### Outbox row (conceptual)

| Field                                       | Notes                                                              |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `id`, `tenantId`                            | UUID; tenant on every query                                        |
| `eventType`, `aggregateType`, `aggregateId` | Routing + ops                                                      |
| `dedupeKey`                                 | Unique per `(tenantId, dedupeKey)`                                 |
| `payload`                                   | Immutable JSON snapshot — matching source of truth                 |
| `correlationId`, `causationId`              | Chain tracing                                                      |
| `automationDepth`                           | `0` for user/API/SLA-timer; `+1` per workflow-produced event       |
| `state`                                     | `PENDING` → `CLAIMED` → `PROCESSED` \| `FAILED` \| `DEAD_LETTERED` |
| `availableAt`, `attemptCount`               | Backoff schedule                                                   |
| `leaseOwner`, `leaseExpiresAt`              | Claim lease                                                        |
| `lastError`                                 | Safe error class/message                                           |
| `createdAt`, `processedAt`                  | UTC                                                                |

**Matching:** enabled workflows whose active published version triggers include `eventType`, sorted by container `priority` ascending. Conditions evaluate the **snapshot**, not a live re-read. Action executors load current aggregate state when mutating.

**v1 non-events:** webhooks, schedules, custom scripts.

---

## 2. Runtime execution pipeline

1. Mutation TX appends `outbox_events` (`PENDING`, depth N).
2. Claimer leases a batch (`FOR UPDATE SKIP LOCKED`).
3. If `automationDepth >= cap` → audit/skip reason, mark outbox `PROCESSED` (no workflow eval). Domain write already committed.
4. Else load matching workflows; for each in priority order:
   - Insert `workflow_executions` with unique `(tenantId, outboxEventId, workflowVersionId)`; on conflict skip.
   - Evaluate AND conditions → `SKIPPED_CONDITIONS` or continue.
   - For each action by ordinal: skip if attempt `SUCCEEDED`; else execute in own TX; retry/dead-letter per §5.
   - Finalize execution state: `SUCCEEDED` \| `PARTIAL_FAILED` \| `FAILED` \| `DEAD_LETTERED`.
5. Mark outbox `PROCESSED` when dispatcher finishes (execution failures live on execution/attempt rows).

**Ordering:** sequential workflows per event; sequential actions per workflow. No parallel actions in v1.

**Actor:** `AutomationActor` (system principal) with tenant context; transition legality and tenant isolation still enforced; no arbitrary RBAC elevation beyond automation-allowed actions.

---

## 3. Transaction boundaries

| Boundary             | Inside one DB TX                                                                              | Outside                               |
| -------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------- |
| Originating mutation | Domain + `audit_events` + `outbox_events`                                                     | All workflow work                     |
| Outbox claim         | Lease/state for claimed rows                                                                  | Handler body                          |
| One workflow action  | Domain mutation + audit + child outbox + attempt → `SUCCEEDED` (+ intent row if notification) | Other actions/workflows; provider I/O |
| Dead-letter finalize | Attempt terminal state + `workflow.execution_failed` audit + ops intent + optional auto-pause | —                                     |

**Rules:**

- Never hold a TX across external I/O.
- Mid-workflow crash: resume at first non-`SUCCEEDED` attempt.
- Outbox `PROCESSED` ≠ all actions succeeded; it means delivered to runtime.

---

## 4. Transactional outbox design

Fulfills decision-log **ADR-004**. Implementation **lifts ADR-0007 deferral** (does not weaken the target).

- Shared `OutboxPublisher.append` used only inside existing Prisma transactions.
- Claim: `state='PENDING' AND available_at <= now()` OR expired `CLAIMED` lease; backoff on retryable handler failure; max attempts → `DEAD_LETTERED`.
- E11-I03 producers: tickets, comments, SLA warning/breach, workflow action mutations.
- E11-I03 consumer: workflow dispatcher. Provider notification consumer deferred.
- Admin: backlog summary + replay endpoint per `docs/api/admin.md`.
- Publish idempotency: unique `(tenant_id, dedupe_key)`.

---

## 5. Retry / failure strategy

| Layer                      | Default max | Terminal               | Effects                         |
| -------------------------- | ----------- | ---------------------- | ------------------------------- |
| Outbox delivery            | 8           | `DEAD_LETTERED`        | Admin replay                    |
| Action attempt (transient) | 5           | `DEAD_LETTERED`        | Audit + ops notification intent |
| Permanent / validation     | 0 retries   | `FAILED` / dead-letter | Same                            |

- Backoff: exponential + jitter; lease reclaim for stuck `CLAIMED`.
- **Auto-pause threshold:** ≥ K dead-lettered executions in window W (defaults K=10, W=1h) → pause workflow (`enabled=false`, reason `auto_paused_failure_threshold`) + audit `workflow.paused`.
- Never silently skip a matched workflow/action — record outcome always.

---

## 6. Idempotency

| Layer                | Dedupe                                                                         |
| -------------------- | ------------------------------------------------------------------------------ |
| Outbox publish       | `(tenantId, dedupeKey)`                                                        |
| Execution            | `(tenantId, outboxEventId, workflowVersionId)`                                 |
| Action attempt       | `(tenantId, executionId, ordinal)` — never re-apply `SUCCEEDED`                |
| Domain from actions  | Ticket `version` + action key `wf:{executionId}:action:{ordinal}:{actionType}` |
| Notification intents | `(tenantId, event/source id, recipient, channel, template/eventType)`          |

**Guarantee:** at-least-once delivery; exactly-once _effects_ via dedupe (not exactly-once delivery).

---

## 7. Recursion protection

- `automationDepth = 0` for user/API/SLA-timer events; `parent+1` for workflow-produced outbox events.
- Stable `correlationId`; `causationId` = parent event id.
- Platform hard max **3**; tenant may configure only a lower cap.
- On cap: mutation still commits; child outbox still written; dispatcher skips workflow eval; audit `workflow.automation_depth_capped` (or equivalent skip reason).
- Safety valves: max actions/version (I02), max **50** workflows evaluated per event, catalog-only actions (no custom code).

---

## 8. Execution history

### `workflow_executions`

- Links: `outboxEventId`, `workflowId`, `workflowVersionId` / number, `triggerEventType`, `priority`, `automationDepth`
- `conditionResult` compact trace; `state` ∈ `RUNNING` \| `SUCCEEDED` \| `SKIPPED_CONDITIONS` \| `FAILED` \| `PARTIAL_FAILED` \| `DEAD_LETTERED` \| `SKIPPED_DEPTH_CAP`
- Timestamps + safe error fields
- Unique `(tenantId, outboxEventId, workflowVersionId)`

### `workflow_action_attempts`

- `ordinal`, `actionType`, `paramsSnapshot`
- `state` ∈ `PENDING` \| `RUNNING` \| `SUCCEEDED` \| `FAILED` \| `DEAD_LETTERED`
- `attemptNumber`, timestamps, safe errors, optional result refs (`commentId`, `notificationIntentId`, …)
- Unique `(tenantId, executionId, ordinal)`

**Visibility:** ticket timeline summaries; admin filters; audit for failures/pause/depth-cap. Append-only outcomes.

---

## 9. Performance characteristics

| Metric                         | E11-I03 engineering target                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| API overhead for outbox append | ≤ ~5ms p99 added (same TX; no inline workflow)                                               |
| Claim → runtime start          | ≤ 1s p50 / ≤ 5s p99 nominal                                                                  |
| Workflows evaluated / event    | Cap 50                                                                                       |
| Worker defaults                | Batch 20, poll ~500ms; scale out with `SKIP LOCKED`                                          |
| Indexes                        | Outbox `(state, available_at, tenant_id)`; executions `(tenant_id, workflow_id, started_at)` |

- Optional per-tenant claim soft quota per poll for noisy-neighbor control.
- Ops signals: backlog depth + oldest `PENDING` age (feeds later E12 health dashboard).
- Non-goals: sub-100ms UX, exactly-once delivery, parallel actions, multi-region outbox.

---

## Action catalog runtime behavior

| Action                   | Behavior in E11-I03                                                          |
| ------------------------ | ---------------------------------------------------------------------------- |
| `change_status`          | Ticket service transition + audit + outbox `ticket.status_changed` (depth+1) |
| `assign`                 | Ticket assign service + audit + outbox `ticket.assigned`                     |
| `add_internal_comment`   | Comment create (internal) + audit + outbox `comment.added`                   |
| `create_notification`    | Insert deduped `notification_intents` only (no provider)                     |
| `sla_start` / `sla_stop` | In-process SLA module within action TX                                       |

---

## Testing (required)

- **Unit:** condition evaluator, depth cap, priority ordering, action ordinal resume.
- **Integration (Postgres):** outbox append atomic with ticket write; claim/lease/backoff; dedupe execution/action; retry then dead-letter; cascade depth cap; notification intent dedupe; tenant isolation negatives; auto-pause threshold.
- **Replay:** duplicate outbox delivery produces no duplicate domain effects.
- **Contract:** admin outbox list/replay shapes.
- **Not in E11-I03:** provider email send E2E; visual builder.

## Documentation updates (same implementation PR)

- `docs/adr/ADR-0009.md` (this decision set) + `docs/adr/README.md` + `docs/decision-log.md`
- Note ADR-0007 deferral lifted by ADR-0009
- `docs/database/TABLES.md` / `INDEXING.md` as needed for outbox/execution columns
- `docs/api/admin.md` outbox endpoints as implemented
- `docs/audit-events.md` — `workflow.execution_failed`, depth-capped, etc.
- `docs/notification-events.md` / intents notes
- `docs/09-ticket-lifecycle.md` / `workflow-matrix.md` — execution now live
- `docs/ready-for-workflow-engine.md` status update

## Acceptance criteria

- [ ] Material ticket/comment/SLA warning-breach writes append outbox atomically with domain + audit.
- [ ] Worker claims outbox with lease, backoff, and dead-letter.
- [ ] Matching published/enabled workflows run async in priority order with AND conditions on snapshots.
- [ ] Actions run ordered, one TX each, idempotent under replay.
- [ ] `create_notification` creates deduped intents without provider send.
- [ ] `sla_start` / `sla_stop` call SLA module in-process.
- [ ] Recursion depth capped; capped paths audited; domain writes not rolled back solely due to cap.
- [ ] Execution + action attempt history recorded; failures audited; optional auto-pause works.
- [ ] Admin outbox backlog + replay available.
- [ ] Tenant isolation + authorization fail-closed tests pass.
- [ ] Docs/ADR/decision-log updated; ADR-0007 deferral marked lifted.

## Open questions (non-blocking)

- Exact default K/W for auto-pause may be tuned during implementation tests.
- Whether ticket timeline shows full attempt detail or summary-only in v1 UI (API can expose both).
