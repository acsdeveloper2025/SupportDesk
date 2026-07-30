# Sprint plan

This plan groups [github-backlog.md](github-backlog.md) into 14 sequential sprints. Sprint contents can be adjusted for team size, but dependency order from [implementation-order.md](implementation-order.md) must not be violated.

## Sprint 1 - Foundation decisions and governance

- Objectives: resolve blocking business/platform questions; approve standards and governance.
- Issues: E01-I01, E01-I02, E01-I03, E01-I04.
- Dependencies: none.
- Exit criteria: OQ gates resolved/accepted; repo standards and planning docs approved.
- Risk level: High, because unresolved decisions can block all future work.

## Sprint 2 - API and test foundation

- Objectives: establish shared API contract, error envelope, and unit/domain test harness.
- Issues: E17-I01, E19-I01.
- Dependencies: Sprint 1.
- Exit criteria: API conventions and first test harness are ready for implementation.
- Risk level: Medium.

## Sprint 3 - Authentication core

- Objectives: design auth module and implement login/session lifecycle.
- Issues: E02-I01, E02-I02.
- Dependencies: Sprint 2.
- Exit criteria: secure login/logout/refresh flows are testable and audited.
- Risk level: High.

## Sprint 4 - Account recovery and MFA

- Objectives: complete password reset, verification, session management, and MFA baseline.
- Issues: E02-I03, E02-I04.
- Dependencies: Sprint 3, notification/email template stubs where needed.
- Exit criteria: account recovery and privileged step-up behavior pass security tests.
- Risk level: High.

## Sprint 5 - RBAC and audit foundation

- Objectives: implement permission catalogue, roles, memberships, evaluator, and audit writer.
- Issues: E04-I01, E04-I02, E04-I03, E16-I01, E19-I02.
- Dependencies: Sprint 3.
- Exit criteria: permission matrix and tenant isolation negative tests pass.
- Risk level: High.

## Sprint 6 - Admin access management

- Objectives: build role/member/group admin UI and organization foundation.
- Issues: E04-I04, E03-I01, E03-I02, E03-I03.
- Dependencies: Sprint 5.
- Exit criteria: Tenant Admin can manage users, roles, groups, and organizations safely.
- Risk level: Medium.

## Sprint 7 - Ticket and comment core

- Objectives: implement ticket aggregate, create/read/update/transition APIs, comments, and redaction.
- Issues: E05-I01, E05-I02, E05-I03, E05-I04, E06-I01, E06-I02, E06-I03.
- Dependencies: Sprint 5 and Sprint 6.
- Exit criteria: ticket lifecycle and comment visibility tests pass.
- Risk level: High.

## Sprint 8 - Ticket UX and attachments

- Objectives: build ticket UI, requester/agent flows, and safe attachment handling.
- Issues: E06-I04, E07-I01, E07-I02, E07-I03, E07-I04, E18-I02, E18-I03, E19-I03.
- Dependencies: Sprint 7 and OQ-07.
- Exit criteria: requester and agent critical journeys pass E2E and accessibility tests.
- Risk level: High.

## Sprint 9 - Notifications and email

- Objectives: implement notification intents, in-app notifications, preferences, templates, outbound and inbound email.
- Issues: E08-I01, E08-I02, E08-I03, E08-I04, E09-I01, E09-I02, E09-I03, E09-I04.
- Dependencies: Sprint 8 and OQ-09/OQ-10.
- Exit criteria: notification matrix and email catalogue behavior pass retry/failure tests.
- Risk level: High.

## Sprint 10 - SLA and workflow automation

- Objectives: implement schedules, SLA policies/targets, warnings/breaches, workflow engine and admin.
- Issues: E10-I01, E10-I02, E10-I03, E10-I04, E11-I01, E11-I02, E11-I03, E11-I04.
- Dependencies: Sprint 9 and OQ-08.
- Exit criteria: deterministic SLA and workflow replay/dedupe tests pass.
- Risk level: High.

## Sprint 11 - Search and reports

- Objectives: implement search technology choice, indexing, search API/UI, report aggregates, report APIs.
- Issues: E14-I01, E14-I02, E14-I03, E14-I04, E13-I01, E13-I02.
- Dependencies: Sprint 10 and OQ-11.
- Exit criteria: search/report tenant-isolation and freshness tests pass.
- Risk level: High.

## Sprint 12 - Exports, audit views, dashboards

- Objectives: implement export jobs, audit export/query, dashboard metrics and UIs.
- Issues: E13-I03, E13-I04, E16-I02, E16-I03, E03-I04, E12-I01, E12-I02, E12-I03, E12-I04.
- Dependencies: Sprint 11.
- Exit criteria: exports, audit, dashboards pass authorization and performance smoke tests.
- Risk level: Medium-high.

## Sprint 13 - Settings, API hardening, frontend completion

- Objectives: implement tenant settings, idempotency, rate limiting, OpenAPI validation, frontend shell, admin/auditor console.
- Issues: E15-I01, E15-I02, E15-I03, E15-I04, E17-I02, E17-I03, E17-I04, E18-I01, E18-I04.
- Dependencies: Sprint 12.
- Exit criteria: settings and frontend flows pass security, API, E2E, and accessibility gates.
- Risk level: Medium-high.

## Sprint 14 - Production readiness and GA review

- Objectives: complete observability, alerts, backup/restore/DR, performance/security/release gates, GA signoff.
- Issues: E16-I04, E19-I04, E20-I01, E20-I02, E20-I03, E20-I04.
- Dependencies: Sprint 13 and OQ-14.
- Exit criteria: release plan passes; no critical/high risk remains; GA go/no-go signoff recorded.
- Risk level: High.

## Sprint rules

- Every sprint must close documentation updates with implementation changes.
- Tenant isolation, authorization, audit, and security failures block sprint exit.
- Risk level cannot be downgraded without architecture and security approval.
