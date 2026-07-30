# GitHub milestones

This milestone plan converts the architecture roadmap into GitHub-friendly delivery milestones. It is planning only and must be used with [github-backlog.md](github-backlog.md), [implementation-order.md](implementation-order.md), [sprint-plan.md](sprint-plan.md), and [release-plan.md](release-plan.md).

## Milestone summary

| Milestone | Name           | Goal                                                                            | Key epics                          | Exit criteria                                                                                        |
| --------- | -------------- | ------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| M1        | Foundation     | Approve business/platform decisions, standards, API contract, and test harness. | Epic 1, Epic 17, Epic 19           | OQ gates resolved or accepted; issue templates and governance approved; base contract tests planned. |
| M2        | Authentication | Deliver secure identity, sessions, account recovery, MFA baseline.              | Epic 2                             | Login/logout/refresh/reset/session flows pass auth/security tests.                                   |
| M3        | Organizations  | Deliver organization grouping and tenant admin structure.                       | Epic 3                             | Organization CRUD, ticket history, scoped authorization, admin UI pass.                              |
| M4        | Permissions    | Deliver RBAC, permission evaluator, membership/group administration.            | Epic 4                             | Permission matrix tests pass; stale auth invalidated; privileged actions audited.                    |
| M5        | Tickets        | Deliver ticket engine, comments, core frontend ticket journeys.                 | Epic 5, Epic 6, part of Epic 18    | J-01 create/read/comment/transition journey passes.                                                  |
| M6        | Attachments    | Deliver safe upload, scan, quarantine, and download.                            | Epic 7                             | Dirty files blocked; clean files authorized; upload abuse tests pass.                                |
| M7        | Notifications  | Deliver notification intents, in-app notifications, preferences, email.         | Epic 8, Epic 9                     | Delivery/retry/failure handling works; inbound/outbound email tests pass.                            |
| M8        | SLA            | Deliver schedules, SLA policies, targets, warnings, and workflow engine.        | Epic 10, Epic 11                   | SLA fixtures pass; workflow replay/dedupe/pause behavior passes.                                     |
| M9        | Reports        | Deliver search, reports, exports, dashboards, audit logs.                       | Epic 12, Epic 13, Epic 14, Epic 16 | Search/report/export tenant-isolation and performance tests pass.                                    |
| M10       | Production     | Deliver release, observability, DR, security, accessibility, GA readiness.      | Epic 15, Epic 19, Epic 20          | Release gates pass; SLO trial complete; go/no-go signed off.                                         |

## Milestone details

### M1 Foundation

- Issues: E01-I01 through E01-I04, E17-I01, E19-I01.
- Dependencies: none.
- Required decisions: OQ-01, OQ-02, OQ-03, OQ-04, OQ-06, OQ-12 resolved or accepted.
- Exit: implementation may begin only after architecture owner and product owner approval.

### M2 Authentication

- Issues: E02-I01 through E02-I04.
- Dependencies: M1.
- Exit: secure sessions, reset, verification, MFA hooks, audit, and abuse controls pass.

### M3 Organizations

- Issues: E03-I01 through E03-I04.
- Dependencies: M2 and core RBAC planning from M4 where required.
- Exit: organization CRUD and scoped ticket history are tenant-safe.

### M4 Permissions

- Issues: E04-I01 through E04-I04.
- Dependencies: M1/M2.
- Exit: permission matrix is enforced at API and UI boundaries.

### M5 Tickets

- Issues: E05-I01 through E05-I04, E06-I01 through E06-I04, E18-I02, E18-I03 where scoped to ticket flows.
- Dependencies: M2, M3, M4.
- Exit: requester and agent ticket journeys pass.

### M6 Attachments

- Issues: E07-I01 through E07-I04.
- Dependencies: M5 and OQ-07.
- Exit: upload, quarantine, scan, download, and deletion flows pass security tests.

### M7 Notifications

- Issues: E08-I01 through E08-I04, E09-I01 through E09-I04.
- Dependencies: M5/M6 and OQ-09/OQ-10.
- Exit: notification matrix and email templates are implemented and tested.

### M8 SLA

- Issues: E10-I01 through E10-I04, E11-I01 through E11-I04.
- Dependencies: M7 and OQ-08.
- Exit: SLA and workflow engines are deterministic, replay-safe, and administrable.

### M9 Reports

- Issues: E12-I01 through E12-I04, E13-I01 through E13-I04, E14-I01 through E14-I04, E16-I02 through E16-I03.
- Dependencies: M8 and OQ-11.
- Exit: dashboards, search, reports, exports, and audit views pass tenant isolation and performance gates.

### M10 Production

- Issues: E15-I02 through E15-I04, E16-I04, E17-I02 through E17-I04, E18-I01 through E18-I04, E19-I02 through E19-I04, E20-I01 through E20-I04.
- Dependencies: M9 and OQ-14.
- Exit: release plan passes, no critical/high release risk remains, and GA signoff is recorded.
