# Complete GitHub engineering backlog

This backlog is project planning only. It does not create source code, scaffolding, migrations, CI, or implementation files. It expands [github-project-plan.md](github-project-plan.md), follows [milestones.md](milestones.md), and must be executed in the sequence defined by [implementation-order.md](implementation-order.md).

## Labels

Required labels:

- `backend`
- `frontend`
- `api`
- `database`
- `security`
- `documentation`
- `testing`
- `performance`
- `bug`
- `enhancement`
- `feature`
- `high-priority`
- `medium-priority`
- `low-priority`
- `technical-debt`
- `good-first-issue`
- `blocked`

Recommended additional labels from the architecture plan:

- `tenant-isolation`
- `audit`
- `workflow`
- `notifications`
- `operations`
- `accessibility`
- `release`

## Issue field contract

Every issue record below contains:

- **Title:** issue title.
- **Description:** implementation scope.
- **Business Goal:** user/business outcome.
- **Acceptance Criteria:** measurable completion criteria.
- **Dependencies:** predecessor issue IDs or milestone gates.
- **Technical Notes:** architecture pointers.
- **Files Expected:** expected future implementation/document areas, not files created by this planning task.
- **Tests Required:** verification suites.
- **Documentation Updates:** docs that must be updated when implementing.
- **Estimated Complexity:** S/M/L/XL.
- **Priority:** critical/high/medium/low.
- **Definition of Done:** issue-level done rule.

## Epic 1 - Project Foundation

| ID      | Title                                            | Description / Business Goal                                                                                     | Acceptance Criteria                                              | Dependencies     | Technical Notes / Files Expected                 | Tests / Docs          | Complexity / Priority / DoD                   |
| ------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------- | ------------------------------------------------ | --------------------- | --------------------------------------------- |
| E01-I01 | Resolve compliance and evidence baseline         | Decide compliance targets, evidence needs, and audit dates so implementation does not guess regulated controls. | OQ-01 has owner approval, ADR/update, and affected docs revised. | None             | Docs only: decision log, security, release plan. | Documentation review. | S / critical / Business approval recorded.    |
| E01-I02 | Resolve residency and deployment assumptions     | Decide regions, tenant placement, cloud, and managed-service constraints.                                       | OQ-02 and OQ-12 resolved or accepted assumptions.                | E01-I01          | Architecture, database, deployment docs.         | Architecture review.  | M / critical / Platform assumptions approved. |
| E01-I03 | Approve engineering standards and repo structure | Define implementation folder boundaries and coding rules before code starts.                                    | Coding standards accepted; module boundaries mapped to epics.    | E01-I01, E01-I02 | Future app folders by bounded context.           | Documentation QA.     | S / high / Standards linked in issues.        |
| E01-I04 | Establish project governance gates               | Define PR, review, security, testing, and release gates.                                                        | Issue template, milestones, sprint plan, release plan approved.  | E01-I03          | AGENTS, CONTRIBUTING, release docs.              | Documentation QA.     | S / high / Ready for GitHub project setup.    |

## Epic 2 - Authentication

| ID      | Title                                           | Description / Business Goal                                                      | Acceptance Criteria                                                    | Dependencies     | Technical Notes / Files Expected                 | Tests / Docs                         | Complexity / Priority / DoD                            |
| ------- | ----------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------- | ------------------------------------------------ | ------------------------------------ | ------------------------------------------------------ |
| E02-I01 | Design authentication module                    | Define auth boundaries for login, sessions, reset, verification, and future SSO. | Module contract matches `api/authentication.md` and ADR-0002.          | E01-I03          | Future identity/auth module.                     | T-SEC, T-AUTH planning.              | M / critical / Module contract reviewed.               |
| E02-I02 | Implement login, logout, and refresh flows      | Enable secure session lifecycle for tenant users.                                | Login/logout/refresh endpoints satisfy API spec and error catalogue.   | E02-I01          | Auth API, session storage, audit events.         | Unit, integration, auth abuse tests. | L / critical / Tokens rotate and revoke correctly.     |
| E02-I03 | Implement password reset and email verification | Allow safe account recovery and verified identifiers.                            | Reset and verification flows avoid enumeration and emit notifications. | E02-I02, E09-I01 | Auth API, notification intents, email templates. | Security, notification, E2E tests.   | M / high / Recovery flow passes abuse tests.           |
| E02-I04 | Add MFA and session management baseline         | Protect privileged roles and let users revoke sessions.                          | MFA policy hooks, session list, revoke, and audit events exist.        | E02-I02          | Session APIs, MFA adapters, audit.               | T-AUTH, T-SEC.                       | L / high / Privileged step-up enforced where required. |

