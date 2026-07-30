# SupportDesk

SupportDesk is the documentation-first foundation for an enterprise, multi-tenant ticketing SaaS. This repository intentionally contains no application implementation. The documents define the product contract, architectural guardrails, operational controls, and delivery sequence that implementation must follow.

## Start here

1. [Vision](docs/00-vision.md) — outcomes, scope, and success measures.
2. [Product requirements](docs/03-product-requirements.md) and [functional requirements](docs/04-functional-requirements.md) — traceable requirements and acceptance criteria.
3. [Architecture](docs/05-architecture.md), [tenant isolation](docs/06-tenant-isolation.md), and [security](docs/07-security-compliance.md) — system boundaries and controls.
4. [Data model](docs/12-data-model.md), [REST conventions](docs/13-rest-conventions.md), and [UX standards](docs/14-ui-ux-accessibility.md) — implementation contracts without implementation.
5. [Testing](docs/16-testing-quality.md), [deployment](docs/18-deployment-cicd.md), and [operations](docs/19-operations-recovery.md) — release and runtime expectations.
6. [Roadmap](docs/20-roadmap.md) and [decision log](docs/decision-log.md) — delivery gates and architectural decisions.

Shared, normative terms are defined in the [glossary](docs/glossary.md). “Must”, “should”, and “may” carry their RFC 2119 meanings. Requirement IDs are stable and are linked through the [traceability matrix](docs/04-functional-requirements.md#traceability-matrix).

## Documentation map

| Area | Documents |
|---|---|
| Product | [00](docs/00-vision.md), [01](docs/01-principles-scope.md), [02](docs/02-personas-journeys.md), [03](docs/03-product-requirements.md), [04](docs/04-functional-requirements.md) |
| Design | [05](docs/05-architecture.md)–[15](docs/15-non-functional-requirements.md) |
| Delivery and operations | [16](docs/16-testing-quality.md)–[20](docs/20-roadmap.md) |
| Governance | [Glossary](docs/glossary.md), [Decision log](docs/decision-log.md), [Contributing](CONTRIBUTING.md), [Agent instructions](AGENTS.md) |

## Status

This is a baseline specification. Accepted assumptions are explicitly labeled in the [decision log](docs/decision-log.md); open questions are not commitments. Changes follow [CONTRIBUTING.md](CONTRIBUTING.md).
