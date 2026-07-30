# Functional requirements

| ID    | Rule and acceptance criteria                                                                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-01 | **Tenant context:** Given any read, write, job, event, cache, search, or object request, when context is absent or mismatched, then access is denied, no existence is disclosed, and a security signal is emitted. |
| FR-02 | **Membership/RBAC:** Given an active Tenant Membership, when an action is requested, then all required Permissions and resource scopes must pass; suspended membership denies immediately.                         |
| FR-03 | **Ticket creation:** Valid subject, description, Requester, Channel, and Tenant create one `new` Ticket, initial Comment, audit evidence, and outbox event atomically.                                             |
| FR-04 | **Lifecycle:** Only transitions in [status rules](09-ticket-lifecycle.md) are accepted; each accepted transition is concurrency-controlled and audited.                                                            |
| FR-05 | **Assignment:** An Agent or Group may be assigned only when active in the Ticket Tenant and visible to the actor.                                                                                                  |
| FR-06 | **Comments/attachments:** Public/internal visibility is immutable after dispatch; attachment access inherits Ticket authorization and requires successful scanning.                                                |
| FR-07 | **Workflow:** Each Domain Event is evaluated once per applicable published Workflow version; actions are deduplicated and bounded.                                                                                 |
| FR-08 | **SLA:** Policy selection, Target start/pause/resume/complete, and recalculation follow [SLA rules](10-sla.md) and retain evaluation evidence.                                                                     |
| FR-09 | **Notification:** Recipients, preferences, templates, retries, bounces, and suppression follow [notification rules](11-notifications.md).                                                                          |
| FR-10 | **Search/reporting:** Results contain only authorized current-Tenant resources; index lag is visible and source-of-truth authorization is rechecked.                                                               |
| FR-11 | **Audit/export:** Authorized users can filter and export Tenant Audit Events; content access and export are themselves audited.                                                                                    |
| FR-12 | **Administration:** Draft configuration validates before atomic publication; historical records retain the applied version.                                                                                        |

## Traceability matrix

| Product | Functions           | Design/control                                                                                                                                    | Verification      | Milestone |
| ------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------- |
| PR-01   | FR-01, FR-10        | [TEN controls](06-tenant-isolation.md), SEC-01                                                                                                    | T-ISO             | M1–M4     |
| PR-02   | FR-02, FR-05, FR-12 | [RBAC](08-rbac.md), SEC-02                                                                                                                        | T-AUTH            | M1, M3    |
| PR-03   | FR-03–FR-06         | [lifecycle](09-ticket-lifecycle.md), [data](12-data-model.md)                                                                                     | T-DOM, T-E2E      | M2        |
| PR-04   | FR-07, FR-12        | [automation](09-ticket-lifecycle.md), [ARC-04](05-architecture.md#architecture-control-catalogue), [workflow matrix](workflow-matrix.md)          | T-WF              | M3        |
| PR-05   | FR-08               | [SLA](10-sla.md)                                                                                                                                  | T-SLA             | M3        |
| PR-06   | FR-09               | [notifications](11-notifications.md), SEC-07                                                                                                      | T-NOTIFY          | M2–M3     |
| PR-07   | FR-10, FR-11        | [architecture](05-architecture.md), SEC-08                                                                                                        | T-SEARCH, T-AUDIT | M4        |
| PR-08   | all                 | [security](07-security-compliance.md), [UX](14-ui-ux-accessibility.md)                                                                            | T-SEC, T-A11Y     | all       |
| PR-09   | all                 | [NFR](15-non-functional-requirements.md), [operations](19-operations-recovery.md)                                                                 | T-PERF, T-DR      | M4–M5     |
| PR-10   | FR-12               | [CI/CD](18-deployment-cicd.md), [ARC-05](05-architecture.md#architecture-control-catalogue), [migration strategy](database/MIGRATION-STRATEGY.md) | T-MIG, T-ROLLBACK | all       |

Test suite identifiers are defined in [testing](16-testing-quality.md); milestone exits are defined in [roadmap](20-roadmap.md).
