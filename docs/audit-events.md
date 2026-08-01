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

Authentication audit writes pass through one envelope builder. It recursively redacts password, secret, authorization, cookie, credential, and token fields. IP addresses and user-agent values are stored only as SHA-256 request hashes in metadata. The builder preserves the correlation ID and adds tenant, actor, and target identifiers when they are known. Authentication-sensitive operations await audit persistence; an audit-write failure fails the request closed and is an operational alert condition.

## Catalogue

| Event                                      | Category       | Actor                          | Target               | Required metadata                       | Notification/outbox                     |
| ------------------------------------------ | -------------- | ------------------------------ | -------------------- | --------------------------------------- | --------------------------------------- |
| `auth.login.succeeded`                     | Authentication | User                           | Session              | Method, tenant selected, device summary | Optional security notice.               |
| `auth.login.failed`                        | Authentication | Anonymous/user candidate       | Identifier hash      | Reason class, IP risk signal            | Security alert threshold.               |
| `auth.logout`                              | Authentication | User                           | Session              | Session ID hash, reason                 | None.                                   |
| `auth.session.revoked`                     | Authentication | User/admin                     | Session              | Revoked by, reason                      | Security notice.                        |
| `auth.registration.completed`              | Authentication | New User                       | User                 | Identifier hash, Tenant                 | Verification delivery intent.           |
| `auth.registration.rejected`               | Authentication | Anonymous/user candidate       | User candidate       | Safe reason, identifier hash if valid   | Security alert threshold.               |
| `auth.email_verification.completed`        | Authentication | User                           | User                 | Tenant, request hashes                  | Optional security notice.               |
| `auth.email_verification.rejected`         | Authentication | Anonymous/user candidate       | Token candidate      | Safe reason class                       | Security alert threshold.               |
| `auth.password_reset.requested`            | Authentication | Anonymous                      | User candidate       | Identifier hash, delivery intent        | Password reset email.                   |
| `auth.password_reset.request_rejected`     | Authentication | Anonymous                      | User candidate       | Safe reason, identifier hash if valid   | Security alert threshold.               |
| `auth.password_reset.rejected`             | Authentication | Anonymous/user candidate       | User candidate       | Safe reason class                       | Security alert threshold.               |
| `auth.password_reset.replay_detected`      | Authentication | User candidate                 | User                 | Safe replay reason                      | Security alert.                         |
| `auth.password_reset.completed`            | Authentication | User                           | User                 | Method, session changes                 | Security notice.                        |
| `auth.refresh.succeeded`                   | Authentication | User                           | Session              | Request hashes                          | None.                                   |
| `auth.refresh.failed`                      | Authentication | Anonymous/user candidate       | Session/token        | Safe reason class                       | Security alert threshold.               |
| `auth.refresh_token.reuse_detected`        | Authentication | User                           | Session              | Safe replay reason                      | Security alert.                         |
| `auth.login.password_change_required`      | Authentication | User                           | Session              | Tenant selected, expiry state           | Optional security notice.               |
| `auth.password_change.rejected`            | Authentication | Anonymous/user candidate       | User/session         | Safe reason class                       | Security alert threshold.               |
| `auth.password_change.completed`           | Authentication | User                           | User                 | Tenant, credential revocation summary   | Security notice.                        |
| `auth.login.locked`                        | Authentication | User candidate                 | User                 | Safe reason class, IP/device hashes     | Security alert.                         |
| `auth.rate_limit.exceeded`                 | Authentication | Anonymous/user candidate       | Request bucket       | Scope, retry delay                      | Security alert threshold.               |
| `rbac.role.assigned`                       | Authorization  | User                           | User role            | Role ID, target user ID                 | Security/admin notice.                  |
| `rbac.role.assignment_rejected`            | Authorization  | User                           | User role            | Safe denial reason, role/target IDs     | Security alert threshold.               |
| `rbac.role_permission.assigned`            | Authorization  | User                           | Role permission      | Stable permission key, role ID          | Security/admin notice.                  |
| `rbac.role_permission.assignment_rejected` | Authorization  | User                           | Role permission      | Stable permission key, role ID          | Security alert threshold.               |
| `tenant.created`                           | Tenant         | Super Admin/system             | Tenant               | Slug, plan/entitlement, owner           | Welcome/admin notice.                   |
| `tenant.updated`                           | Tenant         | Tenant Admin/elevated operator | Tenant settings      | Namespace, safe before/after            | Config change notice if sensitive.      |
| `tenant.suspended`                         | Tenant         | Super Admin                    | Tenant               | Reason, effective time                  | Admin notice.                           |
| `tenant.deleted_or_retained`               | Tenant         | Super Admin/system             | Tenant               | Retention/legal hold result             | Admin notice.                           |
| `user.invited`                             | Identity       | Tenant Admin                   | Invitation           | Email hash, role IDs, expiry            | Invitation email.                       |
| `membership.created`                       | Identity       | Tenant Admin/system            | Membership           | Roles/groups                            | Welcome/invite.                         |
| `membership.suspended`                     | Identity       | Tenant Admin                   | Membership           | Reason, safe status change              | Security notice.                        |
| `role.created`                             | RBAC           | Tenant Admin                   | Role                 | Permission grants                       | None by default.                        |
| `role.updated`                             | RBAC           | Tenant Admin/Approver          | Role                 | Safe before/after grants                | Security/admin notice if sensitive.     |
| `permission.changed`                       | RBAC           | Tenant Admin/Approver          | Role/Membership      | Grant/revoke summary                    | Security/admin notice.                  |
| `operator_elevation.requested`             | Platform       | Super Admin                    | Tenant               | Purpose, scope, duration                | Approval request.                       |
| `operator_elevation.approved`              | Platform       | Approver                       | Elevation            | Approver, scope, expiry                 | Security notice.                        |
| `operator_elevation.revoked`               | Platform       | Approver/security              | Elevation            | Reason                                  | Security notice.                        |
| `ticket.created`                           | Ticket         | Requester/Agent/worker         | Ticket               | Channel, priority, requester type       | Acknowledgement and queue alert.        |
| `ticket.updated`                           | Ticket         | Agent/automation               | Ticket               | Safe changed fields                     | Watcher update.                         |
| `ticket.priority_changed`                  | Ticket         | Agent/Manager                  | Ticket               | Before/after priority, reason           | Optional escalation.                    |
| `ticket.assignment_changed`                | Ticket         | Agent/Manager/workflow         | Ticket               | Previous/new assignee/group             | Assignment notice.                      |
| `ticket.status_changed`                    | Ticket         | Agent/Requester/workflow       | Ticket               | From/to status, reason                  | Status notice.                          |
| `ticket.closed`                            | Ticket         | Agent/system                   | Ticket               | Close reason/window                     | Closed notice.                          |
| `comment.created`                          | Comment        | Requester/Agent/worker         | Comment              | Visibility, source                      | Public reply/internal mention.          |
| `comment.redacted`                         | Comment        | Tenant Admin/Approver          | Comment              | Reason, legal basis                     | Security/admin notice.                  |
| `attachment.uploaded`                      | Attachment     | User/worker                    | Attachment           | File metadata, scan state               | None until clean if public.             |
| `attachment.scan_completed`                | Attachment     | Scanner/worker                 | Attachment           | Result, provider reference              | Quarantine or availability notice.      |
| `attachment.deleted`                       | Attachment     | User/admin                     | Attachment           | Reason                                  | Optional watcher notice.                |
| `workflow.published`                       | Automation     | Tenant Admin/Approver          | Workflow version     | Version, validation result              | Admin notice.                           |
| `workflow.paused`                          | Automation     | Tenant Admin/operator          | Workflow             | Reason                                  | Admin notice.                           |
| `workflow.execution_failed`                | Automation     | Worker                         | Workflow execution   | Event, error class, retry state         | Operations alert.                       |
| `sla.target_created`                       | SLA            | System                         | SLA Target           | Policy/schedule version, due time       | Optional due notice.                    |
| `sla.paused`                               | SLA            | System                         | SLA Target           | Pause instant, target type              | None.                                   |
| `sla.resumed`                              | SLA            | System                         | SLA Target           | New due time, target type               | None.                                   |
| `sla.met`                                  | SLA            | System                         | SLA Target           | Completion instant, target type         | None.                                   |
| `sla.warning`                              | SLA            | System                         | SLA Target           | Threshold, due time                     | SLA warning (in-app).                   |
| `sla.breached`                             | SLA            | System                         | SLA Target           | Due time, breached at                   | Breach notice (in-app; email deferred). |
| `sla.schedule.created`                     | SLA            | Tenant Admin                   | Business Schedule    | Key, version                            | None.                                   |
| `sla.schedule.draft_updated`               | SLA            | Tenant Admin                   | Business Schedule    | Version                                 | None.                                   |
| `sla.schedule.published`                   | SLA            | Tenant Admin                   | Business Schedule    | Version number                          | Admin notice optional.                  |
| `sla.policy.created`                       | SLA            | Tenant Admin                   | SLA Policy           | Key, version                            | None.                                   |
| `sla.policy.draft_updated`                 | SLA            | Tenant Admin                   | SLA Policy           | Version                                 | None.                                   |
| `sla.policy.published`                     | SLA            | Tenant Admin                   | SLA Policy           | Version number, priority                | Admin notice optional.                  |
| `notification.read`                        | Notification   | Recipient user                 | Notification         | Read/unread, event type                 | None.                                   |
| `notification.unread`                      | Notification   | Recipient user                 | Notification         | Event type                              | None.                                   |
| `notification.archived`                    | Notification   | Recipient user                 | Notification         | Archive state, event type               | None.                                   |
| `notification.unarchived`                  | Notification   | Recipient user                 | Notification         | Event type                              | None.                                   |
| `notification.preference.updated`          | Notification   | Actor user                     | Preference owner     | Event, channel, enabled                 | None.                                   |
| `notification.sent`                        | Notification   | Worker                         | Notification intent  | Channel, provider, template             | Provider effect.                        |
| `notification.failed`                      | Notification   | Worker/provider                | Notification attempt | Failure class, retry state              | Operations alert if terminal.           |
| `report.export_requested`                  | Export         | User                           | Export job           | Resource, filters summary, format       | Export job notice.                      |
| `report.export_downloaded`                 | Export         | User                           | Export job           | Download time/IP summary                | Audit only.                             |
| `settings.updated`                         | Settings       | Tenant Admin                   | Setting namespace    | Safe before/after, version              | Admin/security notice if sensitive.     |
| `retention.executed`                       | Retention      | System                         | Data class/resource  | Policy version, counts                  | Operations evidence.                    |
| `legal_hold.changed`                       | Retention      | Tenant Admin/legal             | Legal hold           | Scope, reason, expiry                   | Admin/security notice.                  |

## Retention and access

Audit retention is governed by OQ-06 until accepted. Audit exports require `audit.export`, are themselves audited, and must apply tenant and content visibility rules.
