# Comments API

Related: [tickets.md](tickets.md), [attachments.md](attachments.md), [../11-notifications.md](../11-notifications.md).

## As-built endpoints (Ticket Module v1)

Authentication: Bearer access token or Next.js BFF cookie session.  
Visibility: `PUBLIC` | `INTERNAL`. Requesters without internal permission never receive `INTERNAL` comments.  
Pagination: offset `page` / `pageSize` (same conventions as tickets — [ADR-0006](../adr/ADR-0006.md)).  
Attachments on comments: **not implemented** (Epic 7).

| Method / URI                               | Authz                                                | Request                                                                          | Response                                | Errors                            | Notes                                                     |
| ------------------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------- | --------------------------------------------------------- |
| `POST /api/v1/tickets/{ticketId}/comments` | `comment.public.create` or `comment.internal.create` | `body`, optional `visibility`                                                    | Created comment                         | `400`, `401`, `403`, `404`, `429` | Rate-limited `comment-create`.                            |
| `GET /api/v1/tickets/{ticketId}/comments`  | `comment.read` (visibility filtered)                 | `page`, `pageSize`, `sortBy`, `sortDir`, optional visibility/author/date filters | `{ items, meta, appliedFilters, sort }` | `400`, `401`, `403`, `404`        | Soft-deleted excluded; internal hidden when unauthorized. |
| `GET /api/v1/comments/{commentId}`         | `comment.read` (visibility filtered)                 | —                                                                                | Comment                                 | `401`, `403`, `404`               |                                                           |
| `PATCH /api/v1/comments/{commentId}`       | author + update policy                               | `expectedVersion`, `body`                                                        | Updated comment                         | `400`, `401`, `403`, `404`, `409` | Visibility immutable after create.                        |
| `DELETE /api/v1/comments/{commentId}`      | author + delete policy                               | `expectedVersion`, optional `reason`                                             | `204 No Content`                        | `400`, `401`, `403`, `404`, `409` | Soft delete.                                              |

### Browser BFF proxies

- `GET|POST /api/tickets/[ticketId]/comments`
- `PATCH|DELETE /api/comments/[commentId]`

CSRF required for mutations ([ADR-0005](../adr/ADR-0005.md)).

## Target catalogue (not implemented)

| Capability                                         | Notes            |
| -------------------------------------------------- | ---------------- |
| Attachment IDs on create                           | Epic 7           |
| Idempotency-Key                                    | Epic 17          |
| Formal redaction command distinct from soft delete | E06-I03          |
| Cursor pagination                                  | ADR-0006 revisit |
