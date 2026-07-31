# API specification

This API specification expands [../13-rest-conventions.md](../13-rest-conventions.md).

**As-built vs target:** Resource docs below mark **As-built (Ticket Module v1 / Auth)** sections for implemented NestJS routes. Remaining tables describe the target catalogue and must not be treated as live contracts. Live OpenAPI is served at `/docs` on the API and is covered by OpenAPI smoke tests under `apps/api/src/**/*.openapi.spec.ts`.

## Global conventions (as-built)

- Base path: `/api/v1`
- Format: JSON UTF-8
- Tenant context: derived from authenticated session/token claims, never from an untrusted body field
- Authentication: see [authentication.md](authentication.md) and [ADR-0005](../adr/ADR-0005.md)
- Authorization: permission keys from [../permissions-matrix.md](../permissions-matrix.md)
- Errors: Nest HTTP exceptions; catalogue in [../errors.md](../errors.md)
- Ticket/comment list pagination: offset `page` / `pageSize` ([ADR-0006](../adr/ADR-0006.md)); cursor pagination remains the long-term target in REST conventions
- Rate limits: auth and selected ticket/comment mutations

## API document map

- [Authentication](authentication.md) — largely as-built
- [Tickets](tickets.md) — as-built Ticket Module v1 + deferred catalogue
- [Ticket search](search.md) — as-built on this branch (`GET /api/v1/tickets/search`)
- [Comments](comments.md) — as-built Ticket Module v1 + deferred catalogue
- [Attachments](attachments.md) — as-built on this branch
- [Notifications](notifications.md) — as-built on this branch
- [SLA](sla.md) — as-built on this branch
- [Workflows](workflows.md) — as-built on this branch (definition only; execution deferred)
- [Organizations](organizations.md) — target only
- [Users and memberships](users.md) — target (identity exists via auth)
- [Roles](roles.md) / [Permissions](permissions.md) — catalogue; RBAC evaluator as-built
- [Reports](reports.md), [Settings](settings.md), [Admin](admin.md) — target only

## Endpoint table key

Each endpoint table uses these columns: method and URI, authentication, authorization, request, response, validation, errors, pagination/filtering/sorting, rate limit, and example. As-built sections may use a condensed column set for readability.
