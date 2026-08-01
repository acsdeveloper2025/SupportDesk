# SupportDesk

SupportDesk is an enterprise, multi-tenant ticketing SaaS built as a modular monolith. The monorepo includes Authentication & Identity, deny-by-default RBAC, audit logging, and the Ticket Module (API + ticket detail UI). Attachments, organizations, notifications, SLA, Workflow Engine, search, and reports remain deferred until their milestones are approved.

## Project foundation

- `apps/web` — Next.js App Router, React, TypeScript, Tailwind CSS, shadcn-compatible UI wiring, Vitest, and Playwright.
- `apps/api` — NestJS, TypeScript, Prisma, PostgreSQL connection configuration, Swagger/OpenAPI, structured logging, correlation IDs, global exception handling, and health probes.
- `packages/ui` — shared UI primitives.
- `packages/config` — shared public configuration helpers.
- `packages/types` — shared TypeScript contracts.
- `packages/utils` — shared utility helpers.
- `packages/eslint-config` and `packages/tsconfig` — shared engineering configuration.
- `docs` — product, architecture, API, database, backlog, sprint, release, and governance documentation.
- `.github/workflows` — CI, lint, build, unit test, type check, security scan, and dependency audit workflows.
- `docker` — development-only Docker Compose configuration.

## Requirements

- Node.js `>=22`
- pnpm `>=10`
- Docker Desktop, for the development PostgreSQL and containerized dev environment

## Installation

```bash
pnpm install
```

Copy `.env.example` to `.env` for local development and adjust values as needed. Never commit real secrets.

## Development

```bash
pnpm dev
```

Default local URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- Swagger: `http://localhost:3001/docs`
- Health: `http://localhost:3001/health`
- Readiness: `http://localhost:3001/ready`
- Liveness: `http://localhost:3001/live`

## Environment

`.env.example` documents every local environment variable. Authentication security settings currently cover Argon2id hashing cost, secure token entropy, token lifetimes, and password policy requirements. Never commit real secrets or tenant-specific production values.

Browser authentication uses same-origin Next.js route handlers under `/api/auth/*`. Those handlers call the NestJS API through server-only `SUPPORTDESK_API_URL`, store access/refresh material in `HttpOnly` cookies, and require CSRF tokens for cookie-authenticated mutations. Frontend components must not store auth tokens in `localStorage`, `sessionStorage`, or other browser-readable storage.

Authentication pages are available at `/login`, `/forgot-password`, `/reset-password`, `/email-verification`, and `/profile`. Ticket detail is available at `/tickets/[ticketId]` (list/create UI and broader agent workspace remain deferred). Do not start Workflow Engine work until the [Ticket Module v1 engineering audit](docs/ticket-module-v1-engineering-audit.md) gate is approved.

## Docker Development

```bash
pnpm docker:dev
pnpm docker:dev:down
```

Docker is development-only at this stage. Production infrastructure belongs to a later milestone.

