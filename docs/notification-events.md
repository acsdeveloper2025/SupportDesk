# Notification event matrix

This matrix expands [11-notifications.md](11-notifications.md), [audit-events.md](audit-events.md), and [email-templates.md](email-templates.md).

Channels: In-App, Email, Webhook, Future Push Notifications.

| Event                           | Recipient                                      | Channels                            | Template                             | Retry behavior                                                     | Failure handling                                        |
| ------------------------------- | ---------------------------------------------- | ----------------------------------- | ------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------- |
| `auth.password_reset.requested` | Account owner                                  | Email                               | `password_reset`                     | Retry transient email failures with bounded backoff.               | Permanent failure suppressed; security signal on abuse. |
| `user.invited`                  | Invitee                                        | Email                               | `invitation`                         | Retry until expiry or permanent bounce.                            | Mark invite delivery failed; admin can resend.          |
| `membership.created`            | New member                                     | In-App, Email                       | `welcome`                            | Standard notification retry.                                       | Admin sees delivery failure.                            |
| `auth.session.revoked`          | Account owner                                  | Email, In-App                       | `security_session_revoked`           | Security notices retry with priority.                              | Alert if all channels fail.                             |
| `ticket.created`                | Requester, assigned group/queue                | Email, In-App, Webhook              | `ticket_created`, `new_ticket_alert` | Deduplicate by ticket/channel/recipient.                           | Backlog visible; no duplicate ticket.                   |
| `ticket.assignment_changed`     | New assignee/group, previous assignee optional | In-App, Email, Future Push          | `ticket_assigned`                    | Retry transient; coalesce rapid reassignments where policy allows. | Escalate if assignee notice terminally fails.           |
| `ticket.status_changed`         | Requester, watchers, assigned agents           | In-App, Email, Webhook              | `ticket_status_changed`              | Retry public updates; suppress internal-only visibility.           | Terminal failure recorded on ticket timeline.           |
| `comment.created.public`        | Requester, watchers, assigned agents           | In-App, Email, Webhook              | `ticket_reply`                       | Retry; dedupe provider message identity.                           | Bounce may suppress requester email.                    |
| `comment.created.internal`      | Agents/managers/watchers with internal access  | In-App, Email                       | `internal_comment`                   | Retry; never send to Requesters.                                   | Alert on visibility policy violation.                   |
| `sla.warning`                   | Assignee, manager, configured escalation group | In-App, Email, Future Push          | `sla_warning`                        | Priority retry until breach/resolution.                            | Operations metric if stale.                             |
| `sla.breached`                  | Assignee, manager, Tenant Admin optional       | In-App, Email, Webhook, Future Push | `sla_breached`                       | Priority retry; dedupe per target threshold.                       | Escalate to operations if backlog prevents delivery.    |

MVP Issue #26 implements **in-app** `sla.warning` / `sla.breached` notifications only (assignee, or requester if unassigned). Email, escalation groups, and worker-driven delivery remain deferred.
| `approval.requested` | Approver(s) | In-App, Email, Future Push | `approval_request` | Retry until expiry/decision. | Escalate to backup approver if configured. |
| `workflow.execution_failed` | Tenant Admin/operations owner | In-App, Email | `workflow_failure` | Retry until acknowledged or terminal. | Auto-pause workflow if failure threshold crossed. |
| `notification.failed` | Tenant Admin/operations owner | In-App | `notification_failure_summary` | No recursive email if provider failed. | Operations dashboard and alert. |
| `export.completed` | Requester | In-App, Email | `export_ready` | Retry while export downloadable. | Expiry notice; user can recreate export. |
| `settings.security.updated` | Tenant Admin/security contacts | Email, In-App | `security_settings_changed` | Security priority retry. | Alert on total failure. |
| `operator_elevation.approved` | Tenant security contacts, platform security | Email, In-App | `operator_elevation_notice` | Security priority retry. | Page security if notice cannot be delivered. |

## Provider rules

Notification intents are provider-neutral. Attempts store provider state. Provider webhooks are authenticated, replay-safe, and tenant-mapped by stored provider references, never by trusting payload tenant fields.
