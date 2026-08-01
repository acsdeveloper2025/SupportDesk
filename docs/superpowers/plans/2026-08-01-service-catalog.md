# Module 2 — Enterprise ITSM Service Catalog Implementation Plan

**Goal:** Implement the tenant-scoped Service Catalog (categories, Business/Technical services, dynamic request forms with validation and conditional fields, request templates, request lifecycle with history, approval-gate contract, workflow-engine outbox integration, SLA policy pinning, KB suggestions, attachments, notifications, and idempotent ticket generation) as a self-contained `apps/api/src/catalog` module with Next.js pages, per [2026-08-01-service-catalog-design.md](../specs/2026-08-01-service-catalog-design.md).

---

## User Review Required

> [!IMPORTANT]
> **Key Architectural Guarantees & Constraints:**
>
> 1. **Tenant isolation:** Every catalog repository method filters by `tenantId`; controllers fail closed (401) without Tenant context; integration tests include cross-tenant negative cases.
> 2. **Approval gate is a hard gate:** `IN_FULFILLMENT` is unreachable unless all approvals resolved `APPROVED` (mode ALL) or the first decision passed (mode ANY/SINGLE). Fulfillment/ticket-generation endpoints re-verify the gate inside the transaction.
> 3. **Idempotent ticket generation:** one Ticket per ServiceRequest; `(tenantId, ticketId)` unique; concurrent generate-ticket calls produce exactly one ticket and one `service_request.ticket_created` event.
> 4. **Form validation is deterministic and pure:** domain engine has no Prisma/Nest imports; conditional-field visibility evaluated with the exact semantics as the client renderer (EQ/NEQ/CONTAINS/GTE/LTE).
> 5. **SLA pinning:** `SlaEngineService.startTargetsForTicketWithPolicy` (new public method) resolves the published version of the pinned policy; existing `onTicketCreated` behavior is unchanged.
> 6. **Outbox events are appended in the same DB transaction** as every request/approval/fulfillment/ticket mutation so the existing workflow dispatcher (E11-I03) triggers automation without changes.
> 7. **Non-goals respected:** no procurement, vendor ordering, billing/chargeback, cloud provisioning, or AI recommendations.

---

## Open Questions

- None blocking. Defaults per spec:
  - Request ref format: `REQ-000001` (zero-padded, tenant-sequence, atomic in repository).
  - Request attachments: max 5 files / 10 MB each (matches ticket attachment validation).
  - KB suggestions: top 5 published articles by tag match then title keyword match; internal visibility only for `manager`/`agent`/`tenant_admin`.

---

## Proposed Changes

---

### Database Schema & Migrations

#### [MODIFY] [schema.prisma](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/prisma/schema.prisma)

- Add `ServiceKind` enum (`BUSINESS`, `TECHNICAL`).
- Add `ServiceApprovalMode` enum (`NONE`, `SINGLE`, `ALL`, `ANY`).
- Add `ServiceRequestStatus` enum (`SUBMITTED`, `AWAITING_APPROVAL`, `APPROVED`, `REJECTED`, `CHANGES_REQUESTED`, `IN_FULFILLMENT`, `COMPLETED`, `CANCELLED`).
- Add `ServiceApprovalStatus` enum (`PENDING`, `APPROVED`, `REJECTED`, `CHANGES_REQUESTED`).
- Extend `NotificationEventType` enum with `request.*` values (`request.submitted`, `request.approval_required`, `request.approval_decided`, `request.rejected`, `request.changes_requested`, `request.fulfillment_started`, `request.ticket_created`, `request.completed`, `request.cancelled`).
- Add back-relations on `Tenant`, `User`, `Ticket`, `SlaPolicy`.
- Add models: `ServiceCategory`, `ServiceItem`, `ServiceRequestForm`, `RequestTemplate`, `ServiceRequest`, `ServiceRequestApproval`, `ServiceRequestAttachment`, `ServiceRequestHistory`.

#### [NEW] Migration `20260801180000_service_catalog`

