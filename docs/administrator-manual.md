# SupportDesk Enterprise v1.0 — Administrator Manual

This manual provides comprehensive instructions for System Administrators and Tenant Administrators managing SupportDesk Enterprise v1.0.

---

## 1. System Administration & Multi-Tenant Management

### Creating & Provisioning Tenants

System Administrators can provision new isolation contexts (tenants) via the Administration Console (`/admin/tenants`) or API:

- **Name**: Display name of the enterprise organization (e.g., `Acme Corp`).
- **Slug**: Unique domain identifier (e.g., `acme-corp`). Used for tenant subdomains or header routing (`X-Tenant-ID`).
- **Branding & Theme**: Upload tenant logo, primary accent color, and custom portal header title.
- **Feature Flags**: Enable or disable modules per tenant (e.g., enable/disable Asset CMDB or Advanced Analytics).

---

## 2. User, Role & Access Control (RBAC)

### Predefined Roles Matrix

SupportDesk Enterprise enforces a strict least-privilege RBAC system:

| Role Name        | Scope  | Permissions                                                                  |
| :--------------- | :----- | :--------------------------------------------------------------------------- |
| **SYSTEM_ADMIN** | Global | Full platform access, tenant provisioning, system health monitoring.         |
| **TENANT_ADMIN** | Tenant | Tenant configuration, user management, custom roles, SLA policies, teams.    |
| **MANAGER**      | Tenant | Queue management, team ticket assignment, approval approvals, reports.       |
| **AGENT**        | Tenant | Ticket response, resolution, KB article creation, asset linking.             |
| **END_USER**     | Tenant | Service catalog request submission, submitting tickets, reading KB articles. |

### Custom Role Creation

Administrators can create custom roles with tailored permission strings (e.g., `ticket:read`, `ticket:assign`, `asset:write`, `report:export`) via `/admin/roles`.

---

## 3. SLA & Business Hours Configuration

### Defining SLA Policies

Configure SLA response and resolution targets under `/admin/sla`:

1. **Target Priority**: Set targets per priority (`CRITICAL`: 15m response / 2h resolution; `HIGH`: 1h response / 8h resolution).
2. **Business Hours Schedule**: Define working days (e.g., Mon–Fri 09:00–17:00 UTC) and enterprise holiday calendars.
3. **Breach Escalation**: Configure automated escalation actions when a ticket breaches response/resolution deadlines.

---

## 4. Workflow Automation Builder

Automate queue management and triaging using the event-driven workflow engine (`/admin/workflows`):

- **Triggers**: `ON_TICKET_CREATED`, `ON_STATUS_CHANGED`, `ON_SLA_BREACHED`.
- **Conditions**: Match category (`INCIDENT`), priority (`CRITICAL`), or keyword in description.
- **Actions**: `ASSIGN_TEAM`, `SET_PRIORITY`, `SEND_NOTIFICATION`, `TRIGGER_WEBHOOK`.

---

## 5. Audit Logging & System Diagnostics

- **Audit Logs (`/admin/audit-logs`)**: Browse immutable tenant audit events capturing actor ID, event action, IP address, timestamp, and target resource.
- **System Health Console (`/admin/health`)**: Monitor PostgreSQL DB connection pool, Redis queue status, outbox backlog size, and system memory consumption.
