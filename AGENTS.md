# Repository instructions

These rules apply to the entire repository.

## Coding and repository conventions

- Keep product, domain, and platform boundaries explicit; domain logic must not depend on transport, persistence, or vendor SDKs.
- Prefer a modular monolith initially, with modules aligned to the bounded contexts in `docs/05-architecture.md`. Do not create distributed services without an accepted decision record.
- Use the exact domain terms and capitalization in `docs/glossary.md`. Stable requirement, control, decision, and milestone IDs must never be silently reused.
- Keep source files small and cohesive; favor explicit contracts, immutable inputs, UTC timestamps, structured configuration, and deterministic behavior.
- Do not commit secrets, generated dependencies, build outputs, editor state, or package-manager artifacts unless the project later adopts and documents a lockfile policy.

## Architecture and dependencies

- Enforce Tenant context at authentication, authorization, service, data-access, cache, object-storage, search, job, and observability boundaries.
- Apply least privilege, deny by default, defense in depth, idempotency for retried mutations, and transactional outbox patterns for external side effects.
- Add a dependency only when maintained, licensed compatibly, security-scanned, pinned according to ecosystem practice, and justified against standard-library or existing options. Record critical/vendor-locking choices in `docs/decision-log.md`.
- Never expose persistence entities directly through an API. Validate at trust boundaries and use versioned domain contracts.

## Documentation synchronization

- A behavior change must update its product requirement (`PR-*`), functional requirement (`FR-*`), acceptance criteria, traceability row, tests, and relevant architecture/security/operations documentation in the same pull request.
- Data, authorization, workflow, SLA, event, deployment, or recovery changes must update documents 05–19 and the decision log where the decision is durable.
- Database, API, permission, workflow, audit, notification, email, error, UI, or coding-standard changes must update the expanded architecture foundation documents under `docs/database/`, `docs/api/`, `docs/permissions-matrix.md`, `docs/workflow-matrix.md`, `docs/audit-events.md`, `docs/notification-events.md`, `docs/email-templates.md`, `docs/errors.md`, `docs/ui-components.md`, and `docs/coding-standards.md`.
- New terminology must be added to `docs/glossary.md`; do not create near-synonyms. Cross-references must remain valid.
- Accepted decisions belong in an ADR-style entry; uncertain items remain under Open Questions and must not be represented as final.

## Git and pull-request workflow

- Branch from the current protected default branch; make focused, reviewable commits using imperative subjects. Do not rewrite shared history.
- Pull requests must explain intent, scope, linked requirements/decisions, risk, tenant and security impact, migrations, tests, deployment, observability, and rollback.
- Require at least one owning-team approval; require security or data-platform approval for authentication, authorization, cryptography, isolation, audit, sensitive data, or migration changes.
- Resolve review discussions and keep CI green before merge. Use squash merge unless release policy specifies otherwise.

## Testing, security, and quality gates

- Required gates: formatting/lint, type/static analysis, unit, integration, contract, tenant-isolation negative tests, authorization matrix tests, migration verification, dependency/license scan, secret scan, SAST, and build reproducibility.
- Changed critical journeys require end-to-end and accessibility coverage. Security-critical parsers and workflow transitions require fuzz/property tests where practical.
- Never weaken a gate to make CI pass. Document justified exceptions with owner, expiry, compensating control, and approval.

## Migration safety

- Use backward-compatible expand/migrate/contract changes. Never combine destructive contraction with the release that introduces its replacement.
- Migrations must be repeatable or safely resumable, bounded, observable, tenant-aware, tested at production-like scale, and accompanied by backup/restore and rollback or roll-forward procedures.
- Avoid long locks and unbounded backfills. Run backfills as throttled, checkpointed jobs. Validate row counts, constraints, and tenant ownership before contraction.

## Error handling

- Fail closed for authentication, authorization, and Tenant-context uncertainty. Do not leak secrets, personal data, stack traces, internal IDs, or cross-Tenant existence.
- Return stable machine-readable error codes, safe human messages, correlation IDs, and appropriate retry guidance. Preserve the causal chain in structured server logs.
- Classify errors as validation, authentication, authorization, conflict, rate limit, transient dependency, or internal. Retry only transient, idempotent work with bounded exponential backoff and jitter.

## Review checklist and Definition of Done

Reviewers verify: requirement linkage; correct terms; isolation and RBAC; threat and privacy impact; failure/idempotency behavior; data constraints and migration safety; observability; performance; accessibility; tests; deployment and rollback; documentation and decision updates.

Work is done only when acceptance criteria pass; required reviews and CI gates pass; no unresolved critical/high vulnerability exists; Tenant boundaries and audit behavior are tested; operational dashboards/alerts and runbooks exist; deployment and rollback are validated; documentation and traceability are current; and the change is deployable independently without undocumented manual action.