- Create enums and all `service_*` / `request_template` tables with constraints:
  - `service_categories`: unique `(tenant_id, slug)`, self-parent FK SetNull, index `(tenant_id, parent_id)`.
  - `service_items`: unique `(tenant_id, slug)`, FK category Restrict, FK `sla_policy_id` SetNull, indexes `(tenant_id, state, kind)`, `(tenant_id, category_id)`.
  - `service_request_forms`: unique `service_id`, FK Cascade.
  - `request_templates`: FK service SetNull, FK created_by Cascade.
  - `service_requests`: unique `(tenant_id, request_ref)`, unique `(tenant_id, ticket_id)`, FKs service Restrict / requester Cascade / ticket SetNull, indexes `(tenant_id, status, created_at)`, `(tenant_id, requester_user_id, created_at)`.
  - `service_request_approvals`: unique `(tenant_id, request_id, step_number)`, FK request Cascade.
  - `service_request_attachments`: FK request Cascade, index `(tenant_id, request_id)`.
  - `service_request_history`: FK request Cascade, index `(tenant_id, request_id, created_at)`.

#### [NEW] Migration `20260801181000_service_catalog_permissions`

- Insert `catalog.*` permissions (24 keys, `is_system`, ON CONFLICT DO NOTHING).
- Grant admin group (tenant_admin/manager/agent) all catalog permissions.
- Grant requester/approver/read_only: read + `catalog.request.create` + `catalog.request.read` + `catalog.request.attachment.create`.
- Grant approver additionally `catalog.approval.decide`.

---

### Domain Engine (pure, no Prisma/Nest)

#### [NEW] [apps/api/src/catalog/domain/form-engine.ts](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/catalog/domain/form-engine.ts)

- `ServiceFormSchema`, `ServiceFormField`, `ServiceFormFieldType`, `ConditionalVisibility` types + `validateFormSchema()`, `isFieldVisible()`, `validateAnswers()`, `buildFieldError()`.

#### [NEW] [apps/api/src/catalog/domain/request-status.ts](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/catalog/domain/request-status.ts)

- `canTransition(from, to)`, `isEditableStatus(status)` (SUBMITTED / CHANGES_REQUESTED), `isTerminalStatus(status)`.

#### [NEW] [apps/api/src/catalog/domain/approval-gate.ts](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/catalog/domain/approval-gate.ts)

- `ApprovalGate` interface (narrow contract: `evaluate`, `decide`), `DecisionOutcome` type, pure helpers `stepOutcomeForMode()`, `isGateSatisfied()`.

#### [NEW] Tests

- `form-engine.spec.ts` (validation matrix, conditional visibility, schema structural checks).
- `request-status.spec.ts` (transition table, editability, terminal states).
- `approval-gate.spec.ts` (ALL/ANY/SINGLE outcomes, changes-requested).

---

### Catalog API Module

#### [NEW] [apps/api/src/catalog/dto/](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/catalog/dto)

- `category-dtos.ts`: `CreateServiceCategoryDto`, `UpdateServiceCategoryDto`, `ServiceCategoryResponseDto`, `validateCreateCategoryPayload`, `validateUpdateCategoryPayload`.
- `service-dtos.ts`: `CreateServiceItemDto`, `UpdateServiceItemDto`, `PublishServiceDto`, `ServiceItemResponseDto`, payload validators (incl. form schema embedding).
- `form-dtos.ts`: `ServiceFormSchemaDto`, `PutServiceFormDto`, schema validator.
- `template-dtos.ts`: `CreateRequestTemplateDto`, `UpdateRequestTemplateDto`, validators.
- `request-dtos.ts`: `CreateServiceRequestDto`, `UpdateServiceRequestAnswersDto`, `CancelServiceRequestDto`, `DecideApprovalDto`, `ServiceRequestResponseDto`, validators.
- `attachment-dtos.ts`: `AttachmentResponseDto`.

#### [NEW] [apps/api/src/catalog/catalog-categories.repository.ts](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/catalog/catalog-categories.repository.ts)

- `list(tenantId, {page,pageSize,parentId})`, `findById(tenantId,id)`, `findBySlug(tenantId,slug)`, `create()`, `update()`, `delete()`, `countByParent(tenantId,parentId)`, `listDescendantIds(tenantId,parentId)` (cycle guard).

#### [NEW] [apps/api/src/catalog/catalog-categories.service.ts](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/catalog/catalog-categories.service.ts)

- CRUD with tenant-scoped cycle prevention, slug uniqueness, audit + outbox-free (categories do not emit domain events; audit only).

#### [NEW] [apps/api/src/catalog/catalog-categories.controller.ts](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/catalog/catalog-categories.controller.ts)

- CRUD endpoints, RBAC `catalog.category.*`, OpenAPI annotations, rate limits.

#### [NEW] [apps/api/src/catalog/catalog-services.repository.ts](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/catalog/catalog-services.repository.ts)

