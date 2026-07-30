# Product requirements

IDs are stable. Priority uses Must/Should/May.

| ID | Requirement | Priority | Measure |
|---|---|---|---|
| PR-01 | Isolate all customer data and execution by Tenant. | Must | Zero cross-Tenant access in automated suites and production incidents. |
| PR-02 | Provide secure identity, Tenant Membership, Role, Group, and Permission administration. | Must | 100% protected actions pass authorization matrix tests. |
| PR-03 | Manage the complete Ticket and Comment lifecycle across web and email. | Must | J-01 end-to-end tests pass. |
| PR-04 | Route and automate work with deterministic, versioned Workflows. | Must | 99.9% evaluated events terminal within 60 seconds monthly. |
| PR-05 | Calculate and expose Business Schedule-aware SLA Targets. | Must | ≥99.99% calculation accuracy against approved fixtures. |
| PR-06 | Deliver secure, preference-aware notifications with retries and suppression. | Must | Delivery terminal-state target in [NFR](15-non-functional-requirements.md). |
| PR-07 | Offer Tenant-scoped search, queues, audit, and operational reports. | Must | Freshness and latency targets met; authorization tested. |
| PR-08 | Meet security, privacy, accessibility, and audit controls. | Must | No open critical/high release finding; WCAG 2.2 AA checks pass. |
| PR-09 | Operate with measurable availability, performance, recovery, and supportability. | Must | Published SLOs and recovery drills meet targets. |
| PR-10 | Allow safe evolution through compatible contracts and deployment controls. | Must | Rollback drill and migration gates pass each release class. |

## Global acceptance rules

All writes validate input, Tenant context, Permission, current version, and domain invariants before commit. Successful material writes atomically create Audit Events and outbox records. Duplicate idempotent requests yield the original semantic result. Rejected requests do not partially mutate state or reveal cross-Tenant existence.
