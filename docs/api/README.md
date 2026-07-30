# API specification

This API specification expands [../13-rest-conventions.md](../13-rest-conventions.md). It documents the intended resource surface only; it does not implement APIs or generate OpenAPI.

## Global conventions

- Base path: `/api/v1`
- Transport: HTTPS only.
- Format: JSON UTF-8 unless downloading attachments or exports.
- Tenant context: derived from trusted tenant routing and active Tenant Membership, never from an untrusted body field.
- Authentication: see [authentication.md](authentication.md).
- Authorization: stable permissions from [../permissions-matrix.md](../permissions-matrix.md).
- Errors: [../errors.md](../errors.md).
- Audit: material actions emit events from [../audit-events.md](../audit-events.md).
- Pagination: cursor pagination with `page[size]` and `page[after]`; max page size is resource-specific and bounded.
- Filtering: allow-listed `filter[...]` fields only.
- Sorting: allow-listed `sort` tokens only; default sort must be stable.
- Rate limits: tenant, actor, IP, endpoint family, and burst windows may all apply.

## Common response metadata

Successful responses include a correlation ID in headers or body metadata. List responses include `data`, `page`, and `links`. Mutation responses include the new resource version/ETag when applicable. Async operations return `202 Accepted` with an operation resource.

## API document map

- [Authentication](authentication.md)
- [Organizations](organizations.md)
- [Users and memberships](users.md)
- [Roles](roles.md)
- [Permissions](permissions.md)
- [Tickets](tickets.md)
- [Comments](comments.md)
- [Attachments](attachments.md)
- [Notifications](notifications.md)
- [Reports](reports.md)
- [Settings](settings.md)
- [Admin/platform operations](admin.md)

## Endpoint table key

Each endpoint table uses these columns: method and URI, authentication, authorization, request, response, validation, errors, pagination/filtering/sorting, rate limit, and example.
