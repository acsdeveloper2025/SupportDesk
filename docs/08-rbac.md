# Role-based access control

Authorization is deny-by-default and evaluates User, active Tenant Membership, assigned Roles, Permission, resource Tenant, resource scope, and contextual restrictions. Role names are labels; code checks stable Permissions.

## Baseline roles

| Role | Intended scope |
|---|---|
| Requester | Own/request-visible Tickets and public Comments. |
| Agent | Tickets visible through assigned Groups; internal Comments and allowed transitions. |
| Tenant Administrator | Tenant configuration, memberships, Roles, Workflows, SLAs, and audit access; no platform controls. |
| Auditor | Read-only Tenant configuration, reports, and Audit Events; content only if explicitly granted. |
| Platform Operator | Platform health; no Tenant content by default, with just-in-time audited elevation. |

Permissions follow `resource.action` (for example `ticket.read`, `ticket.assign`, `comment.internal.create`, `audit.export`). Scope is one of own, organization, group, or Tenant. Explicit contextual denial wins. A User cannot grant a Permission they do not possess, remove the last active Tenant Administrator, approve their own privileged elevation, or use stale authorization after membership suspension.

## Acceptance criteria

Every protected operation has positive and negative matrix tests across role, scope, status, and Tenant. Permission changes invalidate relevant sessions/caches within 60 seconds. Sensitive grants, revocations, impersonation/elevation, exports, and failed privileged actions create Audit Events. UI hiding is never the authorization control.
