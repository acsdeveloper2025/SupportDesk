# SupportDesk Enterprise v1.0 — API Reference

SupportDesk Enterprise exposes a RESTful JSON API for enterprise integrations, automation, and third-party portal extensions.

---

## 1. Authentication & Common Headers

All API requests must include tenant context and session/bearer authentication:

```http
GET /api/v1/tickets HTTP/1.1
Host: supportdesk.example.com
Authorization: Bearer <JWT_TOKEN>
X-Tenant-ID: <TENANT_UUID_OR_SLUG>
Content-Type: application/json
```

---

## 2. Endpoint Reference Overview

### Health & System Status

- `GET /api/v1/health` - Public health check endpoint. Returns database and Redis connection status.

### Authentication (`/api/v1/auth`)

- `POST /api/v1/auth/login` - Authenticate user credentials. Returns HTTP-only session cookie or JWT token.
- `POST /api/v1/auth/logout` - Revoke current session.
- `GET /api/v1/auth/me` - Fetch authenticated user profile and permissions matrix.

### Ticket Management (`/api/v1/tickets`)

- `GET /api/v1/tickets` - List/filter tickets. Query params: `status`, `priority`, `category`, `page`, `limit`, `search`.
- `POST /api/v1/tickets` - Create a new ticket.
- `GET /api/v1/tickets/:id` - Fetch single ticket details.
- `PATCH /api/v1/tickets/:id` - Update ticket fields (`status`, `priority`, `assignedToId`).
- `POST /api/v1/tickets/:id/comments` - Add public comment or internal note.

### Asset CMDB (`/api/v1/assets`)

- `GET /api/v1/assets` - List CMDB assets.
- `POST /api/v1/assets` - Create a new CMDB asset.
- `GET /api/v1/assets/:id` - Get asset details and linked tickets.

### Knowledge Base (`/api/v1/articles`)

- `GET /api/v1/articles` - List published KB articles.
- `POST /api/v1/articles` - Create or update a KB article.

### SLA & Business Schedules (`/api/v1/sla`)

- `GET /api/v1/sla/policies` - List SLA policies.
- `GET /api/v1/sla/clocks/:ticketId` - Get SLA response/resolution clock status for a ticket.

### Reports & Analytics (`/api/v1/reports`)

- `GET /api/v1/reports/executive` - Executive analytics dashboard metrics.
- `POST /api/v1/reports/export` - Export report data in `csv`, `pdf`, or `xlsx` formats.

### Administration (`/api/v1/admin`)

- `GET /api/v1/admin/tenants` - List tenants (System Admin).
- `POST /api/v1/admin/tenants` - Provision new tenant context.
- `GET /api/v1/admin/audit-logs` - Query tenant audit events.

---

## 3. Error Code Standards

SupportDesk Enterprise APIs return standard JSON error responses:

```json
{
  "statusCode": 403,
  "errorCode": "PERMISSION_DENIED",
  "message": "User lacks required permission 'ticket:delete' for tenant.",
  "timestamp": "2026-08-02T12:00:00.000Z",
  "correlationId": "req-98234-abc"
}
```
