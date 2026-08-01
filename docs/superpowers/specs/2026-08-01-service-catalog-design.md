# Module 2 — Enterprise ITSM Service Catalog Design Spec

**Status:** Approved for implementation planning
**Date:** 2026-08-01
**Module:** 2 (release `v1.2-service-catalog`)
**Related:** Module 1 Knowledge Base (`v1.1-knowledge-base`), E11-I01/I02/I03 (workflow definition, validation, runtime), E10 (SLA engine), E06 (notifications), E05-I08 (attachments), decision-log ADR-0004/ADR-0012 (transactional outbox)
**Depends on:** Module 1 merged; Workflow runtime + SLA engine + notifications + ticket platform baselines

## Goal

Deliver an enterprise ITSM Service Catalog: tenant-scoped service categories, Business/Technical services, a request catalog with dynamic request forms (validation + conditional fields), request templates, request lifecycle tracking with history, an approval-gate contract that future approval engines can plug into, workflow-engine integration through the transactional outbox, SLA policy mapping, Knowledge Base article suggestions, attachments, notifications, and ticket generation from service requests.

## Non-goals (explicit deferrals)

| Deferred to        | Items                                                                         |
| ------------------ | ----------------------------------------------------------------------------- |
| Future module      | External procurement, vendor ordering, purchase order / spend workflow        |
| Future module      | Billing / chargeback / cost center allocation / quotes                        |
| Future module      | Cloud provisioning or infrastructure orchestration                            |
| Future module      | AI / ML recommendations (catalog suggestions, content generation, routing)    |
| Later catalog work | Visual drag-and-drop form builder; version diffing of form schemas            |
| Later catalog work | Fulfillment task plans, assignment of fulfillment to groups, fulfillment SLAs |
| Later catalog work | Recurring / standing requests, scheduling (later workflow runtime schedules)  |

## Decisions locked (design session)

1. **Module packaging:** Self-contained `apps/api/src/catalog` module + `apps/web` pages, one milestone, tag `v1.2-service-catalog` (mirrors Module 1).
2. **Form schema:** Versioned JSON form schema stored on the Service (1:1 `service_request_forms`); validation and conditional-field visibility evaluated by a pure domain engine (`catalog/domain/form-engine.ts`) with no Prisma/Nest dependency.
3. **Approval contract:** Approval steps are modeled per Service; decisions flow through a narrow `ApprovalGate` interface (evaluate → decide → outcome). The built-in step engine implements that interface today; a future workflow-driven approval engine can replace it without touching request/fulfillment flows. Approval is a hard gate: requests enter `AWAITING_APPROVAL`, fulfillment cannot start before `APPROVED`.
4. **SLA mapping:** `ServiceItem.slaPolicyId` pins the SLA policy applied when a Ticket is generated from a request. Implemented as a new public `startTargetsForTicketWithPolicy` on `SlaEngineService` that resolves the published policy version + schedule and starts targets (reuses existing private target creation, no behavior change for existing callers).
5. **Ticket generation:** Explicit, idempotent operation per request (once per request); channel `web`, type/priority from Service defaults and request answers; generated Ticket is linked back on `ServiceRequest.ticketId`; SLA targets start through the pinned policy; `service_request.ticket_created` outbox event emitted in the same transaction.
6. **Events:** All request lifecycle transitions append outbox events (`service_request.*`) inside the same transaction as the domain mutation, so the workflow runtime (E11-I03) can trigger automation without new dispatcher code.
7. **KB suggestions:** Service carries `suggestedKbTags`; suggestions endpoint returns published articles matching tags/title keywords, tenant-scoped, with visibility guards (internal only for agent/manager roles). No AI ranking.
8. **Attachments:** Request attachments reuse the ticketing attachment pattern (local storage + validation + virus scanner) with a dedicated `service_request_attachments` table; attachment permissions are catalog-scoped.
9. **Retention of publication pattern:** Services and form versions use the existing `ConfigPublicationState` (`draft|published|retired`) with publish/retire endpoints like KB articles.
10. **No cross-Tenant leakage:** every repository query scoped by `tenantId`; fail closed on missing Tenant context; tenant-isolation negative tests included.

