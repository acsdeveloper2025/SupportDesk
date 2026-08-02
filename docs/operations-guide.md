# SupportDesk Enterprise Operations Guide

## Operational Overview

This guide documents day-two operations, component health monitoring, runtime diagnostics, and emergency recovery procedures for SupportDesk Platform v1.0.

---

## 1. System Component Health Monitoring

Component health is monitored via the `/api/v1/admin/health/detailed` REST API and the `/admin/health` console.

| Component                | Monitored Metric                 | Health Threshold | Diagnostic Action                              |
| ------------------------ | -------------------------------- | ---------------- | ---------------------------------------------- |
| **PostgreSQL DB**        | Query Latency, Connections       | Latency < 50ms   | Check active locks, connection pool exhaustion |
| **Transactional Outbox** | Pending Count, Failed Count      | Failed < 100     | Run `/api/v1/admin/outbox/events/retry-failed` |
| **Workflow Engine**      | Running Executions, Failed Steps | Failed = 0       | Retry step via `/admin/workflows`              |
| **SLA Engine**           | Active Timers, Breach Count      | Compliance > 95% | Check business hours schedule calculations     |
| **Notifications**        | Intent Queue Depth               | Pending < 500    | Verify email SMTP provider status              |

---

## 2. Runtime Diagnostics & Environment Validation

Execute automated environment diagnostics via `/api/v1/admin/diagnostics` or `/admin/diagnostics`:

- **Node.js Environment**: Validates Node >= 22 runtime version.
- **Database Connectivity**: Executes `SELECT 1` ping query against primary PostgreSQL pool.
- **Permissions Registry**: Verifies that canonical framework permissions are seeded in database.

---

## 3. Database Migration & Safety Procedures

1. **Migration Execution**:
   ```bash
   pnpm migrate:verify
   ```
2. **Schema Verification**: Ensure zero migration drift against production PostgreSQL.
3. **Backup & Rollback**: Backup PostgreSQL database before major version upgrades using `pg_dump`.

---

## 4. Emergency Procedures

- **Force User Logout**: Revoke all sessions for compromised account via `/api/v1/admin/users/:id/force-logout`.
- **Tenant Suspension**: Immediately suspend compromised tenant workspace via `/api/v1/admin/tenants/:id/suspend`.
- **Maintenance Mode**: Enable platform-wide maintenance mode window via `/api/v1/admin/maintenance-windows`.