## Epic 3 - Organizations

| ID      | Title                             | Description / Business Goal                             | Acceptance Criteria                                           | Dependencies     | Technical Notes / Files Expected         | Tests / Docs                 | Complexity / Priority / DoD                  |
| ------- | --------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------- | ---------------- | ---------------------------------------- | ---------------------------- | -------------------------------------------- |
| E03-I01 | Implement organization data model | Group requesters and tickets inside a tenant.           | Organization entity enforces tenant ownership and uniqueness. | E01-I02, E04-I02 | Database organization tables, API model. | T-ISO, T-DOM.                | M / high / Same-tenant constraints pass.     |
| E03-I02 | Implement organization APIs       | Support organization CRUD and ticket history.           | Endpoints match `api/organizations.md`.                       | E03-I01          | API controllers/contracts.               | API and authorization tests. | M / high / CRUD and scoped ticket list pass. |
| E03-I03 | Build organization admin UI       | Let admins manage organizations.                        | List/detail/create/update/delete UX follows UI standards.     | E03-I02, E18-I01 | Frontend admin pages/components.         | E2E, accessibility.          | M / medium / Admin journey passes.           |
| E03-I04 | Add organization reporting hooks  | Make organization filters available to tickets/reports. | Tickets and reports can filter by authorized organization.    | E03-I02, E13-I01 | Report filters, ticket queries.          | T-SEARCH, T-AUTH.            | S / medium / Filters are tenant-safe.        |

## Epic 4 - RBAC

| ID      | Title                                                 | Description / Business Goal                                  | Acceptance Criteria                                             | Dependencies     | Technical Notes / Files Expected   | Tests / Docs                    | Complexity / Priority / DoD                                 |
| ------- | ----------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- | ---------------- | ---------------------------------- | ------------------------------- | ----------------------------------------------------------- |
| E04-I01 | Implement permission catalogue                        | Provide stable permission keys for all protected actions.    | Catalogue matches `permissions-matrix.md`; no role-name checks. | E01-I03          | Permission seed/registry.          | T-AUTH.                         | M / critical / Permission keys verified.                    |
| E04-I02 | Implement roles, memberships, and groups              | Support tenant-scoped authorization.                         | Roles/groups/memberships enforce tenant ownership.              | E04-I01, E02-I01 | Identity/access module, DB tables. | T-ISO, T-AUTH.                  | L / critical / Matrix tests pass.                           |
| E04-I03 | Implement permission evaluator and cache invalidation | Enforce deny-by-default, scopes, and 60-second invalidation. | Effective permissions update after grant/revoke/suspend.        | E04-I02          | Authorization service/cache.       | T-AUTH, security tests.         | L / critical / Stale auth denied after invalidation window. |
| E04-I04 | Build role and permission admin UI                    | Let Tenant Admins manage grants safely.                      | UI prevents self-escalation and last-admin removal.             | E04-I03, E18-I01 | Admin role screens.                | E2E, accessibility, auth tests. | M / high / Privileged flows audited.                        |

## Epic 5 - Ticket Engine

