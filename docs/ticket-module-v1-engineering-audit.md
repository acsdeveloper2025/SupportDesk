# SupportDesk v1.0 Engineering Audit & Cross-Verification (Pre-Workflow Gate)

**Audit date:** 2026-08-01  
**Scope:** Project inception through Ticket Module (`#16`–`#28` / E05–E06 slice)  
**Auditor posture:** Principal Engineer / Enterprise Architect / Security Architect / DBA / QA Lead / Release Manager  
**Constraint:** No Workflow Engine implementation; no new business features

---

## 1. Executive Summary

The Ticket Module API and detail UI are substantially implemented and unit-tested. Authentication, RBAC, audit, and BFF session transport are strong foundations. However, the repository was **not production-ready for a fresh PostgreSQL deploy** at audit start: ticket/comment models existed in Prisma without migrations, `migration_lock.toml` was missing, and the schema-guard test incorrectly allowed this drift to pass CI.

**Safe fixes applied during this audit**

| Fix                                                                                          | Severity addressed     |
| -------------------------------------------------------------------------------------------- | ---------------------- |
| Added `20260801100000_ticket_comment_foundation` migration                                   | Critical               |
| Added `prisma/migrations/migration_lock.toml`                                                | Critical               |
| Corrected `schema-guard.spec.ts` to assert tickets/comments exist and deferred tables do not | Critical (false green) |
| Declared `zod` as an explicit `@supportdesk/api` dependency                                  | High                   |

**Verdict:** ⚠️ **Minor fixes required** before approving the Workflow Engine gate.

**Readiness score:** **68 / 100**

Do **not** begin E11-I02 or workflow execution work until the Remaining High items in §12–§15 are accepted or closed. An existing local worktree already contains E11-I01 implementation activity; treat that as **paused pending this gate**.

---

## 2. Architecture Review

### Strengths

- Clear modular monolith layout: `apps/api` (NestJS), `apps/web` (Next.js), shared packages.
- Auth → RBAC → Audit → Ticketing dependency direction is mostly respected.
- Ticket domain aggregate (`TicketAggregate`) encodes status machine, assignment guards, and optimistic concurrency.
- Browser auth follows ADR-0005 (BFF + HttpOnly cookies + CSRF).

### Concerns

| Finding                                                                                                                                                   | Impact                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Milestone order skipped **M3 Organizations** while shipping tickets with `assignedGroupId` and no `organizations`/`groups` tables                         | Orphaned group IDs; incomplete RBAC scopes                      |
| Documented **transactional outbox** still absent                                                                                                          | Side-effect/event reliability for future workflow/notifications |
| Target architecture docs describe cursor pagination; ticket list uses **offset** `page`/`pageSize`                                                        | Contract drift                                                  |
| `docs/api/tickets.md` still describes aspirational paths (`/assignments`, `/transitions`, `/activity`) vs implemented (`/assign`, `/status`, `/timeline`) | OpenAPI/docs mismatch                                           |
| Implementation order places Attachments → Notifications → SLA **before** Workflow; starting Workflow now is a sequencing exception                        | Platform risk                                                   |

### Dependency graph (implemented)

```
config/types/utils/ui
        ↓
   apps/api: identity → auth → rbac → audit → ticketing
        ↑
   apps/web: auth BFF + ticket detail BFF
```

No circular package deps observed. `.worktrees/e11-i01-workflow-definition` is a parallel branch (ahead of `feat/issue-26-sla-engine`) and must not merge until this gate is approved.

---

## 3. Documentation Audit