## Architecture

```text
apps/api/src/catalog/
  domain/                 # pure form engine: field validation, conditional visibility, status machine
  dto/                    # versioned request/response contracts (class-validator + swagger)
  catalog-categories.*    # ServiceCategory controller/service/repository
  catalog-services.*      # ServiceItem + form version + suggestions
  catalog-templates.*     # RequestTemplate
  catalog-requests.*      # ServiceRequest lifecycle, attachments, history, approvals, ticket generation
  catalog.module.ts
```

```text
Requester: POST /api/v1/catalog/requests  (answers against published form schema)
  └─ TX: ServiceRequest + history + audit + approval steps (if approvalRequired)
       + outbox(service_request.created / approval_started)
       └─ dispatcher → Workflow runtime (existing, eventType-driven)

Approver: POST /api/v1/catalog/requests/:id/approvals/:stepId/decide
  └─ TX: step decision + history + audit + outbox(service_request.approval_decided)
       → all approved (mode ALL) / first decision (mode ANY) → APPROVED

Fulfillment: POST /api/v1/catalog/requests/:id/fulfill → POST .../generate-ticket
  └─ TX: TicketsService.createTicket + SLA engine (pinned policy)
       + ServiceRequest.ticketId + history + audit + outbox(service_request.ticket_created)
```

## 1. Data model (PostgreSQL, all tables tenant-scoped)

### `ServiceCategory` (`service_categories`)

- `id`, `tenantId`, `parentId?` (self-hierarchy), `name`, `slug`, `description?`, `icon?`, `displayOrder`, `createdAt`, `updatedAt`.
- Constraints: unique `(tenantId, slug)`; parent FK onDelete SetNull; index `(tenantId, parentId)`; cycle prevention enforced in service layer (parent must not equal self or descendant).

### `ServiceItem` (`service_items`)

- `id`, `tenantId`, `categoryId`, `name`, `slug`, `description?`, `kind` (`BUSINESS | TECHNICAL`, enum `service_kind`), `state` (`ConfigPublicationState`, default DRAFT), `approvalMode` (`NONE | SINGLE | ALL | ANY`, default NONE), `approvalSteps` (Json, ordered `[{ordinal, approverRole?, approverUserId?}]`), `slaPolicyId?`, `defaultTicketType` (`TicketType`), `defaultPriority`, `suggestedKbTags` (Json string[]), `generateTicketOnFulfillment` (Boolean, default true), `publishedAt?`, `createdAt`, `updatedAt`, `deletedAt?` (soft delete).
- Constraints: unique `(tenantId, slug)`; FKs: category (Restrict), slaPolicy (SetNull); index `(tenantId, state, kind)`.

### `ServiceRequestForm` (`service_request_forms`) — 1:1 with ServiceItem

- `id`, `tenantId`, `serviceId` (unique), `formVersion` (Int, default 1), `schema` (Json), `createdAt`, `updatedAt`.
- `schema`: `{ fields: ServiceFormField[] }`.
- `ServiceFormField`: `key`, `label`, `type` (`TEXT | TEXTAREA | NUMBER | DATE | SELECT | MULTI_SELECT | RADIO | CHECKBOX | EMAIL | URL | FILE`), `helpText?`, `required` (bool), `options?` (for SELECT/MULTI_SELECT/RADIO), `validation?` (`{minLength?, maxLength?, pattern?, min?, max?, maxFiles?, maxFileSizeBytes?}`), `visibleWhen?` (`{fieldKey, operator (EQ | NEQ | CONTAINS | GTE | LTE), value}`).
- Updating a published form increments `formVersion` and requires `catalog.form.update`; requests always validate against the form version captured at submission (`submittedFormVersion` on the request).

### `RequestTemplate` (`request_templates`)

- `id`, `tenantId`, `serviceId?` (nullable → global), `name`, `description?`, `fieldValues` (Json), `isDefault` (bool), `createdById`, `createdAt`, `updatedAt`.
- Unique `(tenantId, serviceId?, name)` enforced in service layer.

