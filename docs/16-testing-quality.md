# Testing and quality strategy

## Test suites

| ID         | Scope                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| T-DOM      | Unit/property tests for invariants, lifecycle, concurrency, idempotency, and validation.                            |
| T-ISO      | Generated cross-Tenant negative tests across HTTP, data, cache, search, files, jobs, exports, and operator tooling. |
| T-AUTH     | Permission matrix across Roles, scopes, membership states, and sensitive actions.                                   |
| T-WF       | Workflow versioning, ordering, cycles, bounds, replay, failure, and audit evidence.                                 |
| T-SLA      | Reference calendar, DST, pause, breach, reopen, and recalculation fixtures.                                         |
| T-NOTIFY   | Template safety, visibility, preferences, deduplication, webhooks, retry, and outage recovery.                      |
| T-SEARCH   | Authorization, Tenant filtering, stale/deleted projection, ranking contract, and freshness.                         |
| T-AUDIT    | Completeness, immutability, access, safe content, export, and clock behavior.                                       |
| T-E2E      | Critical journeys across supported browsers with dependency stubs and selected real sandboxes.                      |
| T-A11Y     | Automated plus manual keyboard, zoom, contrast, screen-reader, timeout, and error tests.                            |
| T-SEC      | SAST/DAST, secrets, dependency/license, fuzz, abuse/rate, threat-model cases, and penetration findings.             |
| T-PERF     | Load, soak, spike, Tenant skew, queue backpressure, and capacity regression.                                        |
| T-MIG      | Forward/backward compatibility, resume, backfill, integrity, scale, and restore.                                    |
| T-ROLLBACK | Previous-version compatibility and release rollback/roll-forward rehearsal.                                         |
| T-DR       | Backup integrity, regional/dependency recovery, RPO/RTO, and communications exercise.                               |

## Environments and data

Tests create isolated synthetic Tenants; no production Personal data enters CI or lower environments. Clocks, identifiers, providers, and failure injection are controllable. Contract tests pin vendor assumptions. Flaky tests are defects: quarantine requires owner, issue, expiry, and non-critical compensating coverage.

## Release gates

Every pull request runs fast static, unit, integration, T-ISO, T-AUTH, migration, and supply-chain gates. Main runs full contract/E2E/accessibility/security suites. Release candidates add performance, rollback, restore, and smoke validation. Failed required gates block promotion; exceptions follow AGENTS.md.

Implementation work should be planned from [github-project-plan.md](github-project-plan.md) so each issue carries explicit test-suite ownership.
