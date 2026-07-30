# Audit event catalogue

Audit Events are immutable, tenant-scoped evidence described in [07-security-compliance.md](07-security-compliance.md), [12-data-model.md](12-data-model.md), and [database/TABLES.md](database/TABLES.md).

## Event envelope

```json
{
  "event_id": "aud_opaque",
  "tenant_id": "ten_opaque",
  "occurred_at": "2026-07-30T08:45:00Z",
  "actor": {
    "type": "user",
    "id": "usr_opaque",
    "membership_id": "mem_opaque"
  },
  "action": "ticket.created",
  "target": {
    "type": "ticket",
    "id": "tkt_opaque"
  },
  "outcome": "succeeded",
  "correlation_id": "corr_opaque",
  "metadata": {
    "safe_before": null,
    "safe_after": {
      "status": "new",
      "priority": "normal"
    }
  }
}
```

Payloads must exclude secrets, tokens, raw attachment content, unnecessary personal data, and cross-tenant existence details.

## Catalogue

| Event                                 | Category       | Actor                          | Target               | Required metadata                       | Notification/outbox                 |
| ------------------------------------- | -------------- | ------------------------------ | -------------------- | --------------------------------------- | ----------------------------------- |
| `auth.login.succeeded`                | Authentication | User                           | Session              | Method, tenant selected, device summary | Optional security notice.           |
| `auth.login.failed`                   | Authentication | Anonymous/user candidate       | Identifier hash      | Reason class, IP risk signal            | Security alert threshold.           |
| `auth.logout`                         | Authentication | User                           | Session              | Session ID hash, reason                 | None.                               |
| `auth.session.revoked`                | Authentication | User/admin                     | Session              | Revoked by, reason                      | Security notice.                    |
| `auth.password_reset.requested`       | Authentication | Anonymous                      | User candidate       | Identifier hash, delivery intent        | Password reset email.               |
| `auth.password_reset.completed`       | Authentication | User                           | User                 | Method, session changes                 | Security notice.                    |
| `auth.login.password_change_required` | Authentication | User                           | Session              | Tenant selected, expiry state           | Optional security notice.           |
| `auth.password_change.rejected`       | Authentication | Anonymous/user candidate       | User/session         | Safe reason class                       | Security alert threshold.           |
| `auth.password_change.completed`      | Authentication | User                           | User                 | Tenant, credential revocation summary   | Security notice.                    |
| `tenant.created`                      | Tenant         | Super Admin/system             | Tenant               | Slug, plan/entitlement, owner           | Welcome/admin notice.               |
| `tenant.updated`                      | Tenant         | Tenant Admin/elevated operator | Tenant settings      | Namespace, safe before/after            | Config change notice if sensitive.  |
| `tenant.suspended`                    | Tenant         | Super Admin                    | Tenant               | Reason, effective time                  | Admin notice.                       |
| `tenant.deleted_or_retained`          | Tenant         | Super Admin/system             | Tenant               | Retention/legal hold result             | Admin notice.                       |
| `user.invited`                        | Identity       | Tenant Admin                   | Invitation           | Email hash, role IDs, expiry            | Invitation email.                   |
| `membership.created`                  | Identity       | Tenant Admin/system            | Membership           | Roles/groups                            | Welcome/invite.                     |
| `membership.suspended`                | Identity       | Tenant Admin                   | Membership           | Reason, safe status change              | Security notice.                    |
| `role.created`                        | RBAC           | Tenant Admin                   | Role                 | Permission grants                       | None by default.                    |
| `role.updated`                        | RBAC           | Tenant Admin/Approver          | Role                 | Safe before/after grants                | Security/admin notice if sensitive. |
| `permission.changed`                  | RBAC           | Tenant Admin/Approver          | Role/Membership      | Grant/revoke summary                    | Security/admin notice.              |
| `operator_elevation.requested`        | Platform       | Super Admin                    | Tenant               | Purpose, scope, duration                | Approval request.                   |
| `operator_elevation.approved`         | Platform       | Approver                       | Elevation            | Approver, scope, expiry                 | Security notice.                    |
| `operator_elevation.revoked`          | Platform       | Approver/security              | Elevation            | Reason                                  | Security notice.                    |
| `ticket.created`                      | Ticket         | Requester/Agent/worker         | Ticket               | Channel, priority, requester type       | Acknowledgement and queue alert.    |
| `ticket.updated`                      | Ticket         | Agent/automation               | Ticket               | Safe changed fields                     | Watcher update.                     |
| `ticket.priority_changed`             | Ticket         | Agent/Manager                  | Ticket               | Before/after priority, reason           | Optional escalation.                |
| `ticket.assignment_changed`           | Ticket         | Agent/Manager/workflow         | Ticket               | Previous/new assignee/group             | Assignment notice.                  |
| `ticket.status_changed`               | Ticket         | Agent/Requester/workflow       | Ticket               | From/to status, reason                  | Status notice.                      |
| `ticket.closed`                       | Ticket         | Agent/system                   | Ticket               | Close reason/window                     | Closed notice.                      |
| `comment.created`                     | Comment        | Requester/Agent/worker         | Comment              | Visibility, source                      | Public reply/internal mention.      |
| `comment.redacted`                    | Comment        | Tenant Admin/Approver          | Comment              | Reason, legal basis                     | Security/admin notice.              |
| `attachment.uploaded`                 | Attachment     | User/worker                    | Attachment           | File metadata, scan state               | None until clean if public.         |
| `attachment.scan_completed`           | Attachment     | Scanner/worker                 | Attachment           | Result, provider reference              | Quarantine or availability notice.  |
| `attachment.deleted`                  | Attachment     | User/admin                     | Attachment           | Reason                                  | Optional watcher notice.            |
| `workflow.published`                  | Automation     | Tenant Admin/Approver          | Workflow version     | Version, validation result              | Admin notice.                       |
| `workflow.paused`                     | Automation     | Tenant Admin/operator          | Workflow             | Reason                                  | Admin notice.                       |
| `workflow.execution_failed`           | Automation     | Worker                         | Workflow execution   | Event, error class, retry state         | Operations alert.                   |
| `sla.target_created`                  | SLA            | System                         | SLA Target           | Policy/schedule version, due time       | Optional due notice.                |
| `sla.warning`                         | SLA            | System                         | SLA Target           | Threshold, due time                     | SLA warning.                        |
| `sla.breached`                        | SLA            | System                         | SLA Target           | Due time, breached at                   | Escalation notice.                  |
| `notification.sent`                   | Notification   | Worker                         | Notification intent  | Channel, provider, template             | Provider effect.                    |
| `notification.failed`                 | Notification   | Worker/provider                | Notification attempt | Failure class, retry state              | Operations alert if terminal.       |
| `report.export_requested`             | Export         | User                           | Export job           | Resource, filters summary, format       | Export job notice.                  |
| `report.export_downloaded`            | Export         | User                           | Export job           | Download time/IP summary                | Audit only.                         |
| `settings.updated`                    | Settings       | Tenant Admin                   | Setting namespace    | Safe before/after, version              | Admin/security notice if sensitive. |
| `retention.executed`                  | Retention      | System                         | Data class/resource  | Policy version, counts                  | Operations evidence.                |
| `legal_hold.changed`                  | Retention      | Tenant Admin/legal             | Legal hold           | Scope, reason, expiry                   | Admin/security notice.              |

## Retention and access

Audit retention is governed by OQ-06 until accepted. Audit exports require `audit.export`, are themselves audited, and must apply tenant and content visibility rules.