### `ServiceRequest` (`service_requests`)

- `id`, `tenantId`, `requestRef` (public reference, e.g. `REQ-000001`, generated atomically in repository), `serviceId`, `serviceName` (snapshot), `serviceKind` (snapshot), `submittedFormVersion`, `answers` (Json), `requesterUserId`, `status` (`ServiceRequestStatus`), `priority`, `ticketId?`, `requestedForUserId?` (optional other person), `submittedAt`, `approvedAt?`, `fulfillmentStartedAt?`, `completedAt?`, `cancelledAt?`, `cancelledReason?`, `createdAt`, `updatedAt`.
- Constraints: unique `(tenantId, requestRef)`; unique `(tenantId, ticketId)` where ticketId not null; index `(tenantId, status, createdAt)`, `(tenantId, requesterUserId, createdAt)`.

### `ServiceRequestStatus` enum (`service_request_status`)

`SUBMITTED → AWAITING_APPROVAL → APPROVED → IN_FULFILLMENT → COMPLETED`; branches: `REJECTED` (from AWAITING_APPROVAL), `CHANGES_REQUESTED` (from AWAITING_APPROVAL → requester edits → resubmits → new approval cycle), `CANCELLED` (from SUBMITTED/AWAITING_APPROVAL/APPROVED).

### `ServiceRequestApproval` (`service_request_approvals`)

- `id`, `tenantId`, `requestId`, `stepNumber`, `approverRole?`, `approverUserId?`, `status` (`PENDING | APPROVED | REJECTED | CHANGES_REQUESTED`), `decidedByUserId?`, `decidedAt?`, `decisionComment?`, `createdAt`.
- Index `(tenantId, requestId)`; unique `(tenantId, requestId, stepNumber)`.

### `ServiceRequestAttachment` (`service_request_attachments`)

- `id`, `tenantId`, `requestId`, `fileName`, `originalName`, `mimeType`, `sizeBytes`, `storagePath`, `uploadedById`, `createdAt`.
- Index `(tenantId, requestId)`; FK request Cascade.

### `ServiceRequestHistory` (`service_request_history`)

- `id`, `tenantId`, `requestId`, `action` (audit-style key), `fromStatus?`, `toStatus?`, `actorUserId?`, `comment?`, `createdAt`.
- Index `(tenantId, requestId, createdAt)`.

## 2. Events (transactional outbox, `service_request.*`)

| eventType                             | Emitted on                                            | Snapshot includes                                    |
| ------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| `service_request.created`             | request submitted (no approval) / submitted+approvals | requestRef, serviceId, status, priority, answers ref |
| `service_request.approval_started`    | approval steps created                                | requestRef, mode, step count                         |
| `service_request.approval_decided`    | each step decision                                    | requestRef, stepNumber, decision, nextStatus         |
| `service_request.resubmitted`         | requester resubmits after changes requested           | requestRef, new approval cycle                       |
| `service_request.fulfillment_started` | approval passed, fulfillment begins                   | requestRef, ticketId?                                |
| `service_request.ticket_created`      | ticket generated from request                         | requestRef, ticketId, publicRef, slaPolicyId         |
| `service_request.completed`           | request completed                                     | requestRef, ticketId?                                |
| `service_request.cancelled`           | request cancelled                                     | requestRef, reason                                   |
| `service_request.changes_requested`   | approval step requests changes                        | requestRef, stepNumber                               |

All events carry `tenantId`, `correlationId` (from request), `automationDepth = 0` unless produced by a workflow action.

## 3. Notification intents

New `NotificationEventType` values (enum migration): `request.submitted`, `request.approval_required`, `request.approval_decided`, `request.rejected`, `request.changes_requested`, `request.fulfillment_started`, `request.ticket_created`, `request.completed`, `request.cancelled`. Intents created via existing `NotificationsService` (in-module, tenant-scoped, preference-aware, not provider-sent). Approvers are notified on `request.approval_required` (force-notified as actionable task).