| ID      | Title                                              | Description / Business Goal                         | Acceptance Criteria                                                                      | Dependencies     | Technical Notes / Files Expected        | Tests / Docs         | Complexity / Priority / DoD                |
| ------- | -------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------- | --------------------------------------- | -------------------- | ------------------------------------------ |
| E05-I01 | Implement ticket aggregate                         | Provide canonical support work item.                | Ticket state, reference, tenant ownership, version, priority, assignment fields persist. | E01-I02, E04-I03 | Ticketing domain and database.          | T-DOM, T-ISO.        | L / critical / Aggregate invariants pass.  |
| E05-I02 | Implement ticket create/read APIs                  | Allow requesters/agents to create and view tickets. | Endpoints match `api/tickets.md`; audit/outbox records created atomically.               | E05-I01, E16-I01 | Ticket API, audit/outbox.               | API, T-ISO, T-AUDIT. | L / critical / J-01 create/read passes.    |
| E05-I03 | Implement ticket update and optimistic concurrency | Support safe field edits and conflict handling.     | Stale version returns precondition error without mutation.                               | E05-I02          | Ticket command handlers.                | T-DOM, API tests.    | M / high / Conflict UX/API pass.           |
| E05-I04 | Implement assignment and transition commands       | Support triage, assign, solve, reopen, and close.   | Commands follow `workflow-matrix.md` and emit audit events.                              | E05-I03, E10-I01 | Assignment history, transition service. | T-WF, T-AUDIT.       | L / critical / Invalid transitions denied. |

## Epic 6 - Comments

| ID      | Title                                  | Description / Business Goal                                | Acceptance Criteria                                                      | Dependencies     | Technical Notes / Files Expected | Tests / Docs           | Complexity / Priority / DoD                        |
| ------- | -------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------- | -------------------------------- | ---------------------- | -------------------------------------------------- |
| E06-I01 | Implement comment model                | Capture public and internal ticket conversation.           | Visibility immutable after dispatch; tenant/ticket constraints enforced. | E05-I01          | Comment domain/database.         | T-DOM, T-ISO.          | M / high / Visibility invariants pass.             |
| E06-I02 | Implement comments API                 | Allow timeline reads and public/internal comment creation. | Endpoints match `api/comments.md`.                                       | E06-I01, E04-I03 | Comment API.                     | API, T-AUTH.           | M / high / Requesters never see internal comments. |
| E06-I03 | Implement comment redaction policy     | Support safe removal/redaction of sensitive content.       | Redaction is audited and respects retention/legal hold.                  | E06-I02, E16-I01 | Redaction commands.              | Security, audit tests. | M / medium / Redaction evidence retained.          |
| E06-I04 | Build comment composer and timeline UI | Let users participate in ticket conversation.              | Public/internal states are visually and semantically distinct.           | E06-I02, E18-I01 | Ticket detail UI.                | E2E, T-A11Y.           | M / high / Critical journey passes.                |

## Epic 7 - Attachments

| ID      | Title                                        | Description / Business Goal                            | Acceptance Criteria                                                             | Dependencies     | Technical Notes / Files Expected    | Tests / Docs        | Complexity / Priority / DoD             |
| ------- | -------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------- | ---------------- | ----------------------------------- | ------------------- | --------------------------------------- |
| E07-I01 | Implement attachment metadata and quarantine | Track untrusted files before clean download.           | Scan states, hash, size, content type, storage identity recorded.               | E05-I01, E06-I01 | Attachment tables/domain.           | T-SEC, T-ISO.       | L / high / Dirty files cannot download. |
| E07-I02 | Implement upload session and completion APIs | Support safe uploads with size/type/quota validation.  | Endpoints match `api/attachments.md`.                                           | E07-I01          | Upload session API/storage adapter. | API, abuse tests.   | L / high / Quotas and limits enforced.  |
| E07-I03 | Implement scan callback and safe download    | Allow only clean, authorized attachment access.        | Provider callbacks are signed/replay-safe; clean download rechecks ticket auth. | E07-I02          | Scanner adapter, download API.      | T-SEC, T-ISO.       | L / high / Reused signed URLs denied.   |
| E07-I04 | Build attachment UI states                   | Show pending, clean, blocked, infected, failed states. | UI follows `ui-components.md` and never exposes unsafe preview.                 | E07-I03, E18-I01 | Ticket attachment components.       | E2E, accessibility. | M / medium / Attachment UX passes.      |

