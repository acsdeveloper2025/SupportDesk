# Asset Management (CMDB) API Specification

This document details the REST API endpoints for **Module 3 – Enterprise Asset Management / CMDB**.

- **Base Path**: `/api/v1/assets`
- **Authentication**: `AuthAccessTokenGuard` (JWT Bearer / HttpOnly session cookie)
- **Tenant Context**: Enforced via `@ActiveTenant()` context.
- **RBAC Scope**: `asset.*` permissions.

---

## Endpoint Inventory

| Endpoint                            | Method                     | Permission                                                    | Summary                                                                                                                              |
| :---------------------------------- | :------------------------- | :------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/assets`                    | `GET`                      | `asset.read`                                                  | Search and list asset records with filters (`q`, `lifecycleState`, `assetTypeId`, `categoryId`, `locationId`)                        |
| `/api/v1/assets`                    | `POST`                     | `asset.create`                                                | Register a new asset record                                                                                                          |
| `/api/v1/assets/summary`            | `GET`                      | `asset.read`                                                  | Get asset summary counts per lifecycle state                                                                                         |
| `/api/v1/assets/ref/:assetRef`      | `GET`                      | `asset.read`                                                  | Fetch asset details by public asset reference (e.g. `AST-000001`)                                                                    |
| `/api/v1/assets/:id`                | `GET`                      | `asset.read`                                                  | Fetch asset details by UUID                                                                                                          |
| `/api/v1/assets/:id`                | `PATCH`                    | `asset.update`                                                | Update asset record metadata                                                                                                         |
| `/api/v1/assets/:id`                | `DELETE`                   | `asset.delete`                                                | Soft-delete asset record                                                                                                             |
| `/api/v1/assets/:id/transition`     | `POST`                     | `asset.transition`                                            | Transition lifecycle state (`DRAFT` → `IN_STOCK` → `ASSIGNED`, etc.)                                                                 |
| `/api/v1/assets/:id/assign`         | `POST`                     | `asset.assign`                                                | Assign asset to User, Department, or Location                                                                                        |
| `/api/v1/assets/:id/unassign`       | `POST`                     | `asset.unassign`                                              | Unassign asset                                                                                                                       |
| `/api/v1/assets/:id/relationships`  | `GET` / `POST`             | `asset.read` / `asset.relationship.create`                    | List & create asset relationships (`PARENT_CHILD`, `DEPENDS_ON`, `CONNECTED_TO`, `INSTALLED_ON`, `HOSTED_ON`, `LICENSE_ASSIGNED_TO`) |
| `/api/v1/assets/:id/tickets`        | `GET` / `POST`             | `asset.read` / `asset.ticket.link`                            | List linked tickets or link existing ticket                                                                                          |
| `/api/v1/assets/:id/tickets/create` | `POST`                     | `asset.ticket.link`                                           | Create a new ticket linked to the asset                                                                                              |
| `/api/v1/assets/:id/attachments`    | `GET` / `POST`             | `asset.attachment.read` / `asset.attachment.create`           | List & upload asset attachments                                                                                                      |
| `/api/v1/assets/types`              | `GET` / `POST`             | `asset.type.read` / `asset.type.create`                       | List & create asset types                                                                                                            |
| `/api/v1/assets/types/:id`          | `GET` / `PATCH` / `DELETE` | `asset.type.read` / `asset.type.update` / `asset.type.delete` | Get, update, or soft-delete custom asset type                                                                                        |
| `/api/v1/assets/categories`         | `GET` / `POST`             | `asset.category.read` / `asset.category.create`               | List & create asset categories                                                                                                       |
| `/api/v1/assets/locations`          | `GET` / `POST`             | `asset.location.read` / `asset.location.create`               | List & create asset locations                                                                                                        |

---

## State Machine Transition Matrix

| Current State | Allowed Next States                                                |
| :------------ | :----------------------------------------------------------------- |
| `DRAFT`       | `IN_STOCK`, `ASSIGNED`, `DISPOSED`, `ARCHIVED`                     |
| `IN_STOCK`    | `ASSIGNED`, `IN_REPAIR`, `RETIRED`, `DISPOSED`, `LOST`, `ARCHIVED` |
| `ASSIGNED`    | `IN_STOCK`, `IN_REPAIR`, `RETIRED`, `DISPOSED`, `LOST`, `ARCHIVED` |
| `IN_REPAIR`   | `IN_STOCK`, `ASSIGNED`, `RETIRED`, `DISPOSED`, `LOST`, `ARCHIVED`  |
| `RETIRED`     | `ARCHIVED`, `IN_STOCK`, `DISPOSED`                                 |
| `DISPOSED`    | `ARCHIVED`                                                         |
| `LOST`        | `IN_STOCK`, `ARCHIVED`                                             |
| `ARCHIVED`    | (Terminal - none)                                                  |
