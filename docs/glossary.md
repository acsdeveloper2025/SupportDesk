# Glossary

These terms are normative. Singular capitalized forms identify domain concepts.

| Term                           | Definition                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Agent                          | A User who works Tickets on behalf of a Tenant; not an automated software agent.                                                           |
| Audit Event                    | Immutable, append-only evidence of a security- or business-significant action, including actor, Tenant, time, action, target, and outcome. |
| Business Schedule              | Tenant-configured time zone, working hours, holidays, and exceptions used for SLA clocks.                                                  |
| Channel                        | A source or destination for communication, initially web or email.                                                                         |
| Comment                        | A Ticket message that is either public to the Requester or internal to Agents.                                                             |
| Entitlement                    | A feature or quota granted by a Tenant's subscription plan.                                                                                |
| Group                          | A Tenant-scoped collection of Agents used for assignment and authorization.                                                                |
| Organization                   | An optional Tenant-scoped grouping of Requesters; it is never synonymous with Tenant.                                                      |
| Requester                      | A User seeking support and associated with a Ticket.                                                                                       |
| Role                           | A Tenant-scoped named set of Permissions.                                                                                                  |
| Permission                     | A stable action on a resource, evaluated with Tenant and resource scope.                                                                   |
| SLA                            | Service-level agreement represented by measurable response or resolution Targets.                                                          |
| SLA Policy                     | Ordered Tenant rules selecting Targets for a Ticket.                                                                                       |
| Target                         | A timed SLA commitment with due time, pause behavior, and breach state.                                                                    |
| Tenant                         | The primary customer isolation, ownership, configuration, and billing boundary.                                                            |
| Tenant context                 | Authenticated Tenant identifier propagated and enforced through every execution and storage boundary.                                      |
| Ticket                         | The canonical Tenant-scoped support work item and aggregate root.                                                                          |
| Ticket status                  | One of `new`, `open`, `pending`, `on_hold`, `solved`, or `closed`.                                                                         |
| User                           | A human identity; access to one or more Tenants is expressed by Tenant Memberships.                                                        |
| Tenant Membership              | The relationship binding a User to one Tenant, status, Roles, and optional Groups.                                                         |
| Workflow                       | A versioned set of conditions and actions responding to a domain event.                                                                    |
| Domain Event                   | An immutable fact emitted after a successful domain state change.                                                                          |
| Export Job                     | An asynchronous Tenant-scoped operation that prepares a downloadable report or data extract.                                               |
| Legal Hold                     | A preservation rule that suspends ordinary deletion or retention expiry for specified data.                                                |
| Notification Intent            | A provider-neutral request to notify one recipient through one channel and template.                                                       |
| Notification                   | A tenant-scoped in-app inbox item for one recipient, created from a domain event and subject to preferences.                               |
| Operator Elevation             | A time-bound, audited grant allowing a Platform Operator to access a Tenant-scoped operational or content path.                            |
| Queue                          | A saved or computed Ticket list used for triage, assignment, and work prioritization.                                                      |
| View                           | A user- or Tenant-configured presentation of filtered and sorted resources.                                                                |
| Personal data                  | Information relating to an identified or identifiable natural person.                                                                      |
| Recovery point objective (RPO) | Maximum acceptable data-loss window.                                                                                                       |
| Recovery time objective (RTO)  | Maximum acceptable restoration time.                                                                                                       |
