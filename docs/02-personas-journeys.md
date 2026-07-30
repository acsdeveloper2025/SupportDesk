# Personas and journeys

## Personas

- **Requester:** wants simple submission, transparent updates, and privacy.
- **Agent:** needs a prioritized queue, complete context, safe collaboration, and fast keyboard operation.
- **Tenant Administrator:** configures access and policy while controlling risk.
- **Auditor:** reviews immutable evidence without modifying operations.
- **Platform Operator:** maintains availability through least-privilege tooling.

## Critical journeys and acceptance

### J-01 Submit and resolve

Given an authenticated Requester with active Tenant Membership, when they submit valid subject and description, then one Ticket is created in that Tenant, an Audit Event and Domain Event are recorded, an acknowledgement is queued, and the Requester can view it. Agents can assign, comment, transition, solve, and close it according to [workflow rules](09-ticket-lifecycle.md).

### J-02 Triage under SLA

Given a new eligible Ticket, when SLA selection runs, then exactly one applicable SLA Policy version supplies deterministic Targets; the Agent sees due time and breach risk in the Tenant's display time zone.

### J-03 Administer safely

Given a Tenant Administrator, when a Role or Workflow draft is changed, then active behavior is unchanged until validated and published; publication is audited and does not alter historical evaluations.

### J-04 Recover operations

Given a dependency outage, when it recovers, then idempotent queued work resumes without duplicate external effects, operators can quantify backlog, and documented recovery objectives are met.
