# Coding standards

This document defines implementation standards for future source code. It does not create source code. It complements [../AGENTS.md](../AGENTS.md), [database/](database/README.md), [api/](api/README.md), and [16-testing-quality.md](16-testing-quality.md).

## Naming

- Use glossary terms exactly as written in [glossary.md](glossary.md).
- Use stable requirement, permission, error, audit, and event IDs without silent reuse.
- Use `tenantId`, `ticketId`, and other clear domain names in code; use database names from [database/NAMING-CONVENTIONS.md](database/NAMING-CONVENTIONS.md) at persistence boundaries.
- Avoid ambiguous synonyms such as customer/account/org when Tenant or Organization is meant.

## Folder structure

Future implementation should separate:

- Domain modules by bounded context: identity, tenant administration, ticketing, automation, SLA, communications, search/reporting, audit, operations.
- Transport adapters from domain logic.
- Persistence adapters from domain logic.
- Vendor integrations behind explicit ports/adapters.
- Shared libraries only for stable cross-cutting contracts, not business shortcuts.

## Error handling

- Use [errors.md](errors.md) codes at API boundaries.
- Fail closed for authentication, authorization, tenant context, and sensitive visibility uncertainty.
- Preserve causal details in structured logs; return only safe messages to clients.
- Retry only transient idempotent work with bounded backoff and jitter.

## Logging and telemetry

- Include correlation ID, tenant-safe key, operation, actor type, outcome, latency, and safe error class.
- Never log credentials, tokens, raw email, comment bodies, attachment content, or unnecessary personal data.
- Emit domain metrics listed in [17-observability.md](17-observability.md).

## Dependency rules

- Add dependencies only when maintained, licensed compatibly, security scanned, pinned according to ecosystem practice, and justified.
- Critical or vendor-locking dependencies require a decision record in [adr/](adr/README.md) or [decision-log.md](decision-log.md).
- Do not bypass domain contracts with vendor-specific logic in core modules.

## File organization

- Keep files cohesive and small.
- Prefer explicit interfaces at module boundaries.
- Keep validation at trust boundaries and invariant enforcement in domain services/aggregates.
- Persistence entities must not be returned directly through APIs.

## Testing requirements

Every feature must map to relevant suites in [16-testing-quality.md](16-testing-quality.md). At minimum:

- Unit/property tests for domain invariants.
- Integration tests for persistence, outbox, queues, and providers.
- Tenant-isolation negative tests.
- Authorization matrix tests.
- Contract/API tests.
- Accessibility tests for critical UI.
- Security and abuse tests for trust boundaries.

## Documentation requirements

Behavior changes must update requirements, API docs, database docs, permissions, audit/notification/error catalogues, tests, and ADRs where relevant in the same pull request.
