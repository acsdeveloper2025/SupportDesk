# SupportDesk Enterprise v1.0 — Operations Runbook

This runbook outlines operational procedures, health checks, incident triage guidelines, alerting rules, and emergency recovery steps for SupportDesk Enterprise v1.0.

---

## 1. Monitoring & Observability Dashboard Targets

### Core Service Health Metrics

- **HTTP Latency**: 95th percentile < 250ms for API read/write endpoints.
- **HTTP Error Rate**: 5xx error responses < 0.05% of total requests.
- **DB Connection Pool**: Active connection utilization < 75%.
- **Outbox Backlog**: Pending outbox event count < 100 events.
- **SLA Breach Rate**: Breach percentage monitored per tenant.

---

## 2. High-Priority Alert Triage & Resolution

### Alert 1: Outbox Queue Backlog Spiking (`OutboxBacklogHigh`)

- **Symptom**: `OutboxEvent` table has >1,000 pending events older than 2 minutes. Notifications/webhooks delayed.
- **Triage**:
  1. Check Redis connectivity: `redis-cli ping`.
  2. Inspect API background outbox worker logs for connection timeouts or external email API rate limiting.
  3. Scale up API background worker instances or increase outbox batch processing concurrency.

### Alert 2: Database Connection Pool Exhaustion (`DBPoolExhausted`)

- **Symptom**: API logs report `PrismaClientKnownRequestError: Timed out fetching a new connection from the pool`.
- **Triage**:
  1. Inspect active PostgreSQL queries:
     ```sql
     SELECT pid, now() - query_start AS duration, query, state
     FROM pg_stat_activity
     WHERE state != 'idle' ORDER BY duration DESC;
     ```
  2. Kill long-running unindexed queries using `SELECT pg_cancel_backend(pid);`.
  3. Verify connection pool sizing (`connection_limit=20`) per API replica.

---

## 3. Log Rotation & Disk Space Hygiene

- Configure log rotation for `/var/log/supportdesk/*.log` with daily rotation and 14-day retention.
- Ensure local attachment upload directory (`./uploads` or `/var/supportdesk/uploads`) is monitored for disk usage triggers (>80% full).

---

## 4. Emergency Contacts & Escalation Chain

1. **On-Call Operations Engineer**: SRE / Ops Duty Team
2. **Database Administrator (DBA)**: Data Infrastructure Team
3. **Security Lead**: Enterprise Security Incident Response Team (SIRT)
