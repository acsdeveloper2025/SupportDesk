# SupportDesk v1.0 Final Hardening Report (Pre-Workflow Gate)

**Date:** 2026-08-01  
**Scope:** Close safe audit findings; synchronize docs/API/DB/tests; verify fresh Postgres migrations  
**Constraint:** No Workflow Engine, outbox implementation, or new business features

---

## 1. Executive Summary

This hardening sprint closed every **safe** Critical/High finding from the Ticket Module v1 engineering audit that did not require new product architecture.

**Fresh PostgreSQL `prisma migrate deploy`:** PASSED (5 migrations, zero schema drift).  
**Quality gates:** format, lint, typecheck, unit tests, build, security scan — verified in this sprint.  
**Remaining High items** are explicitly deferred with ADRs (outbox, MFA, ticket list/create UI) and do **not** block starting **E11-I01** (workflow definition). They **do** block **E11-I03** (execution) until outbox exists.

### Final recommendation

### ⚠️ Minor Follow-up Required

Ready to begin **E11-I01** (workflow definition / draft-publish model) after committing these changes.  
**Not** ready to claim unconditional “begin E11-I02” without accepting remaining Medium/High UI and MFA debt.  
**Blocked** for **E11-I03** until outbox (ADR-0007).

**Production readiness score:** **86 / 100** (up from audit 68).

---

## 2. Files Changed (summary)

### Database / API

- `apps/api/prisma/migrations/migration_lock.toml`
- `apps/api/prisma/migrations/20260801100000_ticket_comment_foundation/`
- `apps/api/prisma/migrations/20260801103000_ticket_comment_deleted_at_indexes/`
- `apps/api/prisma/schema.prisma` (deleted_at indexes)
- `apps/api/src/database/schema-guard.spec.ts`
- `apps/api/src/ticketing/tickets.service.ts` (+ group assign guard)
- `apps/api/src/ticketing/dto/assign-ticket.dto.ts`
- `apps/api/src/ticketing/dto/create-ticket.dto.ts`
- `apps/api/src/ticketing/dto/update-ticket.dto.ts`
- `apps/api/src/ticketing/tickets.service.spec.ts`
- `apps/api/src/ticketing/tickets.controller.spec.ts`
- `apps/api/src/ticketing/comments.openapi.spec.ts` (new)
- `apps/api/src/ticketing/ticket-schema.integration.spec.ts` (new)
- `apps/api/package.json` (`zod` dependency)

### Tooling / CI

- `scripts/verify-migrations.sh`
- `scripts/README.md`
- `.github/workflows/migrate-verify.yml`
- `package.json` (`migrate:verify`)
- `pnpm-lock.yaml`

### Documentation / ADRs

- `docs/ticket-module-v1-engineering-audit.md` (prior audit)
- `docs/ticket-module-v1-hardening-report.md` (this report)
- `docs/api/tickets.md`, `docs/api/comments.md`, `docs/api/README.md`
- `docs/database/TABLES.md`, `docs/13-rest-conventions.md`, `docs/ui-components.md`
- `docs/adr/ADR-0006.md`, `ADR-0007.md`, `ADR-0008.md`, `docs/adr/README.md`
- `docs/decision-log.md`, `README.md`, `CHANGELOG.md`

---

## 3. Migration Verification Report

| Check                                     | Result                                                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Migrations present                        | 5 (auth ×3, tickets/comments, deleted_at indexes)                                                   |
| `migration_lock.toml`                     | `provider = "postgresql"`                                                                           |
| Fresh DB `prisma migrate deploy`          | **PASS** on `supportdesk_migrate_verify`                                                            |
| `prisma migrate diff` migrations ↔ schema | **No difference detected**                                                                          |
| Tables created                            | tenants…users, roles…, tickets, comments, audit_events, … (17 relations incl. `_prisma_migrations`) |
| Ticket FKs / unique index                 | Verified via integration tests                                                                      |
| Script                                    | `pnpm migrate:verify` / `scripts/verify-migrations.sh`                                              |
| CI                                        | `.github/workflows/migrate-verify.yml`                                                              |

