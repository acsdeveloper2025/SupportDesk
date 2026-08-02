# SupportDesk Enterprise Administration Guide

## Overview

The SupportDesk Central Administration & Platform Management Console provides enterprise operators, tenant administrators, and compliance officers with complete operational control over the platform.

---

## 1. Global Administration

- **Platform Settings**: Configure global branding, default locale, time zone, security policies, and password complexity requirements.
- **Maintenance Windows**: Schedule platform-wide or tenant-specific maintenance windows (`/admin/settings`).
- **Feature Flags**: Manage dynamic feature flags and target rules globally or per tenant.

---

## 2. Tenant Administration

- **Tenant Provisioning**: Provision customer workspace aggregates (`/admin/tenants`).
- **Tenant Quotas**: Configure max users, max monthly tickets, storage limits, and custom domain permissions.
- **Lifecycle Management**: Transition tenant lifecycle states between `ACTIVE`, `SUSPENDED`, and `DEACTIVATED` with full audit trail.

---

## 3. User & Session Administration

- **User Directory**: View, invite, activate, or deactivate user accounts across or within tenants (`/admin/users`).
- **Account Lockouts**: Inspect and manage account lockouts triggered by brute-force authentication protection.
- **Session Controls**: Inspect live active sessions and force logout users across all connected devices.

---

## 4. Roles & Permission Matrix

- **Custom Roles**: Define tenant custom roles and assign canonical permission keys (`/admin/roles`).
- **Permission Matrix**: View the complete permission evaluation matrix across all system and custom roles.
- **Effective Permission Inspector**: Inspect computed effective permissions and grant sources for any user.

---

## 5. Subsystem Operations

- **Workflow Administration**: Monitor workflow executions, step attempts, and retry failed transitions (`/admin/workflows`).
- **Transactional Outbox & DLQ**: Inspect pending events, monitor dead-letter queues, replay single events, or trigger batch retries (`/admin/outbox`).
- **SLA Engine**: Monitor SLA compliance rates, active timers, breaches, and business schedules (`/admin/sla`).
- **Notification Administration**: Track notification dispatch queues, delivery rates, and retry failed intents (`/admin/notifications`).

---

## 6. Audit Explorer & Security Dashboard

- **Security Dashboard**: Track failed login spikes, account lockouts, and privileged role assignments over 24-hour periods (`/admin/audit`).
- **Audit Log Explorer**: Search and filter append-only business and security audit events by tenant, actor, action, or date range.
