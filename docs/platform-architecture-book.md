# SupportDesk Enterprise Platform Architecture Book (v1.1)

> **Canonical Technical Reference & Architecture Book**  
> **Release Target**: SupportDesk Platform v1.1 (`v1.1-knowledge-base`)  
> **Scope**: Enterprise SaaS Infrastructure, Ticket Platform, Knowledge Base Engine, SLA Engine, Notification Dispatcher, and Workflow Runtime Platform.

---

## Executive Summary & System Overview

SupportDesk is a multi-tenant, enterprise-grade Service Desk SaaS platform designed for strict tenant isolation, high operational availability, deterministic execution, and complete audit compliance.

The system is architected as a **Modular Monolith** with explicit context boundaries, enabling linear horizontal scaling without premature microservices complexity.

```
+-----------------------------------------------------------------------------------+
|                                  API GATEWAY & BFF                                |
+-----------------------------------------------------------------------------------+
                                          |
  +-------------------+   +---------------+---------------+   +-------------------+
  | Authentication &  |   |    Multi-Tenancy & Security   |   |   Audit Engine    |
  | Identity Context  |   |    Context (Tenant Isolation) |   | (Immutable Log)   |
  +-------------------+   +---------------+---------------+   +-------------------+
                                          |
  +-------------------+   +---------------+---------------+   +-------------------+
  | Ticket Platform   |   |   SLA Policy & Calculation    |   | Knowledge Base    |
  | Engine (v1)       |   |   Engine (Business Hours)     |   | Engine (v1)       |
  +-------------------+   +---------------+---------------+   +-------------------+
                                          |
+-----------------------------------------+-----------------------------------------+
|                  WORKFLOW RUNTIME & TRANSACTIONAL OUTBOX ENGINE                    |
|  (SKIP LOCKED Dispatcher | Recursion Budget | Action Executors | Dead-Letter Recovery)|
+-----------------------------------------------------------------------------------+
                                          |
+-----------------------------------------------------------------------------------+
|                        POSTGRESQL MULTI-TENANT STORAGE LAYER                      |
+-----------------------------------------------------------------------------------+
```

---

## 1. Architectural Principles & Constraints

1. **Modular Monolith First**: All domains operate within a single deployable unit while enforcing strict boundary separation via NestJS modules and domain abstractions. Cross-domain dependency must go through explicit interfaces.
2. **Strict Multi-Tenant Isolation**: Tenant context (`tenantId`) is mandatory on every database query, security check, audit record, outbox event, and background job. Cross-tenant data leak is impossible by design.
3. **Transactional Outbox Pattern**: External side effects (notifications, workflow execution, third-party sync) are written to the database outbox in the same ACID transaction as entity updates.
4. **Idempotency & Replay Safety**: All event consumers use unique deduplication keys to prevent double-execution under network retries or concurrent worker execution.
5. **Fail-Closed Security**: Deny by default. Unauthenticated or unauthorized requests immediately fail closed without exposing internal system details or entity existence.

---

## 2. Decision Log & Architectural Decision Records (ADRs)

| ADR ID       | Title                                     | Status   | Summary / Decision                                                                               |
| :----------- | :---------------------------------------- | :------- | :----------------------------------------------------------------------------------------------- |
| **ADR-0001** | Modular Monolith Architecture             | Accepted | Single code repository with explicit bounded contexts; avoid microservices until required.       |
| **ADR-0002** | Row-Level Tenant Isolation                | Accepted | Enforce `tenantId` FK on all domain entities and database queries.                               |
| **ADR-0003** | Argon2id & JWT Authentication             | Accepted | Secure password hashing via Argon2id; stateless access tokens with database session revocation.  |
| **ADR-0004** | Role-Based Access Control (RBAC)          | Accepted | Custom RBAC engine supporting domain scopes and permissions mapping per tenant.                  |
| **ADR-0005** | Immutable Audit Logging                   | Accepted | Transactional write of audit events for all state-modifying domain operations.                   |
| **ADR-0006** | Ticket State Machine & Optimistic Locking | Accepted | Version-controlled state transitions with concurrent mutation protection via version increments. |
| **ADR-0007** | Business Hours SLA Engine                 | Accepted | SLA calculation taking into account tenant timezone schedules and holiday calendars.             |
| **ADR-0008** | Notification Intent Pipeline              | Accepted | Decoupled notification intent generation from external transport delivery.                       |
| **ADR-0009** | Workflow Runtime & Outbox Engine          | Accepted | Asynchronous workflow execution triggered via PostgreSQL `SKIP LOCKED` outbox polling.           |

---

## 3. Core Bounded Contexts

### 3.1 Authentication & Identity Module

- **Capabilities**: User registration, session creation, password reset flows, rate-limiting, and token revocation.
- **Security Standards**: Argon2id hashing parameters (memory 64MB, time cost 3, parallelism 4), JWT access tokens with 15-min TTL, and refresh tokens stored in database.

### 3.2 RBAC & Multi-Tenancy Module

- **Tenant Context**: Injected via request header (`X-Tenant-ID`) or sub-domain lookup, validated at the API trust boundary.
- **Permission Matrix**: Granular permission checks (`tickets:create`, `tickets:update`, `comments:create_public`, `kb.article.publish`, `workflows:publish`, `outbox:replay`).

