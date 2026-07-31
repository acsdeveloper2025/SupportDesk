# Security and compliance

## Control baseline

| ID     | Control and evidence                                                                                                                                     |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01 | Tenant isolation per TEN-01–TEN-08; negative tests, review, and incident metrics.                                                                        |
| SEC-02 | Standards-based identity, phishing-resistant MFA for privileged roles, least-privilege RBAC, session revocation, and audited elevation.                  |
| SEC-03 | TLS in transit, approved encryption at rest, managed key rotation, secrets manager, and no secrets in source/logs.                                       |
| SEC-04 | Server-side validation, output encoding, CSRF protection where cookie-authenticated, restrictive CORS/CSP, SSRF defenses, and parameterized persistence. |
| SEC-05 | Immutable Audit Events, synchronized clocks, access-controlled retention, integrity monitoring, and export evidence.                                     |
| SEC-06 | Data classification, purpose limitation, minimization, retention/deletion workflows, subject-request support, and vendor inventory.                      |
| SEC-07 | Malware scanning, content-type/size validation, randomized object identity, quarantining, and safe download headers for attachments.                     |
| SEC-08 | Tenant-aware rate limits, abuse detection, enumeration resistance, export throttles, and security alerting.                                              |
| SEC-09 | SAST, dependency/license/secret/container/IaC scanning, SBOM, signed provenance, patch SLAs, and annual penetration test before GA.                      |
| SEC-10 | Incident response roles, evidence preservation, severity policy, notification decision process, tabletop exercises, and lessons tracked to closure.      |

## Privacy and compliance

Personal data is classified and inventoried before collection. Production content is excluded from non-production. Support access requires documented purpose, approval, time-bound elevation, and Audit Events. Subprocessors require security/privacy review and contractual safeguards. Initial certification targets remain unresolved (OQ-01); controls should be evidence-ready for SOC 2-style assurance without claiming certification.

## Security acceptance

No critical or high exploitable finding may ship. Critical patches are remediated or mitigated within 24 hours, high within 7 days, medium within 30 days, with approved time-limited exceptions. Authentication and isolation failures page on-call. Threat models are updated for new trust boundaries, sensitive flows, and external integrations.

Password-recovery responses do not reveal whether a tenant, membership, user, or token exists. Recovery tokens are generated with a cryptographically secure random source, stored only as hashes, purpose-scoped, time-bounded, and consumed once. Successful password resets revoke active sessions and refresh-token families for the affected tenant/user identity, and request, rejection, expiry, replay, and completion events are audited without recording raw tokens or passwords.

## M2 password and token baseline

Local credential support uses Argon2id with environment-driven cost parameters, secure random one-time tokens, SHA-256 token hashes for storage, and configurable email-verification expiry. Password validation returns safe policy error codes only; raw passwords and raw recovery or verification tokens must never be logged, persisted, returned from helpers, or included in audit metadata.

Session creation is tenant-scoped, revocable, and separates server-side session lifetime from JWT/refresh-token transport. Remember-me uses a longer configurable server-session lifetime and must remain auditable.

JWT access tokens must carry only minimal identity, tenant, and session claims. Refresh tokens are opaque, randomly generated, stored only as hashes, rotated on every use, and treated as replayed when a rotated or revoked token appears again.

Tenant password-expiration policy is enforced during login through an explicit `password_change_required` state. Password change requires an active tenant session and the current password, rejects current-password reuse, records the next expiration timestamp, revokes all sessions and refresh tokens for that tenant/user identity, and requires reauthentication. Password-reset completion applies the same expiration calculation.

Authentication-sensitive endpoints are protected by endpoint-scoped fixed-window throttles partitioned by hashed tenant, identifier, token, session, device, and IP dimensions. Exceeded buckets return HTTP 429 with retry guidance and create a redacted audit event. Login failures update persistent user lockout state according to the selected tenant's threshold, window, and duration; callers receive the same denial for wrong credentials and active lockouts.

Authentication audit metadata is constructed through a shared recursive redaction boundary. Raw passwords, access/refresh/recovery/verification tokens, secrets, authorization values, cookies, credentials, IP addresses, and user-agent strings are never persisted in audit metadata; request identifiers are represented by SHA-256 hashes. Authentication-sensitive operations await the audit write and fail closed if evidence cannot be persisted. Audit-write failures must page operations as defined in [17-observability.md](17-observability.md).

Browser authentication uses the same-origin Next.js Backend-for-Frontend selected in [adr/ADR-0005.md](adr/ADR-0005.md). Browser session material must be stored only in `HttpOnly`, `Secure`, `SameSite=Lax` cookies, with `Secure` relaxed only for local `http://localhost` development. Refresh tokens and session identifiers must never be exposed to browser JavaScript. The BFF must validate CSRF tokens on cookie-authenticated mutations before forwarding requests to the API.

The initial rate-limit store is process-local and intentionally isolated behind `AuthRateLimitStore`. A shared atomic store such as Redis is required before horizontally scaling the API; production readiness must block multi-replica deployment until that adapter is configured.
