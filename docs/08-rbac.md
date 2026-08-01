# Role-based access control

Authorization is deny-by-default and evaluates User, active Tenant Membership, assigned Roles, Permission, resource Tenant, resource scope, and contextual restrictions. Role names are labels; code checks stable Permissions. The implementation matrix is [permissions-matrix.md](permissions-matrix.md).

## Baseline roles

| Role                 | Intended scope                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| Requester            | Own/request-visible Tickets and public Comments.                                                   |
| Agent                | Tickets visible through assigned Groups; internal Comments and allowed transitions.                |
| Tenant Administrator | Tenant configuration, memberships, Roles, Workflows, SLAs, and audit access; no platform controls. |
| Auditor              | Read-only Tenant configuration, reports, and Audit Events; content only if explicitly granted.     |
| Platform Operator    | Platform health; no Tenant content by default, with just-in-time audited elevation.                |

Permissions follow `resource[.subresource].action` (for example `ticket.read`, `ticket.assign`, `ticket.transition`, `ticket.comment.internal.create`, `audit.export`). Scope is one of own, organization, group, or Tenant. Explicit contextual denial wins. A User cannot grant a Permission they do not possess, remove the last active Tenant Administrator, approve their own privileged elevation, or use stale authorization after membership suspension.

## Acceptance criteria

Every protected operation has positive and negative matrix tests across role, scope, status, and Tenant. Permission changes invalidate relevant sessions/caches within 60 seconds. Sensitive grants, revocations, impersonation/elevation, exports, and failed privileged actions create Audit Events. UI hiding is never the authorization control.

## M2 implementation boundary

M2.10 implements a reusable, deny-by-default evaluator over active tenant-scoped `UserRole` and `RolePermission` records. Code checks stable permission keys. Role assignment requires `role.assign`, same-tenant role and target membership ownership, and proof that the actor effectively holds every permission granted by the target role. Role-permission assignment requires `role.update`, same-tenant role ownership, a system framework permission, and proof that the actor already holds the permission being granted.

Framework migrations seed tenant, settings, identity, role, permission, audit, and platform-elevation keys. Ticketing migrations seed the canonical `ticket.*` and `ticket.comment.*` keys listed in [permissions-matrix.md](permissions-matrix.md). Attachment migrations seed `ticket.attachment.*`. Notification migrations seed `notification.preference.read` and `notification.preference.update`. Workflow, SLA, report, export, search, organization, and notification template permissions remain documentation-only until their owning milestones implement them. Protected code injects `RbacService` and calls `can` with optional resource scope context; endpoint guards must use the same evaluator rather than role names.
