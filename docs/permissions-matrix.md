# Permission matrix

This matrix expands [08-rbac.md](08-rbac.md). Code must authorize stable permission keys, not role labels. API endpoints reference these permissions in [api/](api/README.md).

## Roles

- **Super Admin:** platform-level operator. Not a tenant member by default; tenant content access requires operator elevation.
- **Tenant Admin:** full tenant configuration and user administration.
- **Department Admin:** administers assigned organizations/groups/departments.
- **Manager:** oversees team queues, assignment, reporting, and escalation.
- **Agent:** works assigned or visible tickets.
- **Requester:** creates and follows own/request-visible tickets.
- **Approver:** approves configured transitions, sensitive actions, or workflow publications.
- **Auditor:** read-only audit/report/configuration access; content only if granted.
- **Read Only:** read-only operational access to permitted resources.

Scopes: `own`, `organization`, `group`, `tenant`, `platform`.

## Matrix

| Permission                          | Scope                         |         Super Admin | Tenant Admin | Department Admin | Manager |       Agent |   Requester | Approver | Auditor | Read Only |
| ----------------------------------- | ----------------------------- | ------------------: | -----------: | ---------------: | ------: | ----------: | ----------: | -------: | ------: | --------: |
| `tenant.read`                       | tenant/platform               |                   Y |            Y |                Y |       Y |           N |           N |        Y |       Y |         Y |
| `tenant.update`                     | tenant                        |                   E |            Y |                N |       N |           N |           N |        N |       N |         N |
| `tenant.suspend`                    | platform                      |                   Y |            N |                N |       N |           N |           N |        N |       N |         N |
| `settings.read`                     | tenant                        |                   E |            Y |                Y |       Y |           N |           N |        Y |       Y |         Y |
| `settings.update`                   | tenant                        |                   E |            Y |          Limited |       N |           N |           N | Approval |       N |         N |
| `settings.security.update`          | tenant                        |                   E |            Y |                N |       N |           N |           N | Approval |       N |         N |
| `settings.email.update`             | tenant                        |                   E |            Y |                N |       N |           N |           N | Approval |       N |         N |
| `user.read`                         | tenant/group/organization     |                   E |            Y |           Scoped |  Scoped |      Scoped |         Own |        Y |       Y |         Y |
| `user.invite`                       | tenant/group                  |                   E |            Y |           Scoped |       N |           N |           N |        N |       N |         N |
| `user.membership.update`            | tenant/group                  |                   E |            Y |           Scoped |       N |           N |           N | Approval |       N |         N |
| `role.read`                         | tenant                        |                   E |            Y |           Scoped |       N |           N |           N |        Y |       Y |         Y |
| `role.create`                       | tenant                        |                   E |            Y |                N |       N |           N |           N | Approval |       N |         N |
| `role.update`                       | tenant                        |                   E |            Y |                N |       N |           N |           N | Approval |       N |         N |
| `role.delete`                       | tenant                        |                   E |            Y |                N |       N |           N |           N | Approval |       N |         N |
| `role.assign`                       | tenant/group                  |                   E |            Y |           Scoped |       N |           N |           N | Approval |       N |         N |
| `role.revoke`                       | tenant/group                  |                   E |            Y |           Scoped |       N |           N |           N | Approval |       N |         N |
| `permission.read`                   | tenant                        |                   E |            Y |                Y |       N |           N |           N |        Y |       Y |         Y |
| `organization.read`                 | tenant/organization           |                   E |            Y |           Scoped |  Scoped |      Scoped |         Own |        Y |       Y |         Y |
| `organization.create`               | tenant                        |                   E |            Y |           Scoped |       N |           N |           N | Approval |       N |         N |
| `organization.update`               | tenant/organization           |                   E |            Y |           Scoped |       N |           N |           N | Approval |       N |         N |
| `organization.delete`               | tenant                        |                   E |            Y |                N |       N |           N |           N | Approval |       N |         N |
| `ticket.read`                       | own/organization/group/tenant |                   E |            Y |           Scoped |  Scoped |      Scoped |         Own |   Scoped |  Scoped |    Scoped |
| `ticket.create`                     | own/tenant                    |                   E |            Y |                Y |       Y |           Y |         Own |        N |       N |         N |
| `ticket.update`                     | group/tenant                  |                   E |            Y |           Scoped |  Scoped |      Scoped | Own limited | Approval |       N |         N |
| `ticket.assign`                     | group/tenant                  |                   E |            Y |           Scoped |       Y |      Scoped |           N |        N |       N |         N |
| `ticket.transition`                 | own/group/tenant              |                   E |            Y |           Scoped |  Scoped |      Scoped | Own limited | Approval |       N |         N |
| `ticket.priority.update`            | group/tenant                  |                   E |            Y |           Scoped |       Y |      Scoped |           N | Approval |       N |         N |
| `ticket.link`                       | group/tenant                  |                   E |            Y |           Scoped |  Scoped |      Scoped |           N |        N |       N |         N |
| `ticket.comment.public.create`      | own/group/tenant              |                   E |            Y |                Y |       Y |           Y |         Own |        N |       N |         N |
| `ticket.comment.internal.create`    | group/tenant                  |                   E |            Y |           Scoped |       Y |           Y |           N |        N |       N |         N |
| `ticket.comment.read`               | own/group/tenant              |                   E |            Y |           Scoped |  Scoped |      Scoped |  Own public |   Scoped |  Scoped |    Scoped |
| `ticket.comment.internal.read`      | group/tenant                  |                   E |            Y |           Scoped |  Scoped |      Scoped |           N |   Scoped |  Scoped |    Scoped |
| `ticket.comment.update`             | own/group/tenant              |                   E |            Y |           Scoped |  Scoped | Own limited | Own limited | Approval |       N |         N |
| `ticket.comment.delete`             | tenant                        |                   E |            Y |                N |       N |           N |           N | Approval |       N |         N |
| `ticket.attachment.create`          | own/group/tenant              |                   E |            Y |                Y |       Y |           Y |         Own |        N |       N |         N |
| `ticket.attachment.read`            | own/group/tenant              |                   E |            Y |           Scoped |  Scoped |      Scoped |  Own public |   Scoped |  Scoped |    Scoped |
| `ticket.attachment.delete`          | tenant                        |                   E |            Y |           Scoped |       N | Own limited | Own limited | Approval |       N |         N |
| `workflow.read`                     | tenant                        |                   E |            Y |           Scoped |       Y |           N |           N |        Y |       Y |         Y |
| `workflow.create`                   | tenant                        |                   E |            Y |                N |       N |           N |           N | Approval |       N |         N |
| `workflow.update`                   | tenant                        |                   E |            Y |                N |       N |           N |           N | Approval |       N |         N |
| `workflow.publish`                  | tenant                        |                   E |            Y |                N |       N |           N |           N |        Y |       N |         N |
| `workflow.pause`                    | tenant                        |                   E |            Y |                N |       N |           N |           N | Approval |       N |         N |
| `sla.read`                          | tenant/group                  |                   E |            Y |           Scoped |       Y |           Y |           N |        Y |       Y |         Y |
| `sla.update`                        | tenant                        |                   E |            Y |                N |       N |           N |           N | Approval |       N |         N |
| `notification.preference.read`      | own/tenant                    |                   E |            Y |           Scoped |  Scoped |         Own |         Own |        Y |       Y |         Y |
| `notification.preference.update`    | own/tenant                    |                   E |            Y |           Scoped |  Scoped |         Own |         Own | Approval |       N |         N |
| `notification.template.read`        | tenant                        |                   E |            Y |           Scoped |       N |           N |           N |        Y |       Y |         Y |
| `notification.template.update`      | tenant                        |                   E |            Y |                N |       N |           N |           N | Approval |       N |         N |
| `notification.template.publish`     | tenant                        |                   E |            Y |                N |       N |           N |           N |        Y |       N |         N |
| `report.ticket.read`                | group/tenant                  |                   E |            Y |           Scoped |  Scoped |           N |           N |   Scoped |       Y |    Scoped |
| `report.sla.read`                   | group/tenant                  |                   E |            Y |           Scoped |  Scoped |           N |           N |   Scoped |       Y |    Scoped |
| `audit.read`                        | tenant                        |                   E |            Y |  Scoped metadata |       N |           N |           N |        Y |       Y |    Scoped |
| `audit.export`                      | tenant                        |                   E |            Y |                N |       N |           N |           N | Approval |       Y |         N |
| `export.read`                       | own/tenant                    |                   E |            Y |           Scoped |  Scoped |         Own |           N |   Scoped |       Y |    Scoped |
| `export.download`                   | own/tenant                    |                   E |            Y |           Scoped |  Scoped |         Own |           N | Approval |       Y |         N |
| `platform.health.read`              | platform                      |                   Y |            N |                N |       N |           N |           N |        N |       N |         N |
| `platform.elevation.request`        | platform                      |                   Y |            N |                N |       N |           N |           N |        N |       N |         N |
| `platform.elevation.approve`        | platform                      | Y, no self-approval |            N |                N |       N |           N |           N |        N |       N |         N |
| `platform.elevation.revoke`         | platform                      |                   Y |            N |                N |       N |           N |           N |        N |       N |         N |
| `kb.category.read`                  | tenant                        |                   E |            Y |                Y |       Y |           Y |           Y |        Y |       Y |         Y |
| `kb.category.create`                | tenant                        |                   E |            Y |                Y |       Y |           Y |           N |        N |       N |         N |
| `kb.category.update`                | tenant                        |                   E |            Y |                Y |       Y |           Y |           N |        N |       N |         N |
| `kb.category.delete`                | tenant                        |                   E |            Y |                N |       N |           N |           N |        N |       N |         N |
| `kb.article.read`                   | tenant                        |                   E |            Y |                Y |       Y |           Y |           Y |        Y |       Y |         Y |
| `kb.article.read_internal`          | tenant                        |                   E |            Y |                Y |       Y |           Y |           N |        N |       N |         N |
| `kb.article.create`                 | tenant                        |                   E |            Y |                Y |       Y |           Y |           N |        N |       N |         N |
| `kb.article.update`                 | tenant                        |                   E |            Y |                Y |       Y |           Y |           N |        N |       N |         N |
| `kb.article.publish`                | tenant                        |                   E |            Y |                Y |       Y |           Y |           N |        N |       N |         N |
| `kb.article.archive`                | tenant                        |                   E |            Y |                Y |       Y |           Y |           N |        N |       N |         N |
| `kb.article.delete`                 | tenant                        |                   E |            Y |                N |       N |           N |           N |        N |       N |         N |
| `kb.article.link_ticket`            | tenant                        |                   E |            Y |                Y |       Y |           Y |           N |        N |       N |         N |
| `catalog.category.read`             | tenant                        |                   E |            Y |                Y |       Y |           Y |           Y |        Y |       Y |         Y |
| `catalog.category.create`           | tenant                        |                   E |            Y |                Y |       Y |           Y |           N |        N |       N |         N |
| `catalog.category.update`           | tenant                        |                   E |            Y |                Y |       Y |           Y |           N |        N |       N |         N |
| `catalog.category.delete`           | tenant                        |                   E |            Y |                N |       N |           N |           N |        N |       N |         N |
| `catalog.service.read`              | tenant                        |                   E |            Y |                Y |       Y |           Y |           Y |        Y |       Y |         Y |
| `catalog.service.create`            | tenant                        |                   E |            Y |                Y |       Y |           Y |           N |        N |       N |         N |
| `catalog.service.update`            | tenant                        |                   E |            Y |                Y |       Y |           Y |           N |        N |       N |         N |
| `catalog.service.publish`           | tenant                        |                   E |            Y |                Y |       Y |           Y |           N |        N |       N |         N |
| `catalog.service.delete`            | tenant                        |                   E |            Y |                N |       N |           N |           N |        N |       N |         N |
| `catalog.form.read`                 | tenant                        |                   E |            Y |                Y |       Y |           Y |           Y |        Y |       Y |         Y |
| `catalog.form.update`               | tenant                        |                   E |            Y |                Y |       Y |           Y |           N |        N |       N |         N |
| `catalog.template.read`             | tenant                        |                   E |            Y |                Y |       Y |           Y |           Y |        Y |       Y |         Y |
| `catalog.template.create`           | tenant                        |                   E |            Y |                Y |       Y |           Y |           N |        N |       N |         N |
| `catalog.template.update`           | tenant                        |                   E |            Y |                Y |       Y |           Y |           N |        N |       N |         N |
| `catalog.template.delete`           | tenant                        |                   E |            Y |                N |       N |           N |           N |        N |       N |         N |
| `catalog.request.create`            | tenant                        |                   E |            Y |                Y |       Y |           Y |           Y |        Y |       N |         N |
| `catalog.request.read`              | own/tenant                    |                   E |            Y |                Y |       Y |           Y |         Own |        Y |       Y |         Y |
| `catalog.request.read_all`          | tenant                        |                   E |            Y |                Y |       Y |           Y |           N |        N |       N |         N |
| `catalog.request.update`            | own/tenant                    |                   E |            Y |                Y |       Y |           Y |         Own |        N |       N |         N |
| `catalog.request.cancel`            | own/tenant                    |                   E |            Y |                Y |       Y |           Y |         Own |        N |       N |         N |
| `catalog.request.fulfill`           | tenant                        |                   E |            Y |                Y |       Y |           Y |           N |        N |       N |         N |
| `catalog.request.generate_ticket`   | tenant                        |                   E |            Y |                Y |       Y |           Y |           N |        N |       N |         N |
| `catalog.request.complete`          | tenant                        |                   E |            Y |                Y |       Y |           Y |           N |        N |       N |         N |
| `catalog.approval.decide`           | tenant                        |                   E |            Y |                Y |       Y |           N |           N |        Y |       N |         N |
| `catalog.request.attachment.create` | own/tenant                    |                   E |            Y |                Y |       Y |           Y |         Own |        N |       N |         N |
| `catalog.request.attachment.delete` | own/tenant                    |                   E |            Y |                Y |       Y |           Y |         Own |        N |       N |         N |

