# Principles and scope

1. **Tenant safety before convenience.** Every owned record has exactly one Tenant; ambiguous context fails closed.
2. **Auditable intent.** Material changes identify actor, reason where required, before/after-safe metadata, and correlation ID.
3. **Domain truth over channel truth.** Email and web adapt to the Ticket model, not vice versa.
4. **Predictable automation.** Workflows are versioned, bounded, observable, idempotent, and explainable.
5. **Accessible by default.** WCAG 2.2 AA is a release criterion, not remediation work.
6. **Operate what we build.** Each capability has telemetry, failure policy, runbook, and rollback.
7. **Evolution without breakage.** Contracts and schemas change compatibly before old forms are removed.

## Actors and trust boundaries

Requester, Agent, Tenant Administrator, Auditor, and Platform Operator are human actors. Email providers, identity providers, object storage, and delivery vendors are untrusted external systems. Platform Operators use just-in-time, audited elevation; they are not Tenant members by default.

## Explicit boundaries

No feature may join, export, search, cache, or report across Tenants. Tenant administrators cannot alter platform controls. Workflows cannot execute arbitrary customer code. Attachments are untrusted until scanned. See [isolation](06-tenant-isolation.md) and [security](07-security-compliance.md).
