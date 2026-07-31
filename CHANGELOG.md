# Changelog

All notable changes are recorded here. This project follows Keep a Changelog concepts and will adopt semantic versioning when a deployable product exists.

## [Unreleased]

### Added

- Documentation foundation for product requirements, architecture, security, domain behavior, quality, delivery, operations, and roadmap.
- Shared glossary, architectural decision log, repository governance, contribution guidance, and license.
- Final architecture foundation documentation: database design, API specification, permission/workflow/audit/notification/email/error catalogues, UI components, coding standards, ADR records, and GitHub project plan.
- Complete engineering backlog, implementation order, sprint plan, milestones, issue templates, and release plan.
- Production project bootstrap with Next.js web app, NestJS API, shared packages, Prisma configuration, health checks, Swagger setup, logging infrastructure, CI workflows, development Docker Compose, and baseline tests.
- Tenant-aware authentication foundation with registration, email verification, login, session management, JWT access tokens, refresh-token rotation, secure password recovery, password changes, and password-expiration enforcement hooks.
- Authentication abuse controls with configurable endpoint throttles, tenant-aware risk dimensions, persistent failed-login lockout, explicit unlock behavior, and redacted security audit events.
- Deny-by-default RBAC foundation with framework permission seeds, tenant-scoped evaluation, authority-preserving role assignment, role-permission grants, and authorization audit events.
- Central authentication audit envelopes with recursive secret redaction, hashed request identifiers, correlation/actor/target context, complete refresh and session-revocation events, and fail-closed persistence.
- Accepted ADR-0005 for same-origin Next.js BFF browser authentication, HttpOnly cookie session storage, and CSRF-protected cookie mutations.
- Access-token guard and `GET /api/v1/auth/me` current identity API with active-session, tenant/user ownership, and bearer-authenticated session-management support.
- Next.js authentication BFF routes for CSRF issuance, login, refresh, logout, and current identity proxying with HttpOnly cookies and token-redacted responses.
- Frontend authentication pages for login, forgot password, reset password, email verification, and basic profile, with component and Playwright smoke coverage.
- Authentication milestone quality gate with OpenAPI endpoint inventory smoke coverage, repeatable auth coverage script, documentation alignment, and technical-debt register.
- Pre-ticket readiness gate audit completed (`#15` / `TKT.00`) verifying security, multi-tenant isolation, RBAC, audit compliance, and quality gates.
- Canonical `Ticket` aggregate model (`#16` / `E05-I01`) with Prisma database tables, status transition state machine, optimistic concurrency, and tenant isolation test suites (`T-DOM` & `T-ISO`).
- Ticket Create and Read REST APIs (`#17` / `E05-I02`) including `POST /api/v1/tickets`, `GET /api/v1/tickets/:id`, `GET /api/v1/tickets/reference/:publicRef`, `CreateTicketRequestDto`, `TicketResponseDto`, RBAC authorization, and OpenAPI specifications.
- Ticket Update & Optimistic Concurrency APIs (`#18` / `E05-I03`) including `PATCH /api/v1/tickets/:id`, `PATCH /api/v1/tickets/reference/:publicRef`, `UpdateTicketRequestDto`, `TicketConcurrencyException` (HTTP 409 Conflict), immutable field validation, RBAC authorization (`ticket.update`), and `ticket.updated` audit event logging.
- Ticket Lifecycle & Activity Timeline (`#19` / `E05-I04`) implementing `POST /api/v1/tickets/:id/status` and `POST /api/v1/tickets/reference/:publicRef/status` endpoints for ticket status transitions (NEW → OPEN → PENDING → ON_HOLD → SOLVED → CLOSED) with the domain state machine, optimistic concurrency version check, `ticket.status_change` RBAC permission, `ticket.status_changed` audit event (fromStatus, toStatus, newVersion, publicRef), `solvedAt`/`closedAt` timestamps, full controller test suite (27 tests total), and updated OpenAPI smoke coverage (7 endpoints).
- Ticket Assignment (`#20` / `E05-I05`) implementing `POST /api/v1/tickets/:id/assign`, `POST /api/v1/tickets/reference/:publicRef/assign`, and `POST /api/v1/tickets/:id/unassign` endpoints. Domain `TicketAggregate.assign()`/`unassign()` enforce closed-ticket guard, UUID validation, and optimistic concurrency. Service validates assignee is ACTIVE and tenant-scoped via `findActiveUserInTenant()`. Audit events: `ticket.assigned`, `ticket.reassigned`, `ticket.unassigned` with previous/new assignee and group metadata. `ticket.assign` RBAC permission required for all three endpoints. 24 new tests (16 aggregate, 42 controller, 1 OpenAPI smoke — 144 total). OpenAPI inventory updated to 8 endpoints.
- Ticket List, Filter, Sort & Pagination APIs (`#21` / `E05-I06`) implementing `GET /api/v1/tickets` and `GET /api/v1/tickets/count` endpoints. Repository `buildWhereClause` abstracts Prisma filtering logic (status, priorities, types, channels, assignees, dates) ensuring consistent evaluation across `findMany` and `count`. Zod-validated `ListTicketsQueryDto` translates REST queries to structured sort/pagination configurations. Strict tenant isolation applied implicitly to all listing queries. Paged metadata (`totalPages`, `hasNextPage`) calculated in service layer and mapped into `TicketListResponseDto`. Endpoints protected with `ticket.read` permission. 151 total API tests passing, OpenAPI inventory updated to 9 endpoints.