## Epic 8 - Notifications

| ID      | Title                               | Description / Business Goal                                       | Acceptance Criteria                                          | Dependencies     | Technical Notes / Files Expected | Tests / Docs                | Complexity / Priority / DoD                    |
| ------- | ----------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ | ---------------- | -------------------------------- | --------------------------- | ---------------------------------------------- |
| E08-I01 | Implement notification intent model | Convert domain events into provider-neutral notification intents. | Intents dedupe by event/recipient/channel/template.          | E05-I02, E11-I01 | Notification tables/domain.      | T-NOTIFY.                   | M / high / Replay creates no duplicate intent. |
| E08-I02 | Implement in-app notifications      | Provide user-visible notification drawer.                         | Notifications list/update APIs match `api/notifications.md`. | E08-I01, E18-I01 | In-app notification API/UI.      | API, E2E, T-A11Y.           | M / medium / Read/archive works.               |
| E08-I03 | Implement notification preferences  | Respect channel/event preferences and mandatory notices.          | Mandatory security notices cannot be disabled.               | E08-I01, E04-I03 | Preference API/UI.               | T-NOTIFY, T-AUTH.           | M / medium / Preferences enforced.             |
| E08-I04 | Implement delivery failure handling | Surface retry, suppression, bounce, and terminal failures.        | Failure states match `notification-events.md`.               | E08-I01, E09-I02 | Attempts, operations dashboard.  | T-NOTIFY, operations tests. | M / high / Backlog/failure visible.            |

## Epic 9 - Email

| ID      | Title                                     | Description / Business Goal                              | Acceptance Criteria                                                       | Dependencies              | Technical Notes / Files Expected | Tests / Docs              | Complexity / Priority / DoD                  |
| ------- | ----------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------- | -------------------------------- | ------------------------- | -------------------------------------------- |
| E09-I01 | Implement email template model            | Version transactional email content safely.              | Templates are tenant-scoped, locale-ready, escaped by default.            | E08-I01                   | Template tables/admin API.       | T-NOTIFY, security tests. | M / high / Preview validates variables.      |
| E09-I02 | Implement outbound email provider adapter | Send provider-neutral intents through selected provider. | Attempts record accepted/delivered/bounced/failed states.                 | E09-I01, OQ-09/OQ-10      | Provider adapter, attempts.      | Provider contract tests.  | L / high / Retries and terminal states work. |
| E09-I03 | Implement inbound email processing        | Convert inbound email to ticket/comment events.          | Dedupes provider IDs; maps tenant without trusting payload tenant fields. | E05-I02, E06-I02, E09-I02 | Channel adapter, parser.         | Security, replay, E2E.    | XL / high / Threading and dedupe pass.       |
| E09-I04 | Implement email domain/settings admin     | Let tenants verify support domains and sender identity.  | Domain verification required before activation.                           | E15-I02, E09-I02          | Settings API/UI.                 | Security, API, E2E.       | M / medium / Unverified domains blocked.     |

## Epic 10 - SLA

