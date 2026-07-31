# Notifications

Notifications originate from committed Domain Events. Channels initially are email and in-product web. Templates are Tenant-scoped, versioned, locale-aware, escaped by default, and previewed with synthetic data. Event routing is specified in [notification-events.md](notification-events.md), and transactional email templates are specified in [email-templates.md](email-templates.md).

Issue #25 (`E06-I01`) implements **in-app notifications only**: tenant-scoped inbox rows, preferences, list/count/update APIs, and a synchronous `NotificationsService` that ticketing (and future modules) call after mutations. Email intents, attempts, templates, queues, and provider webhooks remain deferred.

## Rules

- Resolve recipients at send preparation, then enforce Permission, Comment visibility, verified address, preferences, legal/transactional classification, and suppression.
- Internal Comments never reach Requesters. Public content is minimized; sensitive fields and attachments are linked behind authentication rather than embedded.
- Store provider-neutral intent separately from attempts. Deduplicate on notification intent, recipient, channel, and template version.
- Retry transient failures with exponential backoff and jitter; do not retry permanent rejection. Record accepted, delivered where supported, bounced, complained, suppressed, and permanently failed.
- Signed action links are single-purpose, short-lived, revocable, and do not authenticate unrelated actions.
- Tenants may configure branding and preferences but cannot disable mandatory security notices.
- In-app creation suppresses self-notifications and honors per-user `in_app` preferences (default enabled).

## Acceptance criteria

A transaction rollback emits nothing. Event replay produces no duplicate notification intent. Bounce/complaint webhooks are authenticated, replay-safe, and Tenant-mapped without trusting payload Tenant fields. A provider outage queues bounded work, exposes backlog/age, and recovers within the NFR target. Provider selection is unresolved in OQ-10.
