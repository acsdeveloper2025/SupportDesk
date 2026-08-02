# Release plan

This release plan maps [milestones.md](milestones.md) and [sprint-plan.md](sprint-plan.md) into controlled delivery phases. It is planning only.

## Engineering baseline tags

| Tag                  | Purpose                                            | Notes                                                                                        |
| -------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `v1.0-ticket-module` | Freeze Auth + Ticket Module before Workflow Engine | See [ready-for-workflow-engine.md](ready-for-workflow-engine.md). Not a GA customer release. |
| `v1.0.0-rc1`         | Release Candidate 1 Hardening & Verification Tag   | Full RC1 hardening sprint, performance benchmarks, and DR restore verification complete.     |
| `v1.0.0`             | Production Release Tag                             | Enterprise v1.0.0 GA release approved. All quality gates green.                              |

## Release phases

| Phase               | Milestones | Audience                    | Goal                                                               | Promotion gate                                            |
| ------------------- | ---------- | --------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------- |
| Internal foundation | M1-M2      | Engineering/security        | Prove architecture, auth, sessions, and tests.                     | Architecture and security review.                         |
| Internal alpha      | M3-M5      | Internal support users      | Prove organizations, RBAC, tickets, comments, core UI.             | J-01 and tenant isolation pass.                           |
| Private beta        | M6-M8      | Selected tenants            | Prove attachments, notifications, email, SLA, workflow.            | Provider failure drills and automation tests pass.        |
| Enterprise beta     | M9         | Selected enterprise tenants | Prove search, reports, exports, dashboards, audit.                 | Performance, export, audit, and accessibility gates pass. |
| Release candidate   | M10        | Production-like tenants     | Prove operations, recovery, security, and support readiness.       | Full release checklist passes.                            |
| GA                  | M10        | All approved tenants        | Launch with support, monitoring, rollback, and incident readiness. | Go/no-go approval.                                        |

## Release gates

Each release must satisfy:

- No unresolved critical/high security finding.
- Tenant isolation negative tests pass.
- Authorization matrix tests pass.
- Audit completeness tests pass.
- Migration and rollback plan validated.
- Performance smoke passes for scoped release audience.
- Accessibility critical journeys pass.
- Observability dashboards and alerts exist.
- Runbooks are linked and tested.
- Documentation is current.

## Rollout strategy

1. Deploy to internal environment.
2. Run smoke, contract, security, and tenant-isolation checks.
3. Promote immutable artifact to staging.
4. Run E2E, accessibility, provider sandbox, and migration tests.
5. Canary to one internal tenant.
6. Expand to selected tenants by low-risk cohort.
7. Monitor SLOs, queue age, audit writes, auth failures, notification failures, and support signals.
8. Pause, rollback, or roll forward on release-trigger breach.

## Rollback triggers

- Authentication or authorization anomaly.
- Suspected tenant data leakage.
- Audit event write failure.
- Migration integrity failure.
- Error-budget burn above policy.
- Queue age exceeds documented threshold.
- Notification provider failure without bounded backlog.
- Critical accessibility blocker on a release-critical path.

## Release evidence package

For every production release capture:

- Commit/artifact identity.
- Schema/config version.
- Feature flag state.
- Migration/backfill status.
- Test summary.
- Security/dependency scan summary.
- Accessibility summary.
- Dashboard and alert links.
- Known risks and accepted exceptions.
- Rollback/roll-forward decision.
- Approvers and timestamps.

## GA readiness checklist

- 30-day SLO trial passes.
- Capacity headroom is at least 2x approved forecast.
- DR exercise passes approved RPO/RTO.
- Penetration-test findings resolved or formally accepted.
- Compliance evidence package reviewed.
- Support/on-call/vendor escalation process staffed.
- Customer communication plan approved.
- No critical/high risk remains unapproved.