| Document set                              | Status                           | Notes                                                                  |
| ----------------------------------------- | -------------------------------- | ---------------------------------------------------------------------- |
| README.md                                 | **Outdated**                     | Still claims ticketing “intentionally excluded”; updated in this audit |
| CHANGELOG.md                              | Current for ticket work          | Claims #28 production readiness; migration gap contradicted that       |
| AGENTS.md / CONTRIBUTING.md               | OK                               | Governance clear                                                       |
| docs/00–20 foundation                     | Largely aspirational             | Target-state, not “as-built”                                           |
| docs/api/*                                | **Drift**                        | Target contracts ≠ implemented Nest routes                             |
| docs/database/*                           | Partial                          | Catalogue includes future tables; schema implements subset             |
| Pre-ticket gate / auth quality gate       | Historical OK                    | Pre-date ticket module                                                 |
| E11 design/plan under `docs/superpowers/` | Present                          | Planning for Workflow — do not execute until gate pass                 |
| Production checklist for Ticket Module    | **Missing** prior to this report | This document fills the gap                                            |

Cross-reference issues: API README states “intended resource surface only”; that disclaimer is easy to miss. Ticket UI components are not yet reflected in `docs/ui-components.md`.

---

## 4. Backend Audit

### Implemented modules

- Auth: registration, verification, login/logout, refresh rotation, password reset/change, rate limits, lockout
- Identity lookup, RBAC evaluator, audit event builder
- Ticketing: create/read/update, status transition, assign/unassign, list/count, timeline
- Comments: create/list/get/update/delete with visibility filtering

### Quality notes

- Controllers enforce bearer auth + RBAC permission keys.
- Optimistic concurrency via `version` with HTTP 409 path.
- `TicketsRepository.create` uses Serializable transaction for `publicRef` generation (still count-based — see Performance).
- Comments correctly hide `INTERNAL` from requesters lacking permission.
- Controllers/services are large but cohesive; no TODO/FIXME markers found in source.

### Gaps

- No MFA (M2 exit criteria incomplete relative to milestones.md).
- No idempotency-key infrastructure (E17-I02).
- No assignment history table (docs catalogue).
- Group assignment accepted without group entity FK.
- Repository tests are mocked — not live PostgreSQL.

---

## 5. Frontend Audit

### Present

- Auth pages + BFF routes with CSRF coverage
- Ticket **detail** page: load states, edit, comments, timeline, conflict banner
- Component tests for badges, comment form, detail page

### Missing relative to M5 / Ticket Module claim

- Ticket **list/queue** page
- Ticket **create** page/flow
- Permission-driven UI (hide actions by capability) beyond HTTP 403 handling
- Ticket E2E / accessibility journeys (Playwright only covers auth/bootstrap)
- React `act(...)` warnings in detail page tests

---

## 6. Database Audit

### Schema (as-built)

Implemented: tenants, settings, domains, users, profiles, preferences, roles, permissions, user_roles, role_permissions, sessions, refresh_tokens, auth_tokens, audit_events, **tickets**, **comments**.

Not implemented (documented target): organizations, groups, attachments, SLA, workflows, notifications, outbox, idempotency_keys, etc.

### Critical findings (audit start → remediated)

1. **No migration** for tickets/comments despite schema models — **fixed** via `20260801100000_ticket_comment_foundation`.
2. **Missing `migration_lock.toml`** — **fixed**.
3. Schema-guard used `not.toEqual(expect.arrayContaining([...]))`, which does **not** assert absence of individual tables — **fixed**.

### Residual DB risks

- Fresh migrate against live PostgreSQL **not re-verified in this environment** (Postgres/Docker unavailable during audit).
- `assigned_group_id` has no FK (no groups table).
- Soft-delete columns exist; list indexes do not include `deleted_at`.
- Agent/group queue composite indexes from INDEXING.md not yet present (acceptable for current scale; track before queue UI).

---

## 7. API Audit

### Implemented Nest endpoints (tickets)

| Method    | Path                                                          |
| --------- | ------------------------------------------------------------- |
| POST      | `/api/v1/tickets`                                             |
| GET       | `/api/v1/tickets`, `/api/v1/tickets/count`                    |
| GET/PATCH | `/api/v1/tickets/:id`, `/api/v1/tickets/reference/:publicRef` |
| POST      | `.../status`, `.../assign`, `.../unassign`                    |
| GET       | `/api/v1/tickets/:id/timeline`                                |

### Comments

| Method           | Path                                 |
| ---------------- | ------------------------------------ |
| POST/GET         | `/api/v1/tickets/:ticketId/comments` |
| GET/PATCH/DELETE | `/api/v1/comments/:commentId`        |

### Findings

- Ticket OpenAPI smoke inventory exists; **comments lack OpenAPI inventory smoke**.
- Swagger version still `0.1.0`.
- Docs vs code path naming mismatch (see §3).
- Pagination: offset (`page`/`pageSize`) vs documented cursor.
- Error envelope: Nest exceptions; align with `docs/errors.md` codes is partial.
- Web BFF proxies ticket mutations with CSRF — good.

---

## 8. Security Audit

### Strong

- Argon2id passwords, refresh rotation + family revoke on reuse
- HttpOnly/SameSite cookies; CSRF on cookie mutations
- Tenant scoping on ticket/comment queries
- Audit secret redaction
- Rate limits on auth and ticket create
- `pnpm audit --audit-level high`: clean at audit time
- Helmet on API

### Gaps / watch items

- MFA deferred
- `x-session-id` debug transport debt (pre-ticket gate)
- Attachment surface not present (no upload attack surface yet — good for now)
- No dedicated tenant-isolation **integration** suite against real DB
- XSS: React escaping relied upon; comment body not Markdown-sanitized (plain text assumed)
- Authorization matrix tests exist for RBAC service, not full HTTP matrix for every ticket permission combination

OWASP ASVS alignment for current scope: authentication controls largely L2-oriented for implemented features; file upload / business workflow ASVS controls N/A until those modules ship.

---

## 9. Testing Audit

| Layer                | Count / status                  | Gap                           |
| -------------------- | ------------------------------- | ----------------------------- |
| API unit             | 164 passed                      | Mocked Prisma                 |
| Web unit             | 30 passed                       | `act` warnings                |
| Utils                | 2 passed                        | —                             |
| Playwright           | auth/bootstrap only             | No ticket journey             |
| Schema guard         | Fixed this audit                | Was false green               |
| Auth coverage script | Exists                          | Ticket coverage script absent |
| PG integration       | Effectively missing for tickets | High debt                     |
| Concurrency          | Domain unit tests               | No multi-client PG race test  |
| A11y                 | Not automated for tickets       | High for M5 exit              |

Root gates verified this audit: **lint ✅, typecheck ✅, unit tests ✅, build ✅, security scan ✅**. Fresh `prisma migrate deploy` against PostgreSQL: **not verified** (DB down).

---

## 10. Performance Audit

| Area         | Observation                                       | Recommendation                                                               |
| ------------ | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `publicRef`  | `count + 1001` under Serializable                 | Prefer sequence/advisory lock or tenant counter table                        |
| List + count | Combined in `$transaction`                        | Good; add covering indexes before large tenants                              |
| Timeline     | Audit query by target                             | Ensure `(tenant_id, target_type, target_id, occurred_at)` index before scale |
| Search       | Not implemented                                   | Out of scope                                                                 |
| N+1          | Not observed in ticket list (no relations loaded) | Watch when joining requester/assignee profiles                               |

---

## 11. Code Quality Report

- Naming generally consistent with domain glossary for Ticket/Comment.
- Duplicate BFF CSRF helper patterns across web route files — candidate shared util (Low).
- Large controllers acceptable for now; split if Workflow adds more surface.
- Zod was undeclared (fixed). Prefer keeping API validation deps explicit.
- Dead code: schema-guard’s old “no business tables” intent was stale, not unused files.
- Over-engineering: limited; domain aggregate is justified.

---

## 12. Technical Debt Register

### Critical

| ID    | Description                                                            | Impact                       | Recommendation                                         | Effort                  |
| ----- | ---------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------ | ----------------------- |
| TD-C1 | Ticket/comment schema without migration _(remediated in working tree)_ | Fresh DB cannot run tickets  | Keep migration in next commit; verify `migrate deploy` | S — done pending commit |
| TD-C2 | Schema-guard false green _(remediated)_                                | CI cannot catch schema drift | Keep per-table `not.toContain` assertions              | S — done                |

### High

| ID    | Description                                                    | Impact                         | Recommendation                                       | Effort   |
| ----- | -------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------- | -------- |
| TD-H1 | No live PostgreSQL migrate verification in CI/local this audit | Deploy risk                    | Add migrate job + smoke against Postgres service     | M        |
| TD-H2 | No ticket PG integration / tenant-isolation DB tests           | Isolation regressions possible | Add testcontainers or CI Postgres suite              | L        |
| TD-H3 | Ticket list/create UI missing                                  | M5 journey incomplete          | Ship queue + create pages + E2E                      | L        |
| TD-H4 | API docs vs implemented contracts                              | Wrong client integrations      | Publish as-built OpenAPI appendix or update docs/api | M        |
| TD-H5 | `assignedGroupId` without groups/orgs                          | Invalid references             | Block group assign until Epic 3/groups, or add FK    | M        |
| TD-H6 | Outbox missing vs E05-I02 acceptance                           | Future automation unreliable   | Add outbox before Workflow execution (E11-I03)       | L        |
| TD-H7 | Zod was transitive-only _(remediated)_                         | Fragile installs               | Keep explicit dep                                    | S — done |
| TD-H8 | Premature E11 worktree activity                                | Scope/process risk             | Pause merge until gate approval                      | S        |

### Medium

| ID    | Description                    | Impact                      | Recommendation                              | Effort |
| ----- | ------------------------------ | --------------------------- | ------------------------------------------- | ------ |
| TD-M1 | Offset vs cursor pagination    | Spec violation              | Document exception ADR or migrate to cursor | M      |
| TD-M2 | Comments OpenAPI smoke missing | Drift risk                  | Mirror tickets.openapi.spec                 | S      |
| TD-M3 | MFA not implemented            | M2 incomplete vs milestones | Explicit deferral ADR or implement          | L      |
| TD-M4 | Count-based `publicRef`        | Contention/gaps             | Tenant sequence                             | M      |
| TD-M5 | README/status docs lag         | Onboarding confusion        | Keep README as-built _(updated)_            | S      |
| TD-M6 | No ticket Playwright/a11y      | Quality gate gap            | Add critical journey                        | M      |

### Low

| ID    | Description                          | Impact          | Recommendation            | Effort |
| ----- | ------------------------------------ | --------------- | ------------------------- | ------ |
| TD-L1 | Shared CSRF fetch helper duplication | Maintainability | Extract util              | S      |
| TD-L2 | Package version `0.1.0`              | Semver clarity  | Tag when releasing module | S      |
| TD-L3 | React act warnings in tests          | Noise           | Stabilize async tests     | S      |
| TD-L4 | Soft-delete not in ticket indexes    | Minor scan cost | Add when lists grow       | S      |

---

## 13. Documentation Updates (this audit)

1. This report: `docs/ticket-module-v1-engineering-audit.md`
2. README status/scope updated to reflect Ticket Module as-built
3. CHANGELOG entry for audit remediation
4. Schema guard + migration + zod dependency (code/docs alignment)

---

## 14. Production Readiness Report

| Gate                                              | Status                                                    |
| ------------------------------------------------- | --------------------------------------------------------- |
| Auth security baseline                            | Pass                                                      |
| RBAC deny-by-default                              | Pass (unit)                                               |
| Ticket API functional unit coverage               | Pass                                                      |
| Ticket detail UI                                  | Pass (partial journey)                                    |
| Fresh DB migrate                                  | **Fail at audit start → remediated; live verify pending** |
| Integration/isolation on Postgres                 | Fail / missing                                            |
| E2E ticket journey                                | Fail / missing                                            |
| Docs as-built sync                                | Partial                                                   |
| Observability/runbooks for tickets                | Incomplete vs docs/17–19                                  |
| Secrets/scan                                      | Pass                                                      |
| Workflow prerequisites (notifications/SLA/outbox) | Not met for E11-I03                                       |

**Production (GA) ready:** No.  
**Internal alpha for ticket API:** Conditionally yes after migrate verify + known UI gaps accepted.

---

## 15. Release Readiness Checklist (Pre-Workflow Gate)

- [x] Lint / typecheck / unit / build / high-severity audit pass
- [x] Ticket/comment migration present + lockfile
- [x] Schema guard asserts current boundary
- [ ] `prisma migrate deploy` verified on clean Postgres
- [ ] CI job runs migrations against service container
- [ ] Ticket tenant-isolation integration tests
- [ ] As-built API doc sync (or ADR accepting offset pagination + path names)
- [ ] Decision on Organizations/groups vs `assignedGroupId`
- [ ] Pause/approve existing E11-I01 worktree
- [ ] Explicit go/no-go for Workflow sequencing exception (skipping attachments/notifications/SLA)
- [ ] Ticket list/create UI or documented deferral
- [ ] No unresolved Critical debt in main

---

## 16. Cross-Verification Matrix

| Feature                   | Docs                 | DB              | API            | Frontend         | Tests         |
| ------------------------- | -------------------- | --------------- | -------------- | ---------------- | ------------- |
| Auth session/JWT/BFF      | ✅                   | ✅              | ✅             | ✅               | ✅            |
| RBAC permissions          | ✅                   | ✅              | ✅             | Partial UI       | ✅ unit       |
| Audit events              | ✅                   | ✅              | ✅ emit        | Timeline read    | ✅ unit       |
| Ticket CRUD + concurrency | Partial (path drift) | ✅ (+migration) | ✅             | Detail edit only | ✅ unit       |
| Status lifecycle          | ✅ matrix            | ✅ enum         | ✅             | Badges only      | ✅ unit       |
| Assignment                | Partial              | ⚠️ no groups FK | ✅             | Display only     | ✅ unit       |
| Comments + visibility     | ✅                   | ✅              | ✅             | ✅ detail        | ✅ unit       |
| Timeline                  | Docs say `/activity` | via audit       | ✅ `/timeline` | ✅               | ✅ unit       |
| Ticket list API           | Cursor docs ≠ offset | indexes partial | ✅             | ❌ no page       | ✅ unit       |
| Ticket create UI          | Planned              | —               | ✅ API         | ❌               | ❌ E2E        |
| Organizations             | Docs M3              | ❌              | ❌             | ❌               | ❌            |
| Attachments               | Docs                 | ❌              | ❌             | ❌               | ❌            |
| Notifications             | Docs                 | ❌              | ❌             | ❌               | ❌            |
| SLA                       | Docs                 | ❌              | ❌             | ❌               | ❌            |
| Workflow                  | Specs/plans          | ❌ main         | ❌ main        | ❌               | worktree only |
| Outbox                    | Docs required        | ❌              | ❌             | —                | ❌            |
| Idempotency keys          | Docs                 | ❌              | ❌             | —                | ❌            |
| Search/Reports            | Docs                 | ❌              | ❌             | ❌               | ❌            |

Legend: ✅ aligned · ⚠️ partial · ❌ missing

---

## 17. Remaining Risks

1. Unverified migrate on real Postgres after remediation.
2. Workflow started out-of-order relative to implementation-order.md.
3. Group assignment integrity without groups module.
4. Documentation clients may implement wrong URLs/pagination.
5. Isolation bugs escaping mocked unit tests.
6. Uncommitted audit fixes must land before any Workflow PR.

---

## 18. Readiness Score

| Dimension                              | Score (0–10)     | Weight |
| -------------------------------------- | ---------------- | ------ |
| Architecture coherence                 | 7                | 1.0    |
| Documentation sync                     | 5                | 1.0    |
| Backend completeness (Ticket v1 claim) | 8                | 1.2    |
| Frontend completeness                  | 5                | 1.0    |
| Database/migrations                    | 6 → 8 after fix* | 1.5    |
| API contract fidelity                  | 6                | 1.0    |
| Security                               | 8                | 1.2    |
| Testing depth                          | 6                | 1.2    |
| Performance posture                    | 7                | 0.6    |
| Process/release hygiene                | 5                | 0.8    |

\*Database dimension assumes migration commit lands and live migrate is verified soon.

**Weighted ≈ 68%.**

---

## 19. Recommendation

### ⚠️ Minor fixes required

**Not** ❌ blocked on fundamental architecture, and **not** ✅ ready to start the Workflow Engine unchecked.

**Required before Workflow Engine approval**

1. Commit audit remediations (migration, lock, schema-guard, zod, docs).
2. Verify clean Postgres `migrate deploy`.
3. Record sequencing decision: either defer E11 until notifications/SLA/outbox baselines, or accept an ADR for E11-I01-only exception.
4. Resolve or explicitly defer TD-H3/H4/H5.

**Do not begin E11-I02 or any workflow execution work until this gate is approved.**