## 4. RBAC permissions (`catalog.*`)

- `catalog.category.read / create / update / delete`
- `catalog.service.read / create / update / publish / retire / delete`
- `catalog.form.read / update`
- `catalog.template.read / create / update / delete`
- `catalog.request.create / read / read_all / update / cancel / fulfill / generate_ticket / complete`
- `catalog.approval.decide`
- `catalog.request.attachment.create / delete`

Role defaults (seed migration): tenant_admin/manager/agent get catalog admin+request perms; requester/approver/read_only get `catalog.category.read`, `catalog.service.read`, `catalog.form.read`, `catalog.request.create`, `catalog.request.read`, `catalog.request.attachment.create`; requester additionally gets `catalog.request.update` and `catalog.request.cancel` (self-service on own requests — service enforces requester ownership; updating or cancelling another user's request requires `catalog.request.read_all` in addition); approver additionally gets `catalog.approval.decide`.

## 5. Audit events (`catalog.*`)

| Event                                                       | Actor           | Notes                                      |
| ----------------------------------------------------------- | --------------- | ------------------------------------------ |
| `catalog.category.created/updated/deleted`                  | Agent/Admin     | Safe before/after, slug, parentId          |
| `catalog.service.created/updated/published/retired/deleted` | Agent/Admin     | Form version, SLA policy id, approval mode |
| `catalog.form.updated`                                      | Agent/Admin     | formVersion bump, schema hash              |
| `catalog.template.created/updated/deleted`                  | Agent/Admin     | Name, serviceId                            |
| `catalog.request.submitted/updated`                         | Requester/Agent | requestRef, serviceId, priority            |
| `catalog.approval.decided`                                  | Approver        | stepNumber, decision, comment              |
| `catalog.request.resubmitted/cancelled`                     | Requester/Agent | requestRef, reason                         |
| `catalog.request.fulfillment_started/completed`             | Agent           | requestRef, ticketId                       |
| `catalog.request.ticket_created`                            | System/Agent    | requestRef, ticketId, publicRef            |
| `catalog.request.attachment.added/removed`                  | Requester/Agent | file name, size                            |

## 6. API surface (all under `/api/v1/catalog`, bearer auth, RBAC, rate-limited)

| Method | Path                                                          | Permission                        |
| ------ | ------------------------------------------------------------- | --------------------------------- |
| GET    | `/api/v1/catalog/categories`                                  | catalog.category.read             |
| POST   | `/api/v1/catalog/categories`                                  | catalog.category.create           |
| PATCH  | `/api/v1/catalog/categories/:id`                              | catalog.category.update           |
| DELETE | `/api/v1/catalog/categories/:id`                              | catalog.category.delete           |
| GET    | `/api/v1/catalog/services` (filters: kind, categoryId, state) | catalog.service.read              |
| GET    | `/api/v1/catalog/services/:id`                                | catalog.service.read              |
| POST   | `/api/v1/catalog/services` (incl. form schema)                | catalog.service.create            |
| PATCH  | `/api/v1/catalog/services/:id`                                | catalog.service.update            |
| POST   | `/api/v1/catalog/services/:id/publish` / `retire`             | catalog.service.publish/retire    |
| DELETE | `/api/v1/catalog/services/:id`                                | catalog.service.delete            |
| GET    | `/api/v1/catalog/services/:id/form`                           | catalog.form.read                 |
| PUT    | `/api/v1/catalog/services/:id/form`                           | catalog.form.update               |
| GET    | `/api/v1/catalog/services/:id/suggestions`                    | catalog.service.read              |
| GET    | `/api/v1/catalog/templates`                                   | catalog.template.read             |
| POST   | `/api/v1/catalog/templates` / PATCH `/:id` / DELETE `/:id`    | catalog.template.*                |
| GET    | `/api/v1/catalog/requests` (own) / `?scope=all`               | catalog.request.read / read_all   |
| GET    | `/api/v1/catalog/requests/:id`                                | catalog.request.read / read_all   |
| POST   | `/api/v1/catalog/requests`                                    | catalog.request.create            |
| PATCH  | `/api/v1/catalog/requests/:id` (answers, while editable)      | catalog.request.update            |
| POST   | `/api/v1/catalog/requests/:id/cancel`                         | catalog.request.cancel            |
| GET    | `/api/v1/catalog/requests/:id/history`                        | catalog.request.read / read_all   |
| GET    | `/api/v1/catalog/requests/:id/approvals`                      | catalog.request.read / read_all   |
| POST   | `/api/v1/catalog/requests/:id/approvals/:approvalId/decide`   | catalog.approval.decide           |
| POST   | `/api/v1/catalog/requests/:id/fulfill`                        | catalog.request.fulfill           |
| POST   | `/api/v1/catalog/requests/:id/generate-ticket`                | catalog.request.generate_ticket   |
| POST   | `/api/v1/catalog/requests/:id/complete`                       | catalog.request.complete          |
| POST   | `/api/v1/catalog/requests/:id/attachments` (multipart)        | catalog.request.attachment.create |
| GET    | `/api/v1/catalog/requests/:id/attachments`                    | catalog.request.read / read_all   |
| DELETE | `/api/v1/catalog/requests/:id/attachments/:attachmentId`      | catalog.request.attachment.delete |

OpenAPI 3 annotations on every endpoint; `catalog.openapi.spec.ts` asserts tags/paths.

## 7. Form engine (pure domain)

- `validateAnswers(schema, answers)` → `{ valid: boolean; errors: FieldError[] }` — validates only visible fields; unknown keys rejected; required/enum/pattern/length/number/date checks; file fields validated against `maxFiles`/`maxFileSizeBytes`.
- `isFieldVisible(field, answers)` — evaluates `visibleWhen` against submitted answers (EQ/NEQ/CONTAINS/GTE/LTE; missing dependency treated as invisible).
- `validateFormSchema(schema)` → structural validation of the schema itself at create/update (field keys unique, valid types, options present for SELECT/MULTI_SELECT/RADIO, `visibleWhen.fieldKey` references an existing field, no self-reference).
- Deterministic, unit + property tests; no Prisma/Nest imports.

## 8. Tests

- Unit: form engine (validation matrix, conditional visibility, schema validation), request status transitions, approval gate (ALL/ANY/SINGLE outcomes), service repository helpers.
- Integration (PostgreSQL): category hierarchy + cycle rejection; service publish/retire + form version bump; request submit → approval → fulfillment → ticket creation → SLA target creation with pinned policy; attachment upload; KB suggestions visibility; notification intents; outbox rows; tenant-isolation negative tests (cross-tenant reads/decisions 404/403).
- OpenAPI spec test; schema-guard table additions.

## 9. Frontend (Next.js, mirroring Module 1 pattern)

- `/catalog` — browse published services grouped by category with Business/Technical filter.
- `/catalog/[serviceSlug]` — service detail; dynamic request form rendering with client-side conditional fields (same semantics as server engine).
- `/requests` — my requests with status tracking.
- `/requests/[id]` — request detail: status, answers, history timeline, approvals, attachments.
- `/catalog/admin` — categories and services management (create/edit, form field builder, publish).

## 10. Documentation updates (same PR)

CHANGELOG (v1.2 entry), `platform-architecture-book.md` (Catalog module section, tables, permissions), `04-functional-requirements.md` (FR-14 + traceability), `03-product-requirements.md` (PR-11), `permissions-matrix.md`, `audit-events.md`, `database/TABLES.md`, `glossary.md` (Service Catalog, Service Item, Request Template, Dynamic Request Form, Approval Gate), `workflow-matrix.md` (new trigger events), `notification-events.md`, `ui-components.md`, `decision-log.md` (approval-gate contract, SLA pinning, ticket generation idempotency).

## 11. Migration safety

Two additive migrations: `20260801180000_service_catalog` (tables/enums) and `20260801181000_service_catalog_permissions` (permission seed) — backward compatible expand-only, no destructive contraction. `migrate:verify` gate passes.