### 3.3 Ticket Platform Engine

- **Lifecycle States**: `NEW` -> `OPEN` -> `PENDING` -> `RESOLVED` -> `CLOSED`.
- **Concurrency**: Optimistic concurrency control using `version` column increments on updates.
- **Comments & Attachments**: Public and internal comment streams; attachment metadata linked to secure storage providers.

### 3.4 Knowledge Base Module (v1)

- **Capabilities**: Category tree hierarchy, article authoring with draft/published/archived state machine (`KbArticleStatus`), immutable version snapshots (`KbArticleVersion`), internal vs. public visibility (`KbArticleVisibility`), tagging system, full-text search, article-ticket linking, and helpfulness feedback tracking.
- **Outbox Integration**: Publishes `kb.article.published` events for workflow dispatcher triggers and external integrations.

### 3.5 SLA Engine

- **Target Tracking**: `FIRST_RESPONSE` and `RESOLUTION` time targets calculated based on SLA policy configurations.
- **Business Hours Support**: Automatically pauses calculation during out-of-office hours and holidays.

### 3.6 Workflow Runtime & Transactional Outbox Platform

- **Outbox Publisher**: Atomic insertion of domain events into `outbox_events` within the entity transaction.
- **Runtime Dispatcher**: Polling worker using `SELECT ... FOR UPDATE SKIP LOCKED` for concurrent, conflict-free event processing across API nodes.
- **Condition Evaluator**: Supports field matching (`equals`, `not_equals`, `contains`, `in`, `greater_than`) on ticket attributes.
- **Action Executors**:
  - `change_status`: Mutates ticket status with state-machine validation.
  - `assign`: Reassigns ticket to target agent or group.
  - `add_internal_comment`: Appends internal system comment.
  - `create_notification`: Emits notification intent.
  - `apply_sla`: Overrides or attaches SLA policies dynamically.
- **Governance**: Maximum automation recursion depth budget (`MAX_RECURSION_DEPTH = 3`) to prevent infinite cascades.

### 3.7 Enterprise Reports & Analytics Module (v1.3)

- **Capabilities**: Cross-domain analytics for Executive Dashboard, Ticket Analytics (volume, MTTR, MTTA, open ticket aging, reopened tickets, escalations), SLA Reports (compliance %, breach priority breakdown, business hours vs actual elapsed time), Workflow Reports (executions, success/failure rate, retries, dead letter events, automation time saved), Asset Reports (inventory, status, warranty expiry, utilization), Service Catalog Reports (request volume, top services, approval stats, completion times), KB Reports (published/draft counts, view counts, ticket/asset linking, helpfulness rate), and Agent Productivity (assigned/closed tickets, response/resolution times, comment counts, workload ranking).
- **Export Engine**: Export report data into CSV, PDF, and Excel (XLSX) formats.
- **Scheduled Reports**: Automated report execution delivering export snapshots via the existing Outbox/Notification intent pipeline.
- **No Data Duplication**: All metrics are dynamically computed via optimized SQL/Prisma aggregations directly against operational database tables.

---

## 4. Database Schema & Multi-Tenant Data Model

The schema uses PostgreSQL with UUID primary keys and strict foreign key relations. Key models include:

- `tenants`: Root organizational tenant boundary.
- `users`, `roles`, `user_roles`: Multi-tenant user identity and authorization assignments.
- `tickets`, `comments`, `attachments`: Core ticket entity aggregate.
- `kb_categories`, `kb_articles`, `kb_article_versions`, `kb_tags`, `kb_article_tags`, `kb_ticket_links`: Knowledge base hierarchy, versioning, tagging, and ticket linking.
- `sla_policy_versions`, `ticket_sla_targets`: SLA policy definitions and runtime target trackers.
- `workflows`, `workflow_versions`, `workflow_executions`, `workflow_action_attempts`: Workflow definition and runtime execution logs.
- `saved_reports`, `scheduled_reports`, `report_exports`: Custom saved reports, automated report schedule jobs, and export history.
- `outbox_events`: Transactional outbox event stream.
- `audit_events`: Append-only security and operational audit trail.

---

## 5. Security Model & API Standards

- **RESTful Conventions**: Clean REST resources with versioned paths (`/api/v1/...`).
- **OpenAPI 3.0 Documentation**: Fully annotated endpoints available via Swagger UI (`kb-categories`, `kb-articles`, `tickets`, `workflows`).
- **Standardized Error Payload**:
  ```json
  {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action",
    "correlationId": "req-12345-67890",
    "timestamp": "2026-08-01T16:00:00.000Z"
  }
  ```
- **Error Classifications**: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`.

---

## 6. Deployment, Operations & Verification

- **Migration Safety**: Zero-downtime database migrations with backward-compatible schema changes.
- **Quality Gates**:
  - Pre-commit hooks verifying Prettier formatting, ESLint rules, and TypeScript compilation.
  - Integration testing with real PostgreSQL database (`supportdesk-postgres`).
  - Outbox queue processing & multi-tenant isolation negative test coverage.
- **Git Release Tag**: `v1.1-knowledge-base`

---

_SupportDesk Platform Architecture Book — End of Canonical Reference_
