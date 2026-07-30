# GitHub issue templates

This document defines issue templates for creating GitHub issues from [github-backlog.md](github-backlog.md). It is documentation only and does not create `.github` files.

## Feature issue template

```markdown
## Title

<Epic ID> - <Issue title>

## Description

Describe the implementation scope, non-goals, and user/system behavior.

## Business Goal

Explain the customer, operator, compliance, or engineering outcome.

## Acceptance Criteria

- Given/When/Then criteria.
- API/database/UI/security behavior is explicit.
- Failure and permission cases are covered.

## Dependencies

- Blocking issue IDs.
- Open questions or ADRs.
- Required decisions.

## Technical Notes

- Architecture references.
- Bounded context ownership.
- Tenant isolation notes.
- Error, audit, notification, and API behavior.

## Files Expected

- Expected future implementation areas.
- Expected docs to update.
- No implementation files are created by this planning issue itself.

## Tests Required

- Unit/domain tests.
- Integration/API tests.
- Tenant isolation tests.
- Authorization matrix tests.
- E2E/accessibility/security/performance tests where relevant.

## Documentation Updates

- List docs that must be updated if behavior changes.

## Estimated Complexity

S / M / L / XL

## Priority

critical / high / medium / low

## Definition of Done

- Acceptance criteria pass.
- Tests pass.
- Security/tenant/audit behavior verified.
- Docs updated.
- Observability/runbook impact handled.
- Review approvals complete.
```

## Bug issue template

```markdown
## Title

<Bug title>

## Description

What is wrong, where it occurs, and observed behavior.

## Business Goal

Explain customer or operational impact of fixing it.

## Acceptance Criteria

- Reproduction is documented.
- Root cause is identified.
- Fix covers regression path.
- No tenant/security/audit regression.

## Dependencies

Related issues, incidents, or blocked decisions.

## Technical Notes

Suspected modules, logs, correlation IDs, and safety concerns.

## Files Expected

Expected future touched areas.

## Tests Required

Regression test plus affected suite.

## Documentation Updates

Update docs if behavior or operational response changes.

## Estimated Complexity

S / M / L / XL

## Priority

critical / high / medium / low

## Definition of Done

Bug is fixed, regression test passes, and affected docs/runbooks are current.
```

## Architecture decision issue template

```markdown
## Title

Resolve <OQ/ADR topic>

## Description

Decision needed, context, options, and deadline.

## Business Goal

Avoid implementation rework and unblock dependent milestones.

## Acceptance Criteria

- Options evaluated.
- Security, tenant, cost, scalability, and operations impact documented.
- Decision owner approves.
- ADR or decision-log update merged.

## Dependencies

Affected epics, issues, and milestones.

## Technical Notes

Architecture and vendor constraints.

## Files Expected

Decision log, ADR, affected docs.

## Tests Required

Documentation consistency review; future test implications noted.

## Documentation Updates

Decision log, ADR, requirements, API/database/security docs as needed.

## Estimated Complexity

S / M / L / XL

## Priority

critical / high / medium / low

## Definition of Done

Decision is accepted, linked, and downstream issues are unblocked.
```

## Label usage

- Use area labels (`backend`, `frontend`, `api`, `database`, `security`, `documentation`, `testing`, `performance`) for ownership.
- Use type labels (`bug`, `enhancement`, `feature`, `technical-debt`) for work classification.
- Use priority labels (`high-priority`, `medium-priority`, `low-priority`) for sequencing.
- Use `blocked` when dependencies or open questions prevent work.
- Use `good-first-issue` only for isolated documentation/test tasks with no tenant/security risk.
