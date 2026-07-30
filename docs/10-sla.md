# SLA behavior

An SLA Policy is an ordered, versioned set of conditions and Targets. The first matching published policy wins; ties are impossible because priority is unique within a Tenant. Evaluation evidence stores policy version, inputs, Business Schedule version, and computed deadlines.

## Clock rules

- Times are stored as instants in UTC and displayed in the configured time zone. Business Schedule arithmetic handles DST using the schedule time-zone database version.
- A response Target starts at Ticket creation and completes on the first qualifying public Agent response.
- A resolution Target starts at creation and completes when first solved; reopening within policy may restart, resume, or retain completion only as explicitly configured.
- `pending` pauses only Targets configured to pause while awaiting Requester. `on_hold` pauses only if policy permits. `new`, `open`, and `solved` do not implicitly pause.
- Schedule or policy publication affects new evaluations; existing Targets remain on their captured versions unless an authorized, audited recalculation is requested.
- Breach occurs at `now >= due_at` while incomplete and unpaused. Warnings are threshold crossings and deduplicated.

## Acceptance criteria

Fixtures cover weekends, holidays, zero-length windows, overnight schedules, leap days, DST gaps/folds, pause across closures, priority changes, reopen, and recalculation. Results must be deterministic and match reference fixtures at ≥99.99%; any discrepancy blocks release. Agents see due instant, remaining business time, state, and the reason/policy used. See OQ-08 for unresolved calendar details.
