# SLA behavior

An SLA Policy is an ordered, versioned set of conditions and Targets. The first matching published policy wins; ties are impossible because priority is unique within a Tenant among published policies. Evaluation evidence stores policy version, inputs, Business Schedule version, and computed deadlines.

MVP calendar and timer semantics are locked in [adr/ADR-0009.md](adr/ADR-0009.md) (resolves OQ-08). Multi-region calendars, external holiday feeds, escalation workflows, email alerts, and scheduled workers remain deferred.

## Clock rules

- Times are stored as instants in UTC and displayed in the configured schedule time zone. Business Schedule arithmetic handles DST using the IANA TZDB via `luxon`.
- Each Tenant has at most one active published Business Schedule with key `default` for MVP. Holidays are explicit full-day dates on the published schedule version.
- A response Target starts at Ticket creation and completes on the first qualifying public Agent response (public Comment by a user other than the Requester).
- A resolution Target starts at creation and completes when first solved; reopening retains completion by default, or restarts when the captured policy sets `restartResolutionOnReopen`.
- `pending` pauses only Targets configured with `pauseOnPending` (default true). `on_hold` pauses only if `pauseOnHold` is true (default false). `new`, `open`, and `solved` do not implicitly pause.
- Schedule or policy publication affects new evaluations; existing Targets remain on their captured versions. Silent rematch on attribute edits is forbidden; authorized recalculation is future work.
- Breach occurs at `now >= due_at` while incomplete and unpaused. Warnings are threshold crossings and deduplicated. Breach and warning evaluation runs on Ticket mutations and SLA status/timer reads (no background worker in MVP).

## Acceptance criteria

Fixtures cover weekends, holidays, zero-length windows, overnight schedules, leap days, DST gaps/folds, pause across closures, priority changes (no silent rematch), reopen, and retained/restarted resolution. Results must be deterministic and match reference fixtures. Agents see due instant, remaining business time, state, and the reason/policy used.