| ID      | Title                               | Description / Business Goal                           | Acceptance Criteria                                      | Dependencies     | Technical Notes / Files Expected | Tests / Docs        | Complexity / Priority / DoD             |
| ------- | ----------------------------------- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------- | -------------------------------- | ------------------- | --------------------------------------- |
| E10-I01 | Implement business schedules        | Model tenant working hours, holidays, and time zones. | Versioned schedules handle DST and publication.          | E15-I01, OQ-08   | Schedule domain/tables.          | T-SLA fixtures.     | L / high / Calendar fixtures pass.      |
| E10-I02 | Implement SLA policies and targets  | Calculate response/resolution due times.              | First matching policy wins; target evidence retained.    | E10-I01, E05-I02 | SLA policy/target services.      | T-SLA.              | L / critical / 99.99% fixture accuracy. |
| E10-I03 | Implement SLA warnings and breaches | Notify teams before/after breach.                     | Warning/breach jobs emit audit/notification events once. | E10-I02, E08-I01 | SLA jobs/outbox.                 | T-SLA, T-NOTIFY.    | M / high / No duplicate warnings.       |
| E10-I04 | Build SLA admin and ticket panel UI | Make SLA visible and configurable.                    | Agents see due time/reason; admins publish policies.     | E10-I02, E18-I01 | SLA UI.                          | E2E, accessibility. | M / medium / SLA UX passes.             |

## Epic 11 - Workflow Engine

| ID      | Title                                        | Description / Business Goal                                  | Acceptance Criteria                                            | Dependencies     | Technical Notes / Files Expected | Tests / Docs          | Complexity / Priority / DoD                 |
| ------- | -------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- | ---------------- | -------------------------------- | --------------------- | ------------------------------------------- |
| E11-I01 | Implement workflow draft/version model       | Let admins define safe automation.                           | Draft/published/retired versions are immutable after publish.  | E05-I02, E15-I01 | Workflow tables/domain.          | T-WF.                 | L / high / Version history preserved.       |
| E11-I02 | Implement workflow validation and publishing | Prevent invalid references, cycles, and illegal transitions. | Publish validates actions, limits, conditions, and references. | E11-I01          | Validation service.              | T-WF, security tests. | L / high / Invalid workflow cannot publish. |
| E11-I03 | Implement workflow execution engine          | Run deterministic automation from domain events.             | Actions are ordered, bounded, deduped, audited.                | E11-I02, E08-I01 | Worker/execution records.        | T-WF, T-AUDIT.        | XL / high / Replay safe.                    |
| E11-I04 | Build workflow admin UI                      | Let admins draft, preview, publish, pause workflows.         | UI shows validation, scope, consequence, recovery.             | E11-I02, E18-I01 | Workflow UI.                     | E2E, T-A11Y.          | L / medium / Admin journey passes.          |

## Epic 12 - Dashboard

| ID      | Title                               | Description / Business Goal                                 | Acceptance Criteria                                                     | Dependencies              | Technical Notes / Files Expected | Tests / Docs            | Complexity / Priority / DoD           |
| ------- | ----------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------- | -------------------------------- | ----------------------- | ------------------------------------- |
| E12-I01 | Define dashboard metric contracts   | Establish agent, manager, and admin KPIs.                   | Metrics list freshness, permissions, and source.                        | E13-I01                   | Report contracts/docs.           | Documentation review.   | S / high / Metrics approved.          |
| E12-I02 | Build agent dashboard               | Help agents prioritize tickets and SLA risk.                | Shows assigned tickets, due risk, unread updates, queue shortcuts.      | E05-I04, E10-I03, E18-I01 | Frontend dashboard.              | E2E, accessibility.     | M / medium / Agent workflow improves. |
| E12-I03 | Build manager dashboard             | Help managers monitor team workload.                        | Shows group queues, SLA risk, backlog, reassignment signals.            | E12-I01, E13-I02          | Dashboard UI/report API.         | E2E, performance smoke. | M / medium / Manager journey passes.  |
| E12-I04 | Build tenant admin health dashboard | Show configuration, delivery, audit, and operations health. | Displays stale/failing workflows, notifications, exports, audit health. | E08-I04, E11-I03, E16-I02 | Admin dashboard.                 | E2E, operations tests.  | M / medium / Health signals visible.  |

## Epic 13 - Reports

