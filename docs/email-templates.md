# Email template catalogue

Email templates are tenant-scoped, locale-aware, escaped by default, and versioned as described in [11-notifications.md](11-notifications.md). Notification routing is defined in [notification-events.md](notification-events.md).

## Template standards

- No secrets, internal comments, raw tokens, or attachment contents in email.
- Links are short-lived, purpose-bound, revocable, and tenant-scoped.
- Subjects avoid sensitive personal data where possible.
- Templates must render with missing optional fields, long names, right-to-left text, and localization.
- Mandatory security emails cannot be disabled by tenant preference.

| Template key                | Purpose                              | Recipient                | Trigger                               | Required variables                                     | Channels | Failure handling                                |
| --------------------------- | ------------------------------------ | ------------------------ | ------------------------------------- | ------------------------------------------------------ | -------- | ----------------------------------------------- |
| `welcome`                   | Welcome a new active member.         | User/member              | Membership created or invite accepted | Tenant name, user name, sign-in URL                    | Email    | Admin-visible delivery failure.                 |
| `invitation`                | Invite a user to a tenant.           | Invitee                  | Invitation created                    | Tenant name, inviter, role summary, expiry, accept URL | Email    | Resend allowed until expiry.                    |
| `email_verification`        | Verify an email address/domain user. | User                     | Identifier added/changed              | Verification URL, expiry                               | Email    | User remains unverified if failed.              |
| `password_reset`            | Reset password.                      | Account owner            | Reset requested                       | Reset URL, expiry, support link                        | Email    | No existence disclosure.                        |
| `security_session_revoked`  | Notify session revocation.           | Account owner            | Session revoked                       | Device summary, time, support link                     | Email    | Security alert if undeliverable.                |
| `tenant_created`            | Notify initial tenant owner.         | Tenant owner             | Tenant provisioned                    | Tenant name, admin URL, next steps                     | Email    | Platform operations follow-up.                  |
| `ticket_created`            | Confirm requester submission.        | Requester                | Ticket created                        | Ticket ref, subject, portal URL                        | Email    | Visible as delivery failure in ticket metadata. |
| `new_ticket_alert`          | Alert agents/managers of new work.   | Agent/group              | Ticket routed                         | Ticket ref, priority, queue URL                        | Email    | In-app fallback.                                |
| `ticket_assigned`           | Notify assigned user/group.          | Agent/manager            | Assignment changed                    | Ticket ref, assignee, due time                         | Email    | Escalate if terminal failure and SLA risk.      |
| `ticket_reply`              | Public ticket reply.                 | Requester/watchers       | Public comment created                | Ticket ref, safe comment excerpt, portal URL           | Email    | Bounce suppression.                             |
| `internal_comment`          | Internal collaboration notice.       | Agents/managers only     | Internal comment created              | Ticket ref, author, internal URL                       | Email    | Never sent to Requesters.                       |
| `ticket_status_changed`     | Notify visible status update.        | Requester/watchers       | Status changed                        | Ticket ref, old/new status, URL                        | Email    | Terminal failure recorded.                      |
| `ticket_closed`             | Confirm close.                       | Requester/watchers       | Ticket closed                         | Ticket ref, close reason, follow-up URL                | Email    | Bounce suppression.                             |
| `sla_warning`               | Warn before breach.                  | Agent/manager            | SLA threshold crossed                 | Ticket ref, target type, due time                      | Email    | Priority retry.                                 |
| `sla_breached`              | Escalate breach.                     | Agent/manager/admin      | SLA breached                          | Ticket ref, breached target, elapsed time              | Email    | Operations alert on delivery backlog.           |
| `approval_request`          | Request approval.                    | Approver                 | Approval required                     | Request type, actor, scope, approve URL                | Email    | Escalate to backup approver on expiry.          |
| `workflow_failure`          | Notify automation failure.           | Tenant Admin             | Workflow failure/dead letter          | Workflow name, event, failure class                    | Email    | Dashboard alert remains source of truth.        |
| `export_ready`              | Export completion.                   | Requester                | Export job completed                  | Export type, expiry, download URL                      | Email    | User can regenerate if expired.                 |
| `security_settings_changed` | Sensitive settings changed.          | Security contacts/admins | Security/email/auth settings updated  | Namespace, actor, time, review URL                     | Email    | Page security if undeliverable.                 |
| `operator_elevation_notice` | Platform support access notice.      | Tenant security contacts | Elevation approved/used               | Operator, scope, purpose, expiry                       | Email    | Security escalation if failed.                  |

## Preview and testing

Every template version requires synthetic preview data, escaping tests, localization checks, accessibility review for HTML, and delivery tests in a sandbox provider.
