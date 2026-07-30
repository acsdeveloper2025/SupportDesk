# Task 2 documentation review and gap analysis

Review date: 2026-07-30
Reviewer stance: Principal Software Architect, pre-implementation design review
Scope: `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, and every document in `docs/`

Status: superseded by the final architecture foundation in [22-architecture-foundation-completion-report.md](22-architecture-foundation-completion-report.md). This report is retained as review history; resolved findings are noted where the final documentation pass addressed them.

## Executive summary

Overall readiness score: **72 / 100**

Documentation completeness: The Task 1 documentation establishes a strong foundation: clear tenant-first principles, traceable PR/FR IDs, modular-monolith direction, outbox/event handling, baseline security controls, NFRs, testing gates, and a disciplined roadmap. It is stronger than a typical greenfield baseline.

Major risks:

- Implementation is **not ready to start for M1** because several M1-planning decisions remain open: compliance targets, data residency, identity provider protocols, launch scale, retention/legal hold, and deployment cloud (`docs/decision-log.md` OQ-01 through OQ-06 and OQ-12).
- API design is intentionally deferred, but the roadmap expects implementation milestones. This leaves no endpoint inventory, no OpenAPI skeleton, and no resource ownership map for implementation teams.
- The conceptual data model is too thin for the documented product surface. It omits several referenced or required entities such as Organization, Business Schedule, Notification Template, Notification Preference, Workflow Execution, Ticket Link, custom fields, queue/view definitions, retention/legal hold records, and operator elevation records.
- Multi-tenant documentation is directionally strong but lacks tenant configuration specifics for branding, email domains, per-tenant quotas, storage/key strategy, region placement, and tenant lifecycle state transitions.
- Product journeys are under-specified. Only four journeys are documented, leaving administration, requester portal, inbound email, notifications, search, audit export, reporting, and recovery workflows without acceptance criteria.

Recommendation: Do **not** begin implementation beyond M0 discovery/prototyping. First complete a documentation hardening pass that resolves M1 open questions, expands product journeys and acceptance criteria, defines resource/API inventory, enriches the data model, and adds tenant configuration/security details.

## Gap analysis

### Missing features and requirements

Product:

- Tenant lifecycle is in scope (`docs/00-vision.md`) but lacks detailed provisioning, trial/activation, suspension, deletion, restore, data export, and tenant-owner transfer requirements.
- Requester experience is limited to submission/following by web and email; there is no requester portal navigation, email verification, unauthenticated ticket lookup policy, satisfaction survey, or requester notification preference flow.
- Agent workflow lacks queue definitions, collision/ownership handling, internal collaboration model, macro/canned response policy, escalation rules, priority definitions, and bulk-edit behavior.
- Tenant administration lacks concrete requirements for branding, email domain verification, business schedule management, workflow publishing UX, SLA policy lifecycle, custom fields, roles/groups, audit export, and configuration rollback.
- Reporting was listed as in scope but originally lacked report catalog, dashboard KPI, export format, freshness, and access-model detail; the final foundation adds report/export API contracts and implementation-plan issues.
- Entitlement is in the glossary, but billing execution is out of scope and no interim entitlement/quota model is specified.
- No customer-support operating model exists for the SaaS provider: support tiers, support access approval, tenant break-glass process, customer communications, and contractual remedies are unresolved.

Architecture:

- Component boundaries were originally named without module-contract detail; [05-architecture.md](05-architecture.md) now adds bounded context responsibilities.
- The context diagram does not include cache, admin UI, requester portal boundary, identity/session store, email inbound parsing path, malware scanning service, or provider webhooks.
- The architecture states transactional state is authoritative and search/caches are projections; the final foundation adds projection, indexing, and planning coverage, while detailed rebuild/poison-message implementation remains milestone work.
- Queue/backpressure rules exist but no partitioning strategy, per-tenant fairness model, dead-letter ownership, replay controls, or capacity limits are documented.
- No deployment topology, regional architecture, environment strategy, or managed-service assumptions are accepted.

Multi-tenant design:

- Tenant isolation controls are strong, but tenant configuration is not modeled: branding, domains, email sender identities, locale/time zone defaults, quotas, retention policy, feature flags, and support access policy.
- Data-residency and tenant placement are open, yet they affect database, object storage, search, backups, telemetry, and email provider selection.
- Shared infrastructure is accepted, but no per-tenant encryption-key strategy or key hierarchy is specified.
- Storage strategy was originally incomplete; the final foundation adds attachment, scan, quota, lifecycle, and storage-strategy requirements, while vendor-specific object key and bucket partitioning decisions remain tied to OQ-02/OQ-12.
- Data leakage risk remains around telemetry/product analytics because only pseudonymous tenant keys are mentioned; event taxonomy and privacy classification are absent.

Database design:

- Missing entities likely required: Organization, Queue/View, Tag, Custom Field Definition/Value, Ticket Link, Ticket Watcher/Subscriber, Ticket Assignment History, Workflow Execution, Workflow Action Attempt, Notification Intent, Notification Template Version, Notification Preference, Email Message, Email Address, Business Schedule Version, SLA Evaluation Evidence, File Scan Result, Export Job, Retention Policy, Legal Hold, Operator Elevation, Session, API Token, Idempotency Key, and Webhook/Event Delivery.
- Index strategy was originally absent; [database/INDEXING.md](database/INDEXING.md) now covers tenant-scoped lookups, queues, ticket references, status/priority/due dates, assignment, search projection, outbox claiming, audit filtering, export jobs, and retention scans.
- Foreign-key and tenant-consistency strategy is only conceptual; it should define composite tenant-aware constraints or equivalent enforcement.
- Audit fields are not standardized across mutable entities. The docs mention timestamps/versioning but not created/updated/deleted actor, reason, source, or correlation metadata requirements.
- Soft deletion and legal hold are too vague. The docs say deletion uses retention state, but do not define lifecycle states, anonymization, restore windows, or audit-preserving deletion behavior.
- Naming conventions are not specified for tables, columns, IDs, enums, version fields, and public references.

API design:

- REST conventions are solid but there is no endpoint/resource inventory. ADR-006 intentionally defers endpoint shapes, but implementation cannot begin safely without at least a non-binding API surface map.
- Missing endpoint families likely required: tenants, tenant settings, memberships, roles, permissions, groups, requester profiles, organizations, tickets, comments, attachments, upload sessions, queues/views, workflow drafts/publications, SLA policies, business schedules, notification templates/preferences, search, reports, exports, audit events, sessions, identity-provider connections, inbound email webhooks, outbound notification webhooks, outbox/admin operations, file scan callbacks, health/readiness, and operation status resources.
- Error envelope lacks concrete fields, example codes, localization rules, validation error shape, correlation response header, and enumeration-safe 404/403 policy.
- Pagination, filtering, and sorting are defined at a style level but not per resource.
- No API version lifecycle policy exists for deprecation duration, client compatibility tests, schema diff gates, or SDK/client generation.

Security:

- Authentication is under-specified: no password policy, account recovery, MFA enrollment/recovery, session TTL, refresh-token rotation, device/session management, step-up auth, service accounts, API tokens, or SSO fallback rules.
- Authorization is strong conceptually but lacks a permission catalog and resource-by-action matrix.
- OWASP coverage is partial. Injection, CSRF, CORS/CSP, SSRF, and output encoding are mentioned, but XSS-rich text sanitization, email HTML sanitization, request smuggling, clickjacking, dependency runtime hardening, and admin abuse cases need explicit controls.
- File upload security needs more detail: streaming upload limits, archive-bomb protection, extension/content mismatch handling, image metadata stripping, quarantine UX, malware scan provider failure behavior, and safe preview/download policy.
- Secret handling is stated but not operationalized: rotation cadence, break-glass access, local developer secrets, CI secret scopes, secret scanning response, and vendor credential compartmentalization are missing.
- Audit logging is strong but missing tamper-evidence specifics, immutable store choice, retention classes, query access controls, and alert rules for audit gaps.

UI/UX:

- No information architecture exists for requester, agent, admin, auditor, and platform operator experiences.
- Dashboard requirements are missing: agent workload, SLA risk, backlog, notifications, team performance, admin health, audit/security panels.
- Search UX lacks scope controls, saved filters, result ranking explanation, stale index indicators, no-result recovery, keyboard behavior, and export affordances.
- Ticket workflow UX needs wire-level rules for public/internal comments, attachments, activity timeline, conflict resolution, assignment, merge/link/follow-up, reopen, and close.
- Mobile responsiveness has a minimum width, but no mobile-specific navigation, triage workflow, email deep-link behavior, or offline/degraded behavior.
- Accessibility standards are good, but supported browser/assistive-technology pairs are not listed.

Performance and scalability:

- NFR-03 scale targets are very large but unvalidated. The docs do not show expected tenant skew, hot tenants, archive strategy, partitioning, or query patterns.
- Search/reporting scalability is a major gap: no indexing architecture, relevance model, authorization recheck cost model, aggregation strategy, or report precomputation plan.
- Dashboard performance is not specified; dashboards can become expensive cross-table aggregations.
- Attachment handling can bottleneck storage, scanning, previews, download authorization, and backups; quotas and lifecycle policies are open.
- Notification scalability lacks provider rate-limit strategy, per-tenant fairness, suppression-list scaling, and webhook burst handling.

Testing:

- Test suite taxonomy is strong, but no traceability from each journey/endpoint/entity to concrete tests exists yet.
- Security testing needs explicit threat-model scenarios, abuse cases, file upload adversarial cases, email spoofing/replay tests, and operator-elevation tests.
- Load testing lacks data model cardinalities, tenant skew distributions, attachment sizes, queue backlogs, and report/search datasets.
- Disaster recovery testing does not define failure modes by datastore/vendor/region or acceptance evidence.
- Accessibility testing lacks target browser/AT matrix and manual test scripts.

### Inconsistencies

- Resolved in the final architecture foundation: `docs/05-architecture.md` now defines `ARC-01` through `ARC-05`, and `docs/04-functional-requirements.md` links `ARC-04` and `ARC-05`.
- The roadmap says M0 exits when open decisions have owners, but implementation milestones still depend on open M1 questions. The docs should distinguish "owner assigned" from "decision resolved".
- `docs/00-vision.md` includes reporting and administration in initial scope, but functional requirements only provide broad `FR-10`, `FR-11`, and `FR-12` coverage without workflow-level acceptance.
- Resolved in the final architecture foundation: `docs/database/ERD.md` and `docs/database/TABLES.md` now include Organization, Business Schedule, templates, notification attempts, and related configuration/version entities.
- Resolved in the final architecture foundation: `docs/api/` now provides a resource inventory and endpoint family contracts for implementation planning.
- Partially mitigated in the final architecture foundation: `docs/database/INDEXING.md`, `docs/database/MIGRATION-STRATEGY.md`, and `docs/github-project-plan.md` now define scale-planning work, but OQ-04 still needs business approval.

### Ambiguities

- "Trusted routing" for tenant context still needs a concrete implementation choice: subdomain, path, selected membership, custom domain, or email route.
- "Complete Ticket and Comment lifecycle" is not precise enough for merging, linking, reopening windows, satisfaction, spam, requester identity changes, and inbound email threading.
- "Operational reports" now have initial API/planning coverage, but specific report catalog decisions still need business prioritization.
- "Tenant Administrator can configure access, workflows, schedules, and reporting" does not say which settings are self-service, approval-gated, versioned, or reversible.
- "Platform Operator" elevation does not define approvers, duration, scope, content access, dual control, or customer visibility.
- "Business Schedule-aware SLA Targets" does not define multiple calendars per tenant, holiday source authority, tenant locale, or schedule ownership.
- "No Tenant content by default" for operators leaves unclear whether metadata, telemetry, file names, email headers, or ticket subjects are content.

### Assumptions

- Accepted: initial deployment is a stateless modular monolith plus background workers.
- Accepted: Tenant is the universal ownership boundary on shared infrastructure.
- Accepted: RBAC uses scoped permissions, not role-name checks.
- Accepted: transactional outbox and at-least-once processing are required.
- Accepted: workflows, SLA policies, schedules, and notification templates are draft/published/versioned.
- Accepted: REST conventions apply before concrete endpoint design.
- Accepted assumption: baseline SLO/RPO/RTO targets are planning inputs, not approved commitments.
- Accepted assumption: MIT license applies to current repository content pending legal review.
- Inferred: initial channels are web and email only.
- Inferred: implementation will start with shared database/infrastructure unless data residency or isolation tier decisions change.
- Inferred: search, cache, analytics, and notifications are eventually consistent projections.
- Inferred: OpenAPI, exact endpoints, vendor choices, and deployment topology will be defined later.

## Risk register

| Risk                                                                                                       | Impact                                                                                                         |  Likelihood | Recommended mitigation                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------: | --------------------------------------------------------------------------------------------------------------------------------------------- |
| M1 begins before compliance, residency, identity, retention, scale, and deployment decisions are resolved. | Rework in auth, data model, hosting, and security controls.                                                    |        High | Resolve OQ-01 to OQ-06 and OQ-12 before M1 implementation planning.                                                                           |
| Unresolved scale and platform assumptions remain after traceability fixes.                                 | Teams may overbuild or underbuild storage, search, reporting, and recovery paths.                              | Medium-high | Resolve OQ-04, OQ-11, OQ-12, and validate NFR-03/NFR-05 with performance profiles.                                                            |
| Missing API/resource inventory.                                                                            | Teams implement inconsistent endpoints and authorization boundaries.                                           |        High | Add a resource inventory and initial OpenAPI outline without implementation code.                                                             |
| Thin data model omits core entities.                                                                       | Migrations and module boundaries will churn early.                                                             |        High | Expand conceptual model and entity invariants before schema design.                                                                           |
| Tenant configuration is not fully specified.                                                               | Branding, domains, quotas, retention, and email settings may leak or drift across tenants.                     | Medium-high | Add tenant settings/configuration document with ownership and versioning rules.                                                               |
| Scale targets are unvalidated.                                                                             | Architecture may fail for large tenants or reporting/search workloads.                                         | Medium-high | Create capacity model, data-volume assumptions, and performance test profiles.                                                                |
| Search/reporting design is deferred too far.                                                               | Authorization leakage or unacceptable dashboard/report latency.                                                |        High | Define search indexing, report aggregation, export authorization, and freshness contracts before M4 design starts.                            |
| File upload security lacks edge-case handling.                                                             | Malware, data leakage, storage exhaustion, or unsafe previews.                                                 | Medium-high | Add upload threat model, limits, scan flow, preview policy, and quota/lifecycle rules.                                                        |
| Authentication/session rules are under-specified.                                                          | Inconsistent security posture across web/email/API/SSO.                                                        | Medium-high | Define auth/session policy, MFA/step-up, token rotation, recovery, and service account rules.                                                 |
| Operator elevation is underspecified.                                                                      | Insider-risk and support-access controls may fail audit.                                                       |      Medium | Define JIT elevation workflow, dual approval, scope, customer visibility, logging, and expiry.                                                |
| Product journeys are too sparse.                                                                           | Acceptance criteria will be invented during implementation.                                                    |        High | Add journeys for requester portal, inbound email, triage, admin config, notifications, search/reporting, audit export, and incident recovery. |
| Reporting/export requirements are broad.                                                                   | Privacy, performance, and access-control requirements may conflict.                                            |      Medium | Add report catalog, export formats, row limits, async export flow, and audit rules.                                                           |
| Retention/legal hold unresolved.                                                                           | Deletion, backups, audit, search, and exports may violate policy.                                              |        High | Resolve OQ-06 before data model and storage design.                                                                                           |
| Email provider/domain decisions are unresolved.                                                            | Inbound routing, sender identity, deliverability, and webhook security may rework communications architecture. | Medium-high | Resolve OQ-09/OQ-10 before M2 email foundation.                                                                                               |
| Accessibility standards lack concrete target matrix.                                                       | Passing criteria may be subjective.                                                                            |      Medium | Define supported browsers/AT pairs and manual scripts.                                                                                        |

## Improvement recommendations

### Critical

- Resolve M1 blockers: compliance targets, data residency, identity protocols, launch scale, retention/legal hold, and deployment cloud.
- Keep architecture controls synchronized as implementation evolves; `ARC-04` and `ARC-05` are now defined.
- Add a resource/API inventory with endpoint families, ownership, auth scope, pagination/filtering/sorting needs, and expected async operation resources.
- Expand the conceptual data model to include all referenced domain/configuration/security/operations entities and tenant-aware constraints.

### High

- Add detailed tenant configuration requirements for branding, email domains, sender identities, locale/time zone, quotas, retention, feature flags, storage, and support access.
- Add product journeys and acceptance criteria for administration, inbound email, requester portal, notifications, search/reporting, audit export, and incident recovery.
- Define authentication/session policy: password/MFA, SSO/SCIM assumptions, session duration, refresh rotation, revocation, recovery, API tokens, and service accounts.
- Add file upload/storage threat model with limits, scan behavior, quarantine, preview/download, lifecycle, and quotas.
- Add search/reporting architecture: indexing, authorization recheck, deletion propagation, relevance/freshness, report aggregation, export limits, and dashboard performance.

### Medium

- Add module responsibility tables for each bounded context.
- Define database naming conventions, standard audit fields, soft-delete states, FK/composite tenant constraints, and index strategy.
- Add workflow execution observability and admin UX requirements for drafts, validation, publishing, rollback, pausing, and evidence.
- Add performance capacity model using expected tenant skew, largest tenant profile, queue volumes, attachments, and report/search load.
- Add security test scenarios for OWASP, email spoofing, webhook replay, file upload abuse, cross-tenant restoration, and operator elevation.

### Low

- Add examples for REST errors, pagination cursors, idempotency behavior, and conflict responses.
- Add support/on-call operational workflow examples and severity table.
- Add glossary entries for Queue, View, Template, Notification Intent, Export Job, Legal Hold, Session, and Operator Elevation.
- Add changelog entries for this review and future documentation hardening tasks when they land.

## Readiness assessment

The project is **not ready to begin implementation** beyond discovery, prototypes, and documentation hardening.

Before implementation starts, complete these first:

1. Resolve or baseline the M1 open questions that affect architecture: OQ-01 through OQ-06 and OQ-12.
2. Keep the newly added architecture controls, API inventory, and database blueprint current during implementation planning.
3. Expand product journeys and acceptance criteria so each initial workflow has a testable definition of done.
4. Produce a resource/API inventory and module ownership map.
5. Expand the conceptual data model, tenant configuration model, and security/session model.
6. Define the capacity/search/reporting/storage assumptions required to validate NFR-03, NFR-05, and attachment handling.

Implementation can begin after this review is converted into approved documentation updates and the roadmap M0 exit criteria are met.