| ID      | Title                                | Description / Business Goal                                 | Acceptance Criteria                                            | Dependencies              | Technical Notes / Files Expected | Tests / Docs         | Complexity / Priority / DoD         |
| ------- | ------------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------------- | ------------------------- | -------------------------------- | -------------------- | ----------------------------------- |
| E13-I01 | Implement report aggregate model     | Avoid expensive transactional scans for dashboards/reports. | Aggregates are tenant-scoped, rebuildable, freshness-stamped.  | E05-I02, E10-I02          | Report projection tables.        | T-PERF, T-ISO.       | L / high / Freshness visible.       |
| E13-I02 | Implement ticket and SLA report APIs | Provide operational reports to managers/admins.             | Endpoints match `api/reports.md`.                              | E13-I01                   | Report APIs.                     | API, T-AUTH, T-PERF. | M / high / Filters authorized.      |
| E13-I03 | Implement export jobs and downloads  | Support async exports safely.                               | Export jobs audited; downloads are short-lived and authorized. | E13-I02, E16-I01          | Export job model/API.            | T-AUDIT, T-SEC.      | L / high / Export cannot leak data. |
| E13-I04 | Build reporting UI                   | Let authorized users inspect and export reports.            | UI shows freshness, filters, empty states, export status.      | E13-I02, E13-I03, E18-I01 | Report pages.                    | E2E, accessibility.  | M / medium / Report journey passes. |

## Epic 14 - Search

| ID      | Title                                       | Description / Business Goal                           | Acceptance Criteria                                                  | Dependencies              | Technical Notes / Files Expected | Tests / Docs         | Complexity / Priority / DoD             |
| ------- | ------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- | ------------------------- | -------------------------------- | -------------------- | --------------------------------------- |
| E14-I01 | Select search technology and indexing model | Resolve OQ-11 and avoid rework.                       | Search ADR/decision accepted.                                        | E01-I02, OQ-11            | Architecture/search docs.        | Architecture review. | M / critical / Search choice approved.  |
| E14-I02 | Implement ticket search projection          | Index tenant-scoped ticket/comment searchable fields. | Index contains tenant, resource, version, freshness, deletion state. | E14-I01, E05-I02, E06-I02 | Search projection worker.        | T-SEARCH, T-ISO.     | L / high / Rebuild works.               |
| E14-I03 | Implement search API                        | Provide authorized tenant-scoped search.              | API returns only authorized resources and rechecks source of truth.  | E14-I02, E04-I03          | Search API.                      | T-SEARCH, T-AUTH.    | M / high / Foreign terms denied safely. |
| E14-I04 | Build search UI                             | Help users find tickets with filters and freshness.   | UI supports query, filters, sort, empty states, stale index warning. | E14-I03, E18-I01          | Search pages/components.         | E2E, accessibility.  | M / medium / Search journey passes.     |

## Epic 15 - Settings

| ID      | Title                                             | Description / Business Goal                               | Acceptance Criteria                                                   | Dependencies     | Technical Notes / Files Expected | Tests / Docs        | Complexity / Priority / DoD                         |
| ------- | ------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------- | ---------------- | -------------------------------- | ------------------- | --------------------------------------------------- |
| E15-I01 | Implement tenant settings foundation              | Store tenant configuration safely.                        | Settings namespaces versioned and audited.                            | E04-I03, E16-I01 | Settings tables/API.             | T-AUTH, T-AUDIT.    | M / high / Config changes audited.                  |
| E15-I02 | Implement branding, locale, and timezone settings | Let tenants customize safe presentation.                  | Branding assets validated; timezone/locale accepted.                  | E15-I01          | Settings API/UI.                 | API, accessibility. | M / medium / Tenant switch displays correct config. |
| E15-I03 | Implement security and support access settings    | Let tenants enforce MFA/session/support policy.           | Cannot weaken below platform baseline; approval where required.       | E15-I01, E04-I03 | Security settings.               | T-SEC, T-AUTH.      | M / high / Sensitive changes gated.                 |
| E15-I04 | Implement quota and retention settings            | Control attachment/export/API limits and retention hooks. | Quotas enforce platform/entitlement limits; retention links to OQ-06. | E15-I01, OQ-06   | Quota/retention settings.        | T-PERF, T-SEC.      | M / medium / Limits enforced.                       |