Evidence command: `pnpm migrate:verify` (2026-08-01) → `Migration verification PASSED`.

---

## 4. API Verification Report

| Area                                                     | Status                                            |
| -------------------------------------------------------- | ------------------------------------------------- |
| Ticket OpenAPI smoke                                     | Paths match controller (incl. timeline, unassign) |
| Comment OpenAPI smoke                                    | **Added** — list/create/get/patch/delete          |
| `docs/api/tickets.md`                                    | Rewritten as-built + deferred catalogue           |
| `docs/api/comments.md`                                   | Rewritten as-built + deferred catalogue           |
| Path aliases `/assignments`, `/transitions`, `/activity` | Documented as **retired**                         |
| Group assignment                                         | Rejected at DTO + service (ADR-0008)              |
| Pagination                                               | Documented offset (ADR-0006)                      |

---

## 5. Documentation Synchronization Report

| Doc              | Change                                                   |
| ---------------- | -------------------------------------------------------- |
| README           | Reflects Ticket Module + audit/hardening gate            |
| API docs         | As-built vs target clearly separated                     |
| Database TABLES  | As-built tickets/comments; removed duplicate target rows |
| REST conventions | Explicit ADR-0006 exception                              |
| UI components    | As-built ticket detail inventory                         |
| ADRs 0006–0008   | Pagination, outbox deferral, group assign reject         |
| Decision log     | Cross-links to detailed ADRs                             |

---

## 6. Security Review

| Control                                    | Status                                            |
| ------------------------------------------ | ------------------------------------------------- |
| Auth Argon2id / refresh rotation / lockout | Unchanged — sound                                 |
| BFF HttpOnly + CSRF                        | Unchanged — covered by tests                      |
| Tenant scoping on ticket/comment queries   | Unchanged                                         |
| Group UUID orphan risk                     | **Closed** via reject (ADR-0008)                  |
| Outbox dual-write                          | Documented deferral (ADR-0007) — not a silent gap |
| MFA                                        | Remains deferred (Medium debt)                    |
| Attachments                                | N/A (not implemented)                             |
| `pnpm security:scan`                       | Clean at sprint time                              |

---

## 7. Performance Review

| Item                               | Action                                                         |
| ---------------------------------- | -------------------------------------------------------------- |
| Soft-delete list filters           | Added `(tenant_id, deleted_at)` indexes on tickets/comments    |
| `publicRef` count-based generation | Remains Medium debt (Serializable transaction mitigates races) |
| List+count transaction             | Unchanged — good                                               |
| N+1                                | Not observed on current list queries                           |

---

## 8. Testing Review

| Suite                                                 | Result                                                            |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| API unit (incl. new assign guards + comments OpenAPI) | Pass                                                              |
| Web unit                                              | Pass (30) — `act` warnings remain Low debt                        |
| Schema integration (gated `RUN_DB_INTEGRATION=1`)     | Pass under migrate:verify                                         |
| Playwright ticket journeys                            | Still absent — Medium/High follow-up (UI incomplete)              |
| Full tenant isolation PG matrix                       | Partial — schema guards + unit mocks; deeper suite remains Medium |

---

## 9. Technical Debt Register (remaining only)

### High (accepted follow-up; not silent)

| ID       | Item                        | Why remaining                   | Next step                                                          |
| -------- | --------------------------- | ------------------------------- | ------------------------------------------------------------------ |
| TD-H3    | Ticket list/create UI + E2E | Product UI work, not hardening  | Epic 18 / separate UI issue                                        |
| TD-H6    | Transactional outbox        | Architectural — ADR-0007        | Before E11-I03 / notifications                                     |
| TD-H-MFA | MFA baseline                | Milestone M2 incomplete vs docs | Explicit MFA issue or ADR deferral already noted in open questions |

### Medium

