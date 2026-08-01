# UI component library specification

This document defines reusable UI behavior and acceptance standards without implementing React components. It extends [14-ui-ux-accessibility.md](14-ui-ux-accessibility.md) and supports API behavior in [api/](api/README.md).

## Global rules

- Components must support keyboard access, visible focus, semantic markup, screen-reader labels, 200% zoom, reduced motion, and non-color-only status.
- Components must expose loading, empty, error, disabled, read-only, permission-denied, optimistic-conflict, and stale-data states where relevant.
- Tenant context must be visible in app chrome and destructive/sensitive components.
- Components must not place personal data in URLs, page titles, analytics, or browser notifications without documented need.

## Component catalogue

| Component        | Purpose                                                       | Required states                                           | Accessibility                                              | Security/tenant notes                                                  |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| Buttons          | Execute commands and mutations.                               | default, hover, focus, loading, disabled, destructive.    | Native button semantics; icon buttons require labels.      | Destructive and privileged actions require confirmation.               |
| Inputs           | Capture text, numbers, dates, search, and structured values.  | untouched, dirty, invalid, valid, read-only, disabled.    | Programmatic labels, descriptions, error linkage.          | Validate after meaningful interaction and on submit.                   |
| Tables           | Dense lists for tickets, users, roles, audit events, reports. | loading, empty, sorted, filtered, selected, partial data. | Header associations, keyboard row actions, no focus traps. | Do not expose unauthorized columns; disclose stale search/report data. |
| Cards            | Small repeated summaries such as dashboard metrics.           | loading, normal, warning, error, stale.                   | Logical heading hierarchy.                                 | Cards are not authorization boundaries.                                |
| Modals           | Confirm or complete blocking actions.                         | opened, submitting, error, success.                       | Focus trap, escape behavior, restore focus.                | Required for destructive, export, privilege, and publication actions.  |
| Drawers          | Contextual detail without losing list state.                  | opened, loading, dirty, conflict.                         | Keyboard close and focus management.                       | Preserve tenant and ticket context.                                    |
| Sidebars         | Primary navigation and tenant switcher.                       | collapsed, expanded, active, permission-hidden.           | Landmark navigation; skip link.                            | Tenant switch clears tenant-derived caches/drafts after warning.       |
| Tabs             | Switch related panels on one resource.                        | active, inactive, disabled, overflow.                     | Roving tabindex or native semantics.                       | Hidden tab content must not fetch unauthorized data.                   |
| Dropdowns        | Select from bounded option sets.                              | open, selected, empty, async loading.                     | Keyboard navigation and typeahead.                         | Avoid embedding secrets or foreign tenant labels.                      |
| Badges           | Show status, priority, SLA risk, scan state.                  | neutral, info, warning, critical, success.                | Text plus color; sufficient contrast.                      | Status wording must match [glossary.md](glossary.md).                  |
| Avatars          | Represent users/groups.                                       | image, initials, unavailable, loading.                    | Decorative or labeled based on context.                    | Avoid leaking profile images across tenants.                           |
| Timeline         | Ticket and audit activity history.                            | grouped, filtered, loading, redacted.                     | Chronological semantic list.                               | Public/internal/comment/audit visibility must be explicit.             |
| Empty states     | Explain absence of data.                                      | first use, filtered none, permission none, error none.    | Plain language and actionable next step.                   | Do not disclose hidden resources.                                      |
| Skeleton loaders | Reserve layout during fetch.                                  | loading only.                                             | `aria-busy`; avoid infinite ambiguity.                     | Do not imply committed success before durable write.                   |
| Charts           | Dashboard/report visualization.                               | loading, stale, no data, partial, error.                  | Data table alternative and descriptive labels.             | Tenant-scoped metrics only unless platform metadata approved.          |

## As-built Ticket Module v1 UI

Implemented under `apps/web/app/tickets/`:

| Component                           | Path                                                                  | Notes                                                                 |
| ----------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Ticket detail page                  | `app/tickets/[ticketId]/page.tsx`                                     | Load/error/forbidden/conflict states; inline edit; comments; timeline |
| Status / priority badges            | `components/ticket-*-badge.tsx`                                       | Glossary-aligned labels                                               |
| Comment form / item                 | `components/comment-*.tsx`                                            | Public/internal composer; author delete                               |
| Timeline item                       | `components/timeline-item.tsx`                                        | Audit-derived activity                                                |
| Edit form / skeleton / error banner | `components/edit-ticket-form.tsx`, `skeleton.tsx`, `error-banner.tsx` | Optimistic concurrency banner                                         |

**Not implemented yet:** ticket list/queue, create ticket screen, permission-gated action chrome beyond HTTP 403, ticket Playwright/a11y journeys.

## Required screens (target)

- Requester portal: submit ticket, ticket detail, public comments, attachments, notification preferences.
- Agent workspace: queues, ticket detail, timeline, public/internal reply composer, assignment, SLA panel.
- Admin console: users, roles, groups, settings, workflows, SLA policies, schedules, notification templates, audit/export.
- Auditor console: audit search, exports, immutable evidence detail.
- Platform operations: health, queues, outbox, operator elevation, tenant lifecycle metadata.

## Design acceptance

Before implementation starts, produce screen-level UX specifications or wireframes for each critical journey in [02-personas-journeys.md](02-personas-journeys.md) and [workflow-matrix.md](workflow-matrix.md). T-A11Y from [16-testing-quality.md](16-testing-quality.md) is required for every critical journey.