- `list(tenantId, {kind,categoryId,state,page,pageSize})`, `findById(tenantId,id)` (+form, category), `findBySlug`, `createWithForm` (TX), `update`, `publish` (state + publishedAt), `retire`, `softDelete`, `findForm(tenantId,serviceId)`, `bumpFormVersion` (TX), `findPublishedForSuggestions`.

#### [NEW] [apps/api/src/catalog/catalog-services.service.ts](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/catalog/catalog-services.service.ts)

- CRUD + publish/retire + form version bump (audit `catalog.form.updated` with schema hash), KB suggestions via KbArticlesRepository (visibility-guarded), SLA policy existence check (via SlaRepository read), approval steps structural validation.

#### [NEW] [apps/api/src/catalog/catalog-services.controller.ts](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/catalog/catalog-services.controller.ts)

- Service CRUD, publish/retire, form get/put, suggestions; RBAC `catalog.service.*` / `catalog.form.*`.

#### [NEW] [apps/api/src/catalog/catalog-templates.*](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/catalog/catalog-templates.repository.ts)

- Repository + service + controller: CRUD, tenant-scoped, `isDefault` uniqueness per tenant, field values validated against the service's published form at apply-time.

#### [NEW] [apps/api/src/catalog/catalog-requests.repository.ts](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/catalog/catalog-requests.repository.ts)

- `create` (atomic requestRef sequence, TX), `listByRequester`, `listAll`, `findById` (+service, approvals, ticket), `updateAnswers`, `transitionStatus` (history insert), `createApprovals` (TX), `getApproval`, `listApprovals`, `decideApproval` (TX + gate re-eval), `createAttachment`, `listAttachments`, `deleteAttachment`, `linkTicket` (unique guard), `addHistory`.

#### [NEW] [apps/api/src/catalog/catalog-requests.service.ts](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/catalog/catalog-requests.service.ts)

- `submit` (validate answers against published form + version capture + approval steps creation + intents + outbox), `updateAnswers` (editable states only, re-validate, `service_request.resubmitted` when coming from CHANGES_REQUESTED → new approval cycle), `cancel`, `decideApproval` (gate eval → status transition → intents + outbox), `startFulfillment` (gate check), `generateTicket` (idempotent via unique ticketId; calls TicketsService.createTicket + `slaEngine.startTargetsForTicketWithPolicy`; outbox `service_request.ticket_created`), `complete`, `listHistory`, `attachments` (upload validation + local storage + scanner reuse), `suggestions`.

#### [NEW] [apps/api/src/catalog/catalog-requests.controller.ts](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/catalog/catalog-requests.controller.ts)

- All request/approval/attachment/history endpoints per spec §6; RBAC + OpenAPI + rate limits; multipart upload for attachments.

#### [NEW] [apps/api/src/catalog/catalog.module.ts](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/catalog/catalog.module.ts)

- Imports: DatabaseModule, AuthModule, RbacModule, OutboxModule, NotificationsModule, TicketingModule (TicketsService), SlaModule, KbModule. Exports services/repositories.

#### [MODIFY] [apps/api/src/app.module.ts](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/app.module.ts)

- Register `CatalogModule`.

#### [MODIFY] [apps/api/src/notifications/notification.constants.ts](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/notifications/notification.constants.ts)

- Add `request.*` event types to `ALL_NOTIFICATION_EVENT_TYPES`.

#### [MODIFY] [apps/api/src/sla/sla-engine.service.ts](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/sla/sla-engine.service.ts)

- Add public `startTargetsForTicketWithPolicy(ticket, slaPolicyId, actorUserId?)`: resolves published `SlaPolicyVersion` for the policy, published schedule for its scheduleKey, then reuses existing private target creation helpers.

#### [MODIFY] [apps/api/src/kb/kb-articles.repository.ts](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/kb/kb-articles.repository.ts)

- Add `searchForSuggestions(tenantId, tags, keywords, {includeInternal, limit})` returning published articles matched by tag name or title/keywords, visibility-guarded.

#### [MODIFY] [apps/api/src/database/schema-guard.spec.ts](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/database/schema-guard.spec.ts)

- Add `service_*` / `request_templates` tables to the expected table list.

---

### Tests (integration)

#### [NEW] [apps/api/src/catalog/catalog.integration.spec.ts](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/catalog/catalog.integration.spec.ts)

- PostgreSQL-backed: category hierarchy + cycle rejection; service create/publish/form bump; request submit with validation errors; approval flow (ALL gate reject/approve, ANY, SINGLE, changes-requested → resubmit); fulfillment → ticket generation → SLA targets with pinned policy (assert policyVersionId); KB suggestions visibility; attachment upload; notification intents created; outbox rows asserted; tenant-isolation negative cases (cross-tenant read/decide 404/403).

