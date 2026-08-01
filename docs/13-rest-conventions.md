# REST conventions

This is a style contract. The endpoint inventory and resource-specific contracts are in [api/](api/README.md); the shared error catalogue is [errors.md](errors.md).

- HTTPS only; resource-oriented plural nouns; JSON UTF-8; explicit media types; no verbs in paths. Version breaking contracts in the media type or a documented major path, not ad hoc query parameters.
- Authenticate every non-public request. Tenant context derives from trusted routing plus Tenant Membership and is verified against every resource.
- Use opaque stable identifiers. Never encode sensitive data or sequential cross-Tenant identifiers.
- `GET` is safe; `PUT` is idempotent replacement where supported; `PATCH` uses a declared patch format; `DELETE` follows documented lifecycle semantics. Mutations supporting retries require an `Idempotency-Key` scoped to Tenant, actor, operation, and canonical payload.
- Use cursor pagination with stable ordering, bounded page size, and opaque cursors for search and high-volume queues. Filtering and sorting use allow-listed fields. Search is explicitly eventually consistent.
- **Exception (Ticket Module v1):** Ticket and Comment list/count APIs use offset pagination (`page`, `pageSize`) per [ADR-0006](adr/ADR-0006.md).
- Use UTC RFC 3339 instants; enum values are lowercase stable tokens; money, durations, locale, and time zones use documented standards.
- Optimistic concurrency uses a version/ETag and conditional mutation; stale writes return conflict/precondition failure without mutation.
- Success returns appropriate 2xx semantics and correlation metadata. Async work returns a monitorable operation resource rather than pretending completion.

## Error envelope

Errors contain a stable code, safe message, correlation ID, optional field violations, and retry metadata. HTTP semantics distinguish invalid input, unauthenticated, unauthorized/not-found where enumeration-safe, conflict, precondition, rate limit, transient unavailability, and internal error. Stack traces, provider details, secrets, and foreign resource existence are never returned.

## Compatibility and limits

Additive optional response fields are compatible; clients must ignore unknown fields. Removing/renaming fields or changing semantics requires versioning, published deprecation, usage telemetry, and migration window. Rate-limit responses include safe retry guidance. Uploads use restricted content/size and quarantine flow. OpenAPI may later describe actual APIs, but this document does not claim any endpoint exists.
