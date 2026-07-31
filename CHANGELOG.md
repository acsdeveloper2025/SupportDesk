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