## Epic 16 - Audit Logs

| ID      | Title                            | Description / Business Goal                                   | Acceptance Criteria                                    | Dependencies     | Technical Notes / Files Expected | Tests / Docs      | Complexity / Priority / DoD                  |
| ------- | -------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------ | ---------------- | -------------------------------- | ----------------- | -------------------------------------------- |
| E16-I01 | Implement audit event writer     | Capture immutable evidence for material actions.              | Event envelope matches `audit-events.md`.              | E01-I02, E04-I03 | Audit domain/database.           | T-AUDIT.          | L / critical / Material writes emit audit.   |
| E16-I02 | Implement audit query APIs       | Let authorized users inspect evidence.                        | Filters and exports enforce tenant/content visibility. | E16-I01          | Audit APIs.                      | T-AUTH, T-AUDIT.  | M / high / Audit search passes.              |
| E16-I03 | Implement audit export evidence  | Allow compliant audit exports.                                | Export request/download are audited and rate-limited.  | E13-I03, E16-I02 | Audit export.                    | T-AUDIT, T-SEC.   | M / high / Export cannot bypass permissions. |
| E16-I04 | Add audit integrity and alerting | Detect audit-write failure and suspicious privileged actions. | Audit failures page; privileged failures visible.      | E16-I01, E20-I02 | Observability/alerts.            | Operations tests. | M / high / Audit failure alert fires.        |

## Epic 17 - API

| ID      | Title                                            | Description / Business Goal                             | Acceptance Criteria                                          | Dependencies                | Technical Notes / Files Expected | Tests / Docs                | Complexity / Priority / DoD                           |
| ------- | ------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------ | --------------------------- | -------------------------------- | --------------------------- | ----------------------------------------------------- |
| E17-I01 | Establish API contract and error envelope        | Provide consistent API behavior across modules.         | Shared envelope, pagination, idempotency, errors match docs. | E01-I03                     | API shared contracts.            | Contract tests.             | M / critical / All endpoints use common contract.     |
| E17-I02 | Implement idempotency and concurrency primitives | Prevent duplicate side effects and stale mutations.     | Idempotency keys and ETags work for mutations.               | E17-I01, E05-I01            | API/domain infrastructure.       | Unit, API, replay tests.    | L / high / Duplicate requests return original result. |
| E17-I03 | Implement rate limiting and abuse controls       | Protect auth, search, uploads, exports, webhooks.       | Endpoint-family limits return safe retry guidance.           | E17-I01                     | Rate-limit middleware/store.     | Security/performance tests. | M / high / Abuse tests pass.                          |
| E17-I04 | Generate and validate OpenAPI contract           | Produce future machine-readable API contract from docs. | OpenAPI aligns with docs; schema diff gate planned.          | E17-I01 through module APIs | API schema docs.                 | Contract tests.             | M / medium / Contract reviewed.                       |

## Epic 18 - Frontend

| ID      | Title                                         | Description / Business Goal                             | Acceptance Criteria                                                 | Dependencies                       | Technical Notes / Files Expected | Tests / Docs         | Complexity / Priority / DoD                  |
| ------- | --------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------- | -------------------------------- | -------------------- | -------------------------------------------- |
| E18-I01 | Establish frontend shell and component system | Provide accessible app chrome and reusable UI.          | Tenant switcher, nav, layout, components follow `ui-components.md`. | E01-I03, E17-I01                   | Frontend shell/components.       | T-A11Y.              | L / high / Shell passes accessibility smoke. |
| E18-I02 | Build requester portal flows                  | Let requesters submit and follow tickets.               | Submit/detail/reply/attachment flows pass J-01.                     | E05-I02, E06-I02, E07-I03          | Requester pages.                 | E2E, accessibility.  | L / high / Requester journey passes.         |
| E18-I03 | Build agent workspace flows                   | Let agents manage queues and tickets efficiently.       | Queue/detail/comment/assign/transition flows pass.                  | E05-I04, E06-I04, E10-I04          | Agent pages.                     | E2E, keyboard tests. | XL / high / Agent journey passes.            |
| E18-I04 | Build admin and auditor console flows         | Let admins manage config and auditors inspect evidence. | Users/roles/settings/audit/reports pages pass.                      | E04-I04, E15-I01, E16-I02, E13-I04 | Admin/audit pages.               | E2E, T-A11Y.         | XL / high / Admin/audit journeys pass.       |