## Quality Gates

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm security:scan
pnpm audit:deps
pnpm run ci
```

The root CI script runs linting, type checking, unit tests, build, and security audit. GitHub Actions mirror those gates for pull requests.

## Development Workflow

1. Keep changes inside the milestone scope.
2. Do not add business features before the matching backlog issue is approved.
3. Run `pnpm run ci` before opening a pull request.
4. Run `pnpm test:e2e` when frontend behavior changes.
5. Update documentation when architecture, APIs, environment variables, or workflow expectations change.

## Start here

1. [Vision](docs/00-vision.md) — outcomes, scope, and success measures.
2. [Product requirements](docs/03-product-requirements.md) and [functional requirements](docs/04-functional-requirements.md) — traceable requirements and acceptance criteria.
3. [Architecture](docs/05-architecture.md), [tenant isolation](docs/06-tenant-isolation.md), and [security](docs/07-security-compliance.md) — system boundaries and controls.
4. [Database design](docs/database/README.md), [API specification](docs/api/README.md), and [permissions matrix](docs/permissions-matrix.md) — implementation-ready contracts without implementation.
5. [Workflow](docs/workflow-matrix.md), [audit](docs/audit-events.md), [notifications](docs/notification-events.md), [email templates](docs/email-templates.md), and [errors](docs/errors.md) — operational catalogues.
6. [Testing](docs/16-testing-quality.md), [deployment](docs/18-deployment-cicd.md), [operations](docs/19-operations-recovery.md), [GitHub backlog](docs/github-backlog.md), [implementation order](docs/implementation-order.md), and [sprint plan](docs/sprint-plan.md) — release and delivery expectations.
7. [Roadmap](docs/20-roadmap.md), [decision log](docs/decision-log.md), and [ADRs](docs/adr/README.md) — delivery gates and architectural decisions.
8. [Authentication quality gate](docs/authentication-milestone-quality-gate.md) — implemented auth surface, verification evidence, and remaining technical debt.
9. [Ticket Module v1 engineering audit](docs/ticket-module-v1-engineering-audit.md) — pre-Workflow readiness review, debt register, and go/no-go recommendation.
10. [Ticket Module v1 hardening report](docs/ticket-module-v1-hardening-report.md) — final pre-Workflow gate evidence and remaining debt.
11. [Ready for Workflow Engine](docs/ready-for-workflow-engine.md) — baseline freeze and E11-I02 approval gate.

Shared, normative terms are defined in the [glossary](docs/glossary.md). “Must”, “should”, and “may” carry their RFC 2119 meanings. Requirement IDs are stable and are linked through the [traceability matrix](docs/04-functional-requirements.md#traceability-matrix).

## Documentation map

| Area                    | Documents                                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product                 | [00](docs/00-vision.md), [01](docs/01-principles-scope.md), [02](docs/02-personas-journeys.md), [03](docs/03-product-requirements.md), [04](docs/04-functional-requirements.md)                                                                                                                                                                          |
| Design                  | [05](docs/05-architecture.md)–[15](docs/15-non-functional-requirements.md), [Database](docs/database/README.md), [API](docs/api/README.md), [UI components](docs/ui-components.md), [Coding standards](docs/coding-standards.md)                                                                                                                         |
| Catalogues              | [Permissions](docs/permissions-matrix.md), [Workflow](docs/workflow-matrix.md), [Audit events](docs/audit-events.md), [Notifications](docs/notification-events.md), [Email templates](docs/email-templates.md), [Errors](docs/errors.md)                                                                                                                 |
| Delivery and operations | [16](docs/16-testing-quality.md)–[20](docs/20-roadmap.md), [Milestones](docs/milestones.md), [Sprint plan](docs/sprint-plan.md), [Release plan](docs/release-plan.md)                                                                                                                                                                                    |
| Planning and governance | [GitHub plan](docs/github-project-plan.md), [GitHub backlog](docs/github-backlog.md), [Implementation order](docs/implementation-order.md), [Issue templates](docs/issue-templates.md), [Glossary](docs/glossary.md), [Decision log](docs/decision-log.md), [ADRs](docs/adr/README.md), [Contributing](CONTRIBUTING.md), [Agent instructions](AGENTS.md) |

## Status

Architecture foundation, Authentication & Identity, and Ticket Module v1 (API + detail UI) are implemented and frozen at tag `v1.0-ticket-module`. Pre-Workflow evidence: [hardening report](docs/ticket-module-v1-hardening-report.md) and [Ready for Workflow Engine](docs/ready-for-workflow-engine.md). See also the [completion report](docs/22-architecture-foundation-completion-report.md) and [authentication quality gate](docs/authentication-milestone-quality-gate.md). Accepted assumptions are in the [decision log](docs/decision-log.md); open questions are not commitments. Changes follow [CONTRIBUTING.md](CONTRIBUTING.md).
