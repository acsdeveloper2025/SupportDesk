# UI, UX, and accessibility

## Standards

All critical journeys must conform to WCAG 2.2 AA. Use semantic structure, complete keyboard access, visible focus, logical focus order, skip navigation, text alternatives, programmatic labels/instructions/errors, sufficient contrast, 200% zoom and reflow, reduced-motion preference, and non-color status cues. Dynamic updates announce appropriately without stealing focus. Automated checks supplement, never replace, screen-reader and keyboard testing.

## Interaction rules

- Maintain an always-visible Tenant switcher and unmistakable active Tenant; switching clears Tenant-derived caches and drafts only after warning.
- Ticket lists preserve filters, sorting, and focus on return. Ticket detail distinguishes public Comments from internal Comments by label, icon, color-independent treatment, and confirmation near send.
- Destructive, bulk, privilege, export, Workflow publication, and SLA recalculation actions show scope, consequences, and recovery; dangerous actions require explicit confirmation.
- Forms validate after meaningful interaction and on submit, preserve valid input, focus/summary errors, and prevent duplicate submission. Optimistic conflicts retain edits and offer comparison/reload.
- Show SLA due instant, business-time remainder, time zone, and state. Never show false precision or success before durable commit.
- Responsive layouts support 320 CSS-pixel width and touch targets at least 24×24 CSS pixels, preferably 44×44.

## Content and privacy

Use glossary terms, plain language, actionable errors, and locale-ready strings. Do not put Personal data in URLs, page titles, analytics, or browser notifications without explicit need. Session expiry warns users and preserves a safe draft where policy allows.

## Acceptance

T-A11Y covers axe-like automation, keyboard-only critical journeys, screen reader smoke tests on supported browser/AT pairs, 200% zoom/reflow, contrast, reduced motion, errors, and timeouts. No critical/serious automated violation or critical-journey blocker ships.
