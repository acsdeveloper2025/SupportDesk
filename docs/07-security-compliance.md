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

## M2 password and token baseline

Local credential support uses Argon2id with environment-driven cost parameters, secure random one-time tokens, and SHA-256 token hashes for storage. Password validation returns safe policy error codes only; raw passwords and raw recovery or verification tokens must never be logged, persisted, returned from helpers, or included in audit metadata.
