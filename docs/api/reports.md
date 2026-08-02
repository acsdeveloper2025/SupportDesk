# Reports & Analytics API Specification

## As-built API Endpoints (`/api/v1/reports`)

All endpoints enforce multi-tenant boundary checks and require appropriate `report.*` permissions.

| Method   | Endpoint                               | Required Permission      | Description                                                                                                  |
| :------- | :------------------------------------- | :----------------------- | :----------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/v1/reports/executive`            | `report.read`            | Executive Dashboard high-level KPIs and system health summary                                                |
| `GET`    | `/api/v1/reports/tickets`              | `report.ticket.read`     | Ticket volume, status, priority, MTTR, MTTA, open ticket aging, reopened, escalations, backlog               |
| `GET`    | `/api/v1/reports/sla`                  | `report.sla.read`        | SLA compliance %, breaches, response vs resolution SLA, breach priority breakdown, business hours vs actual  |
| `GET`    | `/api/v1/reports/workflows`            | `report.workflow.read`   | Workflow executions, success/failure rate, retries, dead letter events, automation time saved, runtime stats |
| `GET`    | `/api/v1/reports/assets`               | `report.asset.read`      | Asset inventory count, assets by type & status, warranty expiry (30/60/90d), utilization %                   |
| `GET`    | `/api/v1/reports/catalog`              | `report.catalog.read`    | Service catalog request volume, top services, approval stats, fulfillment completion times                   |
| `GET`    | `/api/v1/reports/kb`                   | `report.kb.read`         | Knowledge base article counts, views, ticket/asset linking, helpfulness rating, most viewed/linked articles  |
| `GET`    | `/api/v1/reports/agents`               | `report.agent.read`      | Agent productivity: assigned/closed tickets, response/resolution times, comment counts, workload ranking     |
| `POST`   | `/api/v1/reports/export`               | `report.export.create`   | Generate and export report data in CSV (UTF-8 BOM), PDF, or Excel (XLSX) format                              |
| `GET`    | `/api/v1/reports/saved`                | `report.saved.read`      | List custom saved report definitions for tenant                                                              |
| `POST`   | `/api/v1/reports/saved`                | `report.saved.create`    | Create custom saved report configuration                                                                     |
| `GET`    | `/api/v1/reports/saved/:id`            | `report.saved.read`      | Get saved report definition by ID                                                                            |
| `DELETE` | `/api/v1/reports/saved/:id`            | `report.saved.delete`    | Delete custom saved report definition                                                                        |
| `GET`    | `/api/v1/reports/scheduled`            | `report.schedule.read`   | List scheduled report delivery jobs                                                                          |
| `POST`   | `/api/v1/reports/scheduled`            | `report.schedule.create` | Create scheduled report delivery job (Daily, Weekly, Monthly, Custom)                                        |
| `DELETE` | `/api/v1/reports/scheduled/:id`        | `report.schedule.delete` | Delete scheduled report job                                                                                  |
| `GET`    | `/api/v1/reports/exports`              | `report.export.read`     | List past generated report export files                                                                      |
| `GET`    | `/api/v1/reports/exports/:id/download` | `report.export.download` | Download generated report export file                                                                        |

## Query Filters Schema

All report GET endpoints accept query filters:

- `range`: Time range shortcut (`7d`, `30d`, `90d`, `12M`, `custom`)
- `startDate`: ISO 8601 UTC timestamp
- `endDate`: ISO 8601 UTC timestamp
- `groupId`: Optional assigned group filter ID
- `agentId`: Optional assigned agent filter ID
- `category`: Optional domain category filter