## Epic 19 - Testing

| ID      | Title                                                    | Description / Business Goal                   | Acceptance Criteria                                         | Dependencies     | Technical Notes / Files Expected | Tests / Docs         | Complexity / Priority / DoD                |
| ------- | -------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------- | ---------------- | -------------------------------- | -------------------- | ------------------------------------------ |
| E19-I01 | Establish unit and domain test harness                   | Make domain invariants testable from day one. | T-DOM framework and conventions ready.                      | E01-I03          | Test harness.                    | T-DOM.               | M / critical / First domain tests pass.    |
| E19-I02 | Establish tenant isolation and auth matrix tests         | Prevent cross-tenant and RBAC regressions.    | Generated T-ISO and T-AUTH cover resources/roles.           | E04-I03, E17-I01 | Test generators/fixtures.        | T-ISO, T-AUTH.       | L / critical / Negative tests fail closed. |
| E19-I03 | Establish E2E and accessibility suites                   | Verify critical journeys.                     | J-01/J-04 and admin flows have E2E/A11Y scripts.            | E18-I01          | E2E/accessibility setup.         | T-E2E, T-A11Y.       | L / high / Critical journeys automated.    |
| E19-I04 | Establish performance, security, DR, and rollback suites | Validate scale and release safety.            | T-PERF/T-SEC/T-DR/T-ROLLBACK suites planned and executable. | E20-I01, E20-I02 | Performance/security/DR tests.   | T-PERF, T-SEC, T-DR. | XL / high / Release candidate gates pass.  |

## Epic 20 - Production Readiness

| ID      | Title                                                  | Description / Business Goal                  | Acceptance Criteria                                                                      | Dependencies            | Technical Notes / Files Expected | Tests / Docs       | Complexity / Priority / DoD                  |
| ------- | ------------------------------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------- | -------------------------------- | ------------------ | -------------------------------------------- |
| E20-I01 | Establish deployment and environment strategy          | Make releases repeatable and auditable.      | Environments, artifacts, config, and approvals follow release plan.                      | E01-I02, OQ-12          | Deployment docs/future infra.    | Release rehearsal. | L / critical / Deployment strategy approved. |
| E20-I02 | Implement observability and alerting baseline          | Operate the platform safely.                 | Golden/domain signals and runbook-linked alerts exist.                                   | E16-I01, E08-I04        | Telemetry dashboards/alerts.     | Operations tests.  | L / high / Critical alerts actionable.       |
| E20-I03 | Implement backup, restore, retention, and DR readiness | Protect tenant data and recovery objectives. | Restore drills validate tenant ownership, audit, outbox, search rebuild.                 | E15-I04, E16-I01, OQ-14 | Operations/recovery tooling.     | T-DR, T-MIG.       | XL / high / RPO/RTO drill passes.            |
| E20-I04 | Complete GA security and release review                | Decide go/no-go for production release.      | Pen test, dependency review, accessibility, SLO trial, capacity, support readiness pass. | All epics               | Release evidence package.        | All release gates. | XL / critical / GA signoff recorded.         |

## Backlog rules

- Do not start an issue until all dependencies are complete or explicitly waived by architecture review.
- Security, tenant-isolation, audit, migration, and release issues cannot be waived by a feature owner alone.
- Every issue must update docs when behavior diverges from the current specification.
- Each epic closes only when its tests, documentation, and operational evidence are complete.
