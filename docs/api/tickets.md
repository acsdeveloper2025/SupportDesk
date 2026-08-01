# Tickets API

Related: [../09-ticket-lifecycle.md](../09-ticket-lifecycle.md), [../workflow-matrix.md](../workflow-matrix.md), [comments.md](comments.md), [attachments.md](attachments.md).

This document has two layers:

1. **As-built (Ticket Module v1)** — endpoints implemented in NestJS today. Source of truth for clients and OpenAPI smoke tests.
2. **Target catalogue** — future endpoints retained for roadmap alignment. They are **not** implemented and must not be called.

Swagger UI for the running API: `http://localhost:3001/docs`.

## As-built endpoints (Ticket Module v1)

Authentication: Bearer access token (API clients) or Next.js BFF cookie session (browser).  
Authorization: permission keys evaluated by the RBAC service.  
Optimistic concurrency: mutable commands require `version` / `expectedVersion`; conflicts return HTTP `409`.  
Pagination (list/count): **offset** `page` (default 1) and `pageSize` (default 20, max 100) — see [ADR-0006](../adr/ADR-0006.md).  
Group assignment: `assignedGroupId` is **rejected** until Organizations/Groups ship — see [ADR-0008](../adr/ADR-0008.md).

| Method / URI                                        | Authz                  | Request                                                                                                                                                 | Response                                | Errors                            | Notes                                                  |
| --------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------- | ------------------------------------------------------ |
| `POST /api/v1/tickets`                              | `ticket.create`        | title, description; optional priority, type, channel, dueDate                                                                                           | Created ticket                          | `400`, `401`, `403`, `429`        | Rate-limited `ticket-create`. Sets requester to actor. |
| `GET /api/v1/tickets`                               | `ticket.read`          | Query: `page`, `pageSize`, `sortBy`, `sortDir`, CSV filters (`status`, `priority`, `type`, `channel`, `assigneeUserId`, `requesterUserId`), date bounds | `{ items, meta, appliedFilters, sort }` | `400`, `401`, `403`               | Soft-deleted tickets excluded.                         |
| `GET /api/v1/tickets/count`                         | `ticket.read`          | Same filters as list (no pagination)                                                                                                                    | `{ count, appliedFilters }`             | `400`, `401`, `403`               |                                                        |
| `GET /api/v1/tickets/{id}`                          | `ticket.read`          | —                                                                                                                                                       | Ticket                                  | `401`, `403`, `404`               | Enumeration-safe not-found.                            |
| `GET /api/v1/tickets/reference/{publicRef}`         | `ticket.read`          | —                                                                                                                                                       | Ticket                                  | `401`, `403`, `404`               | Tenant-scoped public reference.                        |
| `PATCH /api/v1/tickets/{id}`                        | `ticket.update`        | version + mutable fields                                                                                                                                | Updated ticket                          | `400`, `401`, `403`, `404`, `409` | Immutable: status/assignee via dedicated commands.     |
| `PATCH /api/v1/tickets/reference/{publicRef}`       | `ticket.update`        | version + mutable fields                                                                                                                                | Updated ticket                          | `400`, `401`, `403`, `404`, `409` |                                                        |
| `POST /api/v1/tickets/{id}/status`                  | `ticket.status_change` | `status`, `version`                                                                                                                                     | Updated ticket                          | `400`, `401`, `403`, `404`, `409` | Domain state machine enforced.                         |
| `POST /api/v1/tickets/reference/{publicRef}/status` | `ticket.status_change` | `status`, `version`                                                                                                                                     | Updated ticket                          | `400`, `401`, `403`, `404`, `409` |                                                        |
| `POST /api/v1/tickets/{id}/assign`                  | `ticket.assign`        | `version`; `assigneeUserId` required for v1                                                                                                             | Updated ticket                          | `400`, `401`, `403`, `404`, `409` | Assignee must be ACTIVE in tenant.                     |
| `POST /api/v1/tickets/reference/{publicRef}/assign` | `ticket.assign`        | same as assign-by-id                                                                                                                                    | Updated ticket                          | `400`, `401`, `403`, `404`, `409` |                                                        |
| `POST /api/v1/tickets/{id}/unassign`                | `ticket.assign`        | `version`                                                                                                                                               | Updated ticket                          | `400`, `401`, `403`, `404`, `409` | Clears assignee and group fields.                      |
| `GET /api/v1/tickets/{id}/timeline`                 | `ticket.read`          | optional page params                                                                                                                                    | Audit timeline items                    | `401`, `403`, `404`               | Derived from `audit_events` for the ticket.            |

### Sort fields (list)

`createdAt`, `updatedAt`, `priority`, `dueDate`, `status`, `publicRef`. Directions: `asc` | `desc` (default `createdAt` desc).

### Browser BFF proxies

Same-origin Next.js routes under `/api/tickets/[ticketId]/*` and `/api/comments/[commentId]` forward with HttpOnly access cookies and CSRF for mutations ([ADR-0005](../adr/ADR-0005.md)).

### Audit events emitted

`ticket.created`, `ticket.updated`, `ticket.status_changed`, `ticket.assigned`, `ticket.reassigned`, `ticket.unassigned`. Outbox dual-write is deferred ([ADR-0007](../adr/ADR-0007.md)).

## Target catalogue (not implemented)

| Method / URI                          | Notes                                        |
| ------------------------------------- | -------------------------------------------- |
| `POST /api/v1/tickets/{id}/links`     | Ticket linking — future.                     |
| `GET /api/v1/tickets/search`          | Search projection — Epic 14.                 |
| Cursor pagination / tag / SLA filters | Future list contract after ADR-0006 revisit. |
| Idempotency-Key on create             | Epic 17.                                     |

Historical names `/assignments`, `/transitions`, and `/activity` are **retired** in favor of `/assign`, `/status`, and `/timeline`.