#### [NEW] [apps/api/src/catalog/catalog.openapi.spec.ts](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/api/src/catalog/catalog.openapi.spec.ts)

- Asserts catalog tags and endpoint paths present in the generated OpenAPI document.

#### [NEW] Unit specs for services (mirror KB pattern)

- `catalog-categories.service.spec.ts`, `catalog-services.service.spec.ts`, `catalog-requests.service.spec.ts` (mocked repository; gate/transition/audit/outbox call assertions).

---

### Frontend (Next.js)

#### [NEW] [apps/web/app/catalog/page.tsx](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/web/app/catalog/page.tsx)

- Catalog browse: category grouping, Business/Technical filter, sample data per Module 1 pattern.

#### [NEW] [apps/web/app/catalog/[serviceSlug]/page.tsx](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/web/app/catalog/[serviceSlug]/page.tsx)

- Service detail + dynamic form renderer (client-side conditional field visibility, validation hints, attachments, submit).

#### [NEW] [apps/web/app/requests/page.tsx](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/web/app/requests/page.tsx)

- My requests list with status chips and refs.

#### [NEW] [apps/web/app/requests/[id]/page.tsx](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/web/app/requests/[id]/page.tsx)

- Request detail: answers, status timeline (history), approvals with decide actions, attachments.

#### [NEW] [apps/web/app/catalog/admin/page.tsx](file:///Users/mayurkulkarni/Downloads/SupportDesk/apps/web/app/catalog/admin/page.tsx)

- Admin: categories + services management with a simple field-builder form editor (add/edit field, type, required, options, conditional rule), publish/retire.

---

### Documentation (same PR)

- [CHANGELOG.md](file:///Users/mayurkulkarni/Downloads/SupportDesk/CHANGELOG.md): `## [v1.2-service-catalog]` entry.
- [platform-architecture-book.md](file:///Users/mayurkulkarni/Downloads/SupportDesk/docs/platform-architecture-book.md): bump to v1.2, add Service Catalog Module section, tables, permissions, events, tag reference.
- [04-functional-requirements.md](file:///Users/mayurkulkarni/Downloads/SupportDesk/docs/04-functional-requirements.md): add FR-14 + traceability row.
- [03-product-requirements.md](file:///Users/mayurkulkarni/Downloads/SupportDesk/docs/03-product-requirements.md): add PR-11.
- [permissions-matrix.md](file:///Users/mayurkulkarni/Downloads/SupportDesk/docs/permissions-matrix.md): catalog.* rows + canonical keys list.
- [audit-events.md](file:///Users/mayurkulkarni/Downloads/SupportDesk/docs/audit-events.md): catalog.* events.
- [database/TABLES.md](file:///Users/mayurkulkarni/Downloads/SupportDesk/docs/database/TABLES.md): catalog tables.
- [glossary.md](file:///Users/mayurkulkarni/Downloads/SupportDesk/docs/glossary.md): Service Catalog, Service Item, Request Template, Dynamic Request Form, Approval Gate.
- [workflow-matrix.md](file:///Users/mayurkulkarni/Downloads/SupportDesk/docs/workflow-matrix.md): `service_request.*` trigger events.
- [notification-events.md](file:///Users/mayurkulkarni/Downloads/SupportDesk/docs/notification-events.md): `request.*` events.
- [ui-components.md](file:///Users/mayurkulkarni/Downloads/SupportDesk/docs/ui-components.md): catalog pages.
- [decision-log.md](file:///Users/mayurkulkarni/Downloads/SupportDesk/docs/decision-log.md): ADR entry — approval-gate contract, SLA policy pinning, idempotent ticket generation, form-version capture.

---

### Verification

1. `pnpm typecheck` — all packages.
2. `pnpm lint` — zero warnings.
3. `pnpm --filter @supportdesk/api test` — unit + integration suites (catalog + existing modules).
4. `bash scripts/verify-migrations.sh` — migrations apply on fresh PostgreSQL.
5. Unit + property tests for form engine; integration coverage for tenant-isolation negatives.
6. OpenAPI spec test green.

### Deployment & Rollback

- Additive migrations only; deploy catalog code + migrations together; rollback = revert code (tables remain, unused); no destructive contraction in this milestone.

### Observability

- Catalog operations flow through existing audit pipeline; request lifecycle logged with requestRef + correlationId; outbox events observable via existing admin outbox tooling.