Legend: `Y` allowed by default; `N` denied; `Scoped` limited by organization/group/resource; `Own` limited to owned/requester-visible resources; `Limited` depends on tenant policy; `Approval` means the role can approve or participate in an approval workflow; `E` means Super Admin requires explicit operator elevation for tenant content/configuration.

## Invariants

- A user cannot grant a permission they do not effectively hold.
- No user may remove the last active Tenant Admin.
- Privileged elevation requires MFA, reason, time limit, audit event, and no self-approval.
- UI hiding is never an authorization control.

## Implementation status

Canonical permission keys use `resource[.subresource].action` with no aliases. Implemented and seeded permissions:

- Framework (M2.10): tenant, settings, user, role, permission, audit, and platform elevation keys.
- Ticketing (E05): `ticket.create`, `ticket.read`, `ticket.update`, `ticket.assign`, `ticket.transition`, `ticket.comment.public.create`, `ticket.comment.internal.create`, `ticket.comment.read`, `ticket.comment.internal.read`, `ticket.comment.update`, `ticket.comment.delete`, `ticket.attachment.create`, `ticket.attachment.read`, `ticket.attachment.delete`.
- SLA (Issue #26 / E10): `sla.read`, `sla.update` (business schedules, SLA policies, ticket SLA status, active timers, basic metrics).
- Knowledge Base (Module 1): `kb.category.read`, `kb.category.create`, `kb.category.update`, `kb.category.delete`, `kb.article.read`, `kb.article.read_internal`, `kb.article.create`, `kb.article.update`, `kb.article.publish`, `kb.article.archive`, `kb.article.delete`, `kb.article.link_ticket`.
- Service Catalog (Module 2): `catalog.category.read/create/update/delete`, `catalog.service.read/create/update/publish/delete`, `catalog.form.read/update`, `catalog.template.read/create/update/delete`, `catalog.request.create/read/read_all/update/cancel/fulfill/generate_ticket/complete`, `catalog.approval.decide`, `catalog.request.attachment.create/delete`.

Business rule (Module 2, explicit): a requester may update answers or cancel **their own** requests. The requester role is seeded with `catalog.request.update` and `catalog.request.cancel`; the service enforces ownership, so these permissions never extend to other users' requests. Updating or cancelling another user's request requires `catalog.request.read_all` in addition (agents/managers/tenant admins only).

Scope evaluation for `own`, `group`, and `tenant` is performed in the RBAC authorization layer when a resource context is supplied. Remaining matrix rows stay documentation-only until their owning milestones implement them.
