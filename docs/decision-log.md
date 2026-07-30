# Decision log

Status meanings: **Accepted** is a binding architectural decision; **Accepted assumption** is a reversible baseline needed for coherent planning and must be validated; **Open** is unresolved and must not be presented as committed. Detailed implementation-driving ADR files live in [adr/](adr/README.md); this document remains the summary register and open-question tracker.

Numbering note: this summary log uses the initial `ADR-001` sequence. The detailed ADR folder uses `ADR-0001` file names for the final architecture foundation records and is linked rather than renumbered to preserve history.

## ADR-001 — Begin as a modular monolith

- **Status:** Accepted
- **Context:** Domain boundaries are known but independent scaling and team topology are not.
- **Decision:** Deploy a stateless modular application and background workers, with bounded-context ownership and contract-enforced dependencies.
- **Consequences:** Simpler transactions and operations initially; modules require discipline. Extract a service only with measured scaling, isolation, availability, or ownership need and a new ADR.

## ADR-002 — Tenant is the universal ownership boundary

- **Status:** Accepted
- **Decision:** Shared infrastructure may host Tenants, but every customer-owned record and execution path carries immutable Tenant context with layered enforcement per TEN-01–TEN-08.
- **Consequences:** Keys, relations, caches, events, files, search, telemetry, tests, and operator tools are Tenant-aware. Ambiguity fails closed.

## ADR-003 — RBAC with scoped Permissions

- **Status:** Accepted
- **Decision:** Authorize stable Permissions assigned through Tenant-scoped Roles, with resource scopes and contextual denies. Code never grants access by role name alone.
- **Consequences:** Flexible custom Roles and testable policy; permission catalog changes require compatibility and matrix updates.

## ADR-004 — Transactional outbox and at-least-once processing

- **Status:** Accepted
- **Decision:** Commit domain state, Audit Event, and outbox atomically; perform external effects asynchronously with idempotent consumers and deduplication keys.
- **Consequences:** No lost intent from dual writes; eventual consistency and replay/reconciliation must be visible and tested.

## ADR-005 — Version published configuration

- **Status:** Accepted
- **Decision:** Workflows, SLA Policies, Business Schedules, and notification templates use mutable drafts and immutable published versions referenced by evaluations.
- **Consequences:** Historical explainability and safe publication at the cost of lifecycle and retention complexity.

## ADR-006 — REST conventions without premature endpoint design

- **Status:** Accepted
- **Decision:** Follow `13-rest-conventions.md`; defer endpoint/resource shapes until capability design. Treat OpenAPI as the future implemented contract.
- **Consequences:** Consistent semantics without falsely claiming APIs exist.

## ADR-007 — Baseline service objectives

- **Status:** Accepted assumption
- **Decision:** Use NFR-01–NFR-06, including 99.9% core availability and RPO ≤5 minutes/RTO ≤60 minutes, for architecture and test planning.
- **Validation:** Product, finance, and operations must approve before M4; supersede by ADR when approved.

## ADR-008 — MIT documentation/repository license

- **Status:** Accepted assumption
- **Decision:** Apply the MIT License to current repository content.
- **Validation:** Legal review before external distribution or M1, whichever occurs first; see OQ-13.

## Open questions

| ID    | Question                                                                                                                     | Owner                   | Resolve by          |
| ----- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------- |
| OQ-01 | Which initial compliance targets (for example SOC 2, ISO 27001, GDPR contractual readiness, HIPAA) and audit dates apply?    | Security/Legal          | M1 planning         |
| OQ-02 | Which data-residency regions and Tenant placement/mobility guarantees are required?                                          | Legal/Architecture      | M1 planning         |
| OQ-03 | Which identity providers and protocols (OIDC, SAML, SCIM), MFA, and domain-discovery behaviors are supported?                | Product/Security        | M1                  |
| OQ-04 | What are launch Tenant counts, largest Tenant/users/Tickets, ingestion bursts, and growth forecasts?                         | Product/Capacity        | M1                  |
| OQ-05 | What availability objectives, maintenance exclusions, support tiers, and contractual remedies are offered?                   | Product/Operations      | M3                  |
| OQ-06 | What retention, deletion, legal-hold, audit, backup, and subject-request periods apply by data class/region?                 | Privacy/Legal           | M1                  |
| OQ-07 | What attachment size/count/type limits, aggregate quotas, and scan/archive requirements apply?                               | Product/Security        | M2                  |
| OQ-08 | Which SLA calendars, time zones, holiday sources, pause/reopen policies, and contractual semantics are supported?            | Product                 | M3                  |
| OQ-09 | Which inbound/outbound email providers, regions, dedicated domains/IPs, webhook guarantees, and failover strategy apply?     | Architecture/Operations | M2                  |
| OQ-10 | Which notification deliverability, localization, branding, unsubscribe, and provider portability requirements apply?         | Product/Legal           | M2                  |
| OQ-11 | Which search technology, languages, analyzers, encryption, residency, deletion latency, and relevance controls are required? | Architecture/Product    | M4                  |
| OQ-12 | Which deployment cloud, regions, managed services, Kubernetes/serverless constraints, and portability goals apply?           | Architecture/Operations | M1                  |
| OQ-13 | Is MIT the approved project and future product-source license; are commercial/third-party notices required?                  | Legal                   | Before distribution |
| OQ-14 | What contractual RPO/RTO apply per failure mode, region, and service tier?                                                   | Product/Operations      | M4                  |

Resolution requires evidence, decision owner approval, an ADR entry (accepted or rejected alternatives), updates to affected requirements/controls/tests/milestones, and removal of any superseded assumption.
