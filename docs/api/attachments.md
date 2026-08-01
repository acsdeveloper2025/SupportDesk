# Attachments API

Related: [../07-security-compliance.md](../07-security-compliance.md), [../database/TABLES.md](../database/TABLES.md), [tickets.md](tickets.md).

Implemented in Issue #23 (E05-I08) with **local filesystem storage only**. Object-store providers, upload sessions, scan callbacks, and previews remain future work.

| Method / URI                                   | Authentication        | Authorization              | Request                    | Response                  | Validation                                       | Errors                                                  | Page/filter/sort | Rate limit         | Example              |
| ---------------------------------------------- | --------------------- | -------------------------- | -------------------------- | ------------------------- | ------------------------------------------------ | ------------------------------------------------------- | ---------------- | ------------------ | -------------------- |
| `POST /api/v1/tickets/{ticket_id}/attachments` | Active tenant session | `ticket.attachment.create` | `multipart/form-data` file | Attachment metadata       | Size/type/extension; ticket same tenant; SHA-256 | `VALIDATION_FAILED`, `CONFLICT`, `ATTACHMENT_NOT_CLEAN` | None             | Upload throttle    | Attach invoice PDF.  |
| `GET /api/v1/tickets/{ticket_id}/attachments`  | Active tenant session | `ticket.attachment.read`   | None                       | Attachment metadata list  | Ticket same tenant                               | `AUTH_FORBIDDEN`, `NOT_FOUND`                           | None             | Normal read        | Show ticket files.   |
| `GET /api/v1/attachments/{attachment_id}`      | Active tenant session | `ticket.attachment.read`   | None                       | Authenticated file stream | Same tenant; scan state `clean`                  | `NOT_FOUND`, `ATTACHMENT_NOT_CLEAN`, `AUTH_FORBIDDEN`   | None             | Download throttle  | Download clean file. |
| `DELETE /api/v1/attachments/{attachment_id}`   | Active tenant session | `ticket.attachment.delete` | Optional reason            | Soft-deleted (204)        | Same tenant                                      | `AUTH_FORBIDDEN`, `NOT_FOUND`                           | None             | Sensitive mutation | Remove bad upload.   |

## Storage

- Files are stored under `ATTACHMENTS_STORAGE_ROOT` as `tenant-{tenantId}/ticket-{ticketId}/{uuid}.{ext}`.
- Original filenames are metadata only; stored filenames are UUIDs.
- The storage directory must never be exposed by the web server; downloads go only through authenticated API endpoints.
- Binary content is never stored in PostgreSQL.

## Security

- Tenant isolation, RBAC, authentication, MIME/extension/size validation, SHA-256 checksums, path-traversal protection, soft delete.
- Virus scanning uses a `VirusScanner` port; production currently wires `NoOpVirusScanner` (`clean`). ClamAV remains future work.
