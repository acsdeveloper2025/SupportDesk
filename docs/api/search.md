# Ticket Search API

Related: [tickets.md](tickets.md), [../permissions-matrix.md](../permissions-matrix.md), [../database/INDEXING.md](../database/INDEXING.md).

Implemented in Issue #24 (`E05-I09`) using **PostgreSQL only**. External search engines, semantic/AI search, saved searches, dashboards, and reports are out of scope.

| Method / URI                 | Authentication        | Authorization                          | Request                      | Response                                    | Validation                                                          | Errors                                | Page/filter/sort                                                                                       | Rate limit      | Example                  |
| ---------------------------- | --------------------- | -------------------------------------- | ---------------------------- | ------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------- | ------------------------ |
| `GET /api/v1/tickets/search` | Active tenant session | `ticket.read` (own/group/tenant scope) | Query string (`q` + filters) | Ticket list with shared pagination metadata | Query length ≤ 200; allow-listed sort/filter fields; UUID/date safe | `VALIDATION_FAILED`, `AUTH_FORBIDDEN` | Offset page/pageSize; filter status/priority/type/channel/assignee/group/dates/has*; sort allow-listed | Search throttle | Find VPN-related tickets |

## Search text (`q`)

Case-insensitive partial match across:

- Public reference (`publicRef`)
- Title
- Description
- Requester email (`users.email` / `email_normalized`)
- Requester name (`user_profiles.display_name` / `first_name` / `last_name`) when a profile exists

LIKE metacharacters in `q` are escaped so user input cannot inject wildcards. Queries are parameterized through Prisma (no raw string concatenation).

## Filters

Reuses the Issue #21 filter set, plus existence filters:

| Parameter                        | Type                     | Notes                           |
| -------------------------------- | ------------------------ | ------------------------------- |
| `status`                         | CSV enum                 | `NEW,OPEN,...`                  |
| `priority`                       | CSV enum                 |                                 |
| `type`                           | CSV enum                 |                                 |
| `channel`                        | CSV enum                 |                                 |
| `assigneeUserId`                 | CSV UUID                 |                                 |
| `requesterUserId`                | CSV UUID                 |                                 |
| `assignedGroupId`                | CSV UUID                 | Assignment group                |
| `createdAfter` / `createdBefore` | ISO-8601 datetime        | Inclusive range on `created_at` |
| `updatedAfter` / `updatedBefore` | ISO-8601 datetime        | Inclusive range on `updated_at` |
| `dueAfter` / `dueBefore`         | ISO-8601 datetime        | Inclusive range on `due_date`   |
| `hasAttachments`                 | boolean (`true`/`false`) | Non-deleted attachments only    |
| `hasComments`                    | boolean (`true`/`false`) | Non-deleted comments only       |

## Sorting

Allow-listed fields (unsupported values rejected with `VALIDATION_FAILED`):

`createdAt`, `updatedAt`, `priority`, `dueDate`, `status`, `publicRef`

Directions: `asc`, `desc`. Default: `createdAt desc`.

## Pagination

Reuses the Issue #21 list pagination model (`page`, `pageSize` max 100) and the same response metadata (`totalRecords`, `totalPages`, `currentPage`, `pageSize`, `hasNextPage`, `hasPreviousPage`).

## Security

- Authentication required; deny by default.
- `ticket.read` enforced via `RbacService.resolveListScopeFilter` (tenant-wide, OWN, or GROUP).
- Every query is tenant-scoped (`tenant_id` + `deleted_at IS NULL`).
- Search does **not** emit timeline events. Audit events are not written for successful reads (consistent with list).

## Example

```http
GET /api/v1/tickets/search?q=vpn&status=OPEN,PENDING&priority=HIGH&hasAttachments=true&sortBy=updatedAt&sortDir=desc&page=1&pageSize=20
Authorization: Bearer <access_token>
```
