# Authentication & Identity Quality Gate

Status: ready for review
Date: 2026-07-31
Milestone scope: Authentication, Identity, tenant-aware sessions, RBAC foundation, browser authentication transport, and authentication documentation.

## Completed issue trace

| Issue | Area                                               | Result   |
| ----- | -------------------------------------------------- | -------- |
| `#1`  | Tenant, identity, and RBAC schema foundation       | Complete |
| `#2`  | Password hashing and policy foundation             | Complete |
| `#3`  | Tenant-aware registration                          | Complete |
| `#4`  | Email verification                                 | Complete |
| `#5`  | Login, sessions, and lockout                       | Complete |
| `#6`  | JWT access tokens and refresh-token rotation       | Complete |
| `#7`  | Password reset                                     | Complete |
| `#8`  | Password change and password expiration            | Complete |
| `#9`  | Account lockout hardening                          | Complete |
| `#10` | RBAC foundation                                    | Complete |
| `#11` | Authentication audit logging                       | Complete |
| `#29` | Browser authentication transport ADR               | Complete |
| `#30` | Access-token guard and current identity API        | Complete |
| `#31` | Secure browser BFF sessions and CSRF               | Complete |
| `#13` | Frontend authentication pages                      | Complete |
| `#14` | OpenAPI, documentation, coverage, and quality gate | Complete |

## Implemented API surface

The generated OpenAPI document is covered by `apps/api/src/auth/auth.openapi.spec.ts` and includes the implemented authentication endpoints:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/email-verification/confirm`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/password-reset/request`
- `POST /api/v1/auth/password-reset/confirm`
- `POST /api/v1/auth/password/change`
- `GET /api/v1/auth/sessions`
- `DELETE /api/v1/auth/sessions/{sessionId}`

`POST /api/v1/auth/select-tenant` is intentionally deferred until multi-membership onboarding is implemented. Current sessions authenticate into one tenant context and enforce tenant ownership at the session, token, identity, role, and permission boundaries.

## Database scope

The Prisma schema and migrations contain only Authentication & Identity milestone tables:

- `tenants`, `tenant_settings`, `tenant_domains`
- `users`, `user_profiles`, `user_preferences`
- `roles`, `permissions`, `user_roles`, `role_permissions`
- `sessions`, `refresh_tokens`, `auth_tokens`
- `audit_events`

No ticket, SLA, workflow, dashboard, report, notification-delivery, search, knowledge-base, or service-catalog application tables were added in this milestone.

## Browser authentication decision

ADR-0005 selects a same-origin Next.js BFF for browser authentication. Browser code calls `/api/auth/*`, stores session material only in `HttpOnly`, `Secure`, `SameSite=Lax` cookies, and requires CSRF validation for cookie-authenticated mutations. Browser-readable storage such as `localStorage` and `sessionStorage` is prohibited for tokens and refresh material.

## Verification commands

Required local quality gates:

```bash
pnpm run ci
pnpm coverage:auth
pnpm --filter @supportdesk/web test:e2e
```

Authentication service-layer coverage gate:

- Statements: 95.32%
- Branches: 80.36%
- Functions: 98.27%
- Lines: 95.32%

The auth coverage gate excludes Prisma repository adapters, module declarations, type-only contracts, and the notification adapter. Repository adapter integration coverage remains tracked as technical debt before broad production hardening.

## Security review

Implemented controls:

- Argon2id password hashing.
- Tenant-aware registration and login.
- Email verification and password reset tokens stored only as hashes.
- JWT access tokens with refresh-token rotation and reuse detection.
- Account lockout and endpoint-specific rate limiting.
- Deny-by-default RBAC foundation.
- Audit logging for authentication events with recursive secret redaction.
- Bearer-token access guard with active-session and tenant/user ownership checks.
- Same-origin browser BFF with HttpOnly cookies and CSRF validation.
- OpenAPI bearer scheme for protected auth operations.

No unfinished-work markers remain in the authentication, identity, RBAC, or related security documentation scope.

## Remaining technical debt

| Priority | Debt                                                                                                          | Recommendation                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| High     | Prisma repository adapter coverage is below the service-layer threshold when included in the coverage set.    | Add database-backed integration tests using isolated PostgreSQL fixtures before expanding ticketing on top of these repositories. |
| Medium   | `x-session-id` remains available for non-browser local test clients while BFF/bearer flows are now preferred. | Remove the temporary transport once all test and internal clients use bearer or BFF session transport.                            |
| Medium   | Profile update persistence is not implemented; the basic profile page displays current identity only.         | Add a future identity profile update issue before self-service account settings are considered complete.                          |
| Low      | Tenant switching is deferred for users with memberships in multiple tenants.                                  | Implement explicit tenant selection after the organization/membership model is expanded.                                          |

## Readiness recommendation

Authentication & Identity is ready for user review after CI, coverage, and E2E commands pass on the final committed state. The next engineering step should be a code quality review of the Authentication and Ticket readiness boundaries before beginning Core Ticket Management.