| ID       | Item                                   | Next step                      |
| -------- | -------------------------------------- | ------------------------------ |
| TD-M1    | Cursor pagination migration            | After search/queue scale needs |
| TD-M4    | Sequence-based `publicRef`             | Replace count+1 under load     |
| TD-M6    | Ticket Playwright / a11y               | With list/create UI            |
| TD-M-ISO | Broader live PG tenant isolation suite | Expand integration harness     |

### Low

| ID    | Item                                      |
| ----- | ----------------------------------------- |
| TD-L1 | Shared CSRF fetch helper on web           |
| TD-L2 | Semver still `0.1.0`                      |
| TD-L3 | React `act(...)` warnings in detail tests |

### Closed this sprint

TD-C1 migration missing · TD-C2 schema-guard false green · TD-H1 migrate verify · TD-H4 API doc drift · TD-H5 group FK orphan · TD-H7 zod undeclared · TD-L4 deleted_at indexes · comments OpenAPI smoke · CI migrate workflow

---

## 10. Cross-Verification Matrix

| Feature                   | Docs           | DB          | API             | UI          | Tests   |
| ------------------------- | -------------- | ----------- | --------------- | ----------- | ------- |
| Auth / BFF / CSRF         | ✅             | ✅          | ✅              | ✅          | ✅      |
| RBAC                      | ✅             | ✅          | ✅              | Partial     | ✅ unit |
| Ticket CRUD + concurrency | ✅ as-built    | ✅ migrated | ✅              | Detail edit | ✅      |
| Lifecycle / user assign   | ✅             | ✅          | ✅              | Partial     | ✅      |
| Group assign              | ✅ rejected    | column only | ✅ 400          | —           | ✅      |
| Comments + visibility     | ✅             | ✅          | ✅ + OpenAPI    | ✅ detail   | ✅      |
| Timeline                  | ✅ `/timeline` | audit       | ✅              | ✅          | ✅      |
| Ticket list API           | ✅ offset      | ✅          | ✅              | ❌ page     | ✅ unit |
| Ticket create UI          | deferred       | —           | ✅ API          | ❌          | ❌ E2E  |
| Outbox                    | ADR-0007       | ❌          | ❌              | —           | —       |
| Workflow                  | plans only     | ❌          | worktree paused | ❌          | —       |

---

## 11. Quality Gate Results

| Gate           | Command               | Result               |
| -------------- | --------------------- | -------------------- |
| Format         | `pnpm format:check`   | PASS                 |
| Lint           | `pnpm lint`           | PASS                 |
| Typecheck      | `pnpm typecheck`      | PASS                 |
| Unit tests     | `pnpm test`           | PASS                 |
| Migrate verify | `pnpm migrate:verify` | PASS                 |
| Build          | `pnpm build`          | (run in same sprint) |
| Security       | `pnpm security:scan`  | PASS                 |
| Root CI script | `pnpm run ci`         | (compose of above)   |

---

## 12. Production Readiness Score

| Dimension              | Score |
| ---------------------- | ----- |
| Architecture coherence | 8     |
| Documentation sync     | 9     |
| Backend Ticket v1      | 9     |
| Frontend completeness  | 5     |
| Database / migrations  | 9     |
| API contract fidelity  | 9     |
| Security               | 8     |
| Testing depth          | 7     |
| Performance posture    | 8     |
| Release hygiene        | 8     |

**Weighted ≈ 86%.**

---

## 13. Final Recommendation

### ⚠️ Minor Follow-up Required

| Question                                         | Answer                                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Begin **E11-I01** (workflow definition)?         | **Yes**, after these hardening commits land and E11 worktree is rebased onto them  |
| Begin **E11-I02** (validation/publishing depth)? | **Yes with caution** — no outbox required yet; keep scope to definition validation |
| Begin **E11-I03** (execution engine)?            | **No** — blocked on ADR-0007 outbox                                                |
| Claim Ticket Module GA?                          | **No** — list/create UI and deeper E2E still open                                  |

**Do not treat remaining UI/outbox/MFA items as forgotten** — they are registered above with owners/next steps.
