# Architecture decision records

This folder contains detailed ADRs for implementation-driving architecture decisions. [../decision-log.md](../decision-log.md) remains the summary register and open-question tracker.

The original decision log uses `ADR-001` style IDs from the first documentation foundation. This folder uses `ADR-0001` style file names for detailed records requested in the final architecture task. The two registers are intentionally cross-referenced rather than silently renumbered.

## Records

| ADR                     | Decision                                                    |
| ----------------------- | ----------------------------------------------------------- |
| [ADR-0001](ADR-0001.md) | Multi-tenancy approach                                      |
| [ADR-0002](ADR-0002.md) | Authentication strategy                                     |
| [ADR-0003](ADR-0003.md) | Database strategy                                           |
| [ADR-0004](ADR-0004.md) | M2 RBAC foundation                                          |
| [ADR-0005](ADR-0005.md) | Browser authentication transport                            |
| [ADR-0006](ADR-0006.md) | Ticket Module v1 offset pagination                          |
| [ADR-0007](ADR-0007.md) | Defer transactional outbox until automation consumers exist |
| [ADR-0008](ADR-0008.md) | Reject group assignment until Organizations/Groups exist    |
| [ADR-0009](ADR-0009.md) | MVP SLA calendar and timer semantics (OQ-08)                |

## Status values

- Accepted: binding for implementation.
- Accepted assumption: usable for planning but must be validated by the listed milestone.
- Proposed: not binding.
- Superseded: replaced by a later ADR.

New durable decisions require context, decision, alternatives, consequences, security/tenant impact, operational impact, and links to affected docs.
