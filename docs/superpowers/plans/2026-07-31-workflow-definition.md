# E11-I01 Workflow Definition & Basic Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship tenant-scoped Workflow CRUD with draft/publish versioning, pause/resume, structural validation, RBAC, audit, OpenAPI, and tests — without any runtime execution.

**Architecture:** Mirror the SLA config module on `feat/issue-26-sla-engine`: `workflows` container + `workflow_versions` with `ConfigPublicationState`, JSON `triggers`/`conditions`/`actions`, Nest module under `apps/api/src/workflows/`, pure validators in `domain/`.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Vitest, OpenAPI/Swagger, existing RBAC + audit helpers.

**Spec:** `docs/superpowers/specs/2026-07-31-workflow-definition-design.md`

## Global Constraints

- No workflow execution, event listeners, or ticketing hooks in this issue.
- Domain validators must not import Nest, Prisma, or HTTP types.
- Never expose Prisma entities directly in API responses.
- UTC timestamps only; tenant isolation on every query; fail closed on missing permission.
- Reuse `ConfigPublicationState` (`DRAFT` / `PUBLISHED` / `RETIRED`); do not invent a parallel enum.
- Base branch: `feat/issue-26-sla-engine` (or `main` if SLA already merged).
- Permissions: `workflow.read`, `workflow.create`, `workflow.update`, `workflow.publish`, `workflow.pause`.
- Conditions are AND-combined (document only; not evaluated).
- Follow SLA key trim + non-empty rules; unique `(tenantId, key)` and unique priority among non-deleted workflows (application-level checks).

## File map

| File                                                                                            | Responsibility                                                                |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `apps/api/src/workflows/domain/workflow-definition.ts`                                          | Catalog enums, JSON shapes, `assertValidWorkflowDefinition`                   |
| `apps/api/src/workflows/domain/workflow-definition.spec.ts`                                     | Unit tests for structural validation                                          |
| `apps/api/prisma/schema.prisma`                                                                 | `Workflow`, `WorkflowVersion` models + Tenant relations                       |
| `apps/api/prisma/migrations/20260731180000_workflow_definition/migration.sql`                   | Tables                                                                        |
| `apps/api/prisma/migrations/20260731181000_workflow_permissions/migration.sql`                  | Permission seeds                                                              |
| `apps/api/src/database/schema-guard.spec.ts`                                                    | Expect `workflows` / `workflow_versions`; remove from unimplemented deny-list |
| `apps/api/src/workflows/workflows.repository.ts`                                                | Tenant-scoped Prisma + audit helper                                           |
| `apps/api/src/workflows/workflows.service.ts`                                                   | CRUD, draft, publish, pause/resume, soft delete                               |
| `apps/api/src/workflows/dto/workflows.dto.ts`                                                   | Swagger DTOs + body parsers (mirror `sla.dto.ts`)                             |
| `apps/api/src/workflows/workflows.controller.ts`                                                | HTTP routes under `/api/v1/workflows`                                         |
| `apps/api/src/workflows/workflows.module.ts`                                                    | Module wiring                                                                 |
| `apps/api/src/app.module.ts`                                                                    | Import `WorkflowsModule`                                                      |
| `apps/api/src/workflows/workflows.integration.spec.ts`                                          | PostgreSQL integration                                                        |
| `apps/api/src/workflows/workflows.openapi.spec.ts`                                              | Docs coverage smoke                                                           |
| `docs/api/workflows.md`                                                                         | Endpoint contract                                                             |
| `docs/api/README.md`                                                                            | Link                                                                          |
| `docs/adr/ADR-0007.md`                                                                          | MVP definition semantics (next free ADR number after SLA ADR-0006 on branch)  |
| `docs/adr/README.md`, `docs/decision-log.md`, `docs/audit-events.md`, `docs/database/TABLES.md` | Sync                                                                          |

---

### Task 1: Branch from SLA and domain structural validators

**Files:**

- Create: `apps/api/src/workflows/domain/workflow-definition.ts`
- Create: `apps/api/src/workflows/domain/workflow-definition.spec.ts`

**Interfaces:**

- Produces: `WorkflowTriggerType`, `WorkflowConditionField`, `WorkflowConditionOperator`, `WorkflowActionType`, `WorkflowDefinition`, `assertValidWorkflowDefinition(definition: WorkflowDefinition): void` (throws `Error` with message; service maps to `BadRequestException`)

- [ ] **Step 1: Create feature branch from SLA**

```bash
git fetch origin
git checkout -b feat/e11-i01-workflow-definition origin/feat/issue-26-sla-engine
```

Expected: clean working tree on branch containing `apps/api/src/sla/` and `ConfigPublicationState`.

- [ ] **Step 2: Write failing unit tests**

Create `apps/api/src/workflows/domain/workflow-definition.spec.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { assertValidWorkflowDefinition, type WorkflowDefinition } from "./workflow-definition";

function validDefinition(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    actions: [
      { ordinal: 0, params: { status: "open" }, type: "change_status" },
      { ordinal: 1, params: { body: "routed" }, type: "add_internal_comment" },
    ],
    conditions: [{ field: "priority", operator: "eq", ordinal: 0, value: "high" }],
    triggers: [{ type: "ticket.created" }],
    ...overrides,
  };
}

describe("assertValidWorkflowDefinition", () => {
  it("accepts a full valid definition", () => {
    expect(() => assertValidWorkflowDefinition(validDefinition())).not.toThrow();
  });

  it("requires at least one trigger", () => {
    expect(() => assertValidWorkflowDefinition(validDefinition({ triggers: [] }))).toThrow(
      /trigger/i,
    );
  });

  it("requires at least one action", () => {
    expect(() => assertValidWorkflowDefinition(validDefinition({ actions: [] }))).toThrow(
      /action/i,
    );
  });

  it("rejects unknown trigger types", () => {
    expect(() =>
      assertValidWorkflowDefinition(
        validDefinition({ triggers: [{ type: "ticket.deleted" as never }] }),
      ),
    ).toThrow(/trigger/i);
  });

  it("rejects duplicate action ordinals", () => {
    expect(() =>
      assertValidWorkflowDefinition(
        validDefinition({
          actions: [
            { ordinal: 0, params: { status: "open" }, type: "change_status" },
            { ordinal: 0, params: { body: "x" }, type: "add_internal_comment" },
          ],
        }),
      ),
    ).toThrow(/ordinal/i);
  });

  it("rejects non-ascending action ordinal gaps that break strict order uniqueness only when duplicates", () => {
    expect(() =>
      assertValidWorkflowDefinition(
        validDefinition({
          actions: [
            { ordinal: 2, params: { status: "open" }, type: "change_status" },
            { ordinal: 5, params: { body: "x" }, type: "add_internal_comment" },
          ],
        }),
      ),
    ).not.toThrow();
  });

  it("rejects unknown condition fields and operators", () => {
    expect(() =>
      assertValidWorkflowDefinition(
        validDefinition({
          conditions: [{ field: "subject" as never, operator: "eq", ordinal: 0, value: "x" }],
        }),
      ),
    ).toThrow(/field/i);
  });

  it("rejects change_status without status param", () => {
    expect(() =>
      assertValidWorkflowDefinition(
        validDefinition({
          actions: [{ ordinal: 0, params: {}, type: "change_status" }],
        }),
      ),
    ).toThrow(/status/i);
  });

  it("rejects assign without assigneeUserId or groupId", () => {
    expect(() =>
      assertValidWorkflowDefinition(
        validDefinition({
          actions: [{ ordinal: 0, params: {}, type: "assign" }],
        }),
      ),
    ).toThrow(/assign/i);
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
cd apps/api && pnpm exec vitest run src/workflows/domain/workflow-definition.spec.ts
```

Expected: FAIL (module not found / export missing).

- [ ] **Step 4: Implement domain module**

Create `apps/api/src/workflows/domain/workflow-definition.ts`:

```typescript
export const WORKFLOW_TRIGGER_TYPES = [
  "ticket.created",
  "ticket.status_changed",
  "ticket.assigned",
  "comment.added",
  "sla.warning",
  "sla.breached",
] as const;

export type WorkflowTriggerType = (typeof WORKFLOW_TRIGGER_TYPES)[number];

export const WORKFLOW_CONDITION_FIELDS = [
  "status",
  "priority",
  "type",
  "channel",
  "tags",
  "requester",
  "group",
  "assignee",
] as const;

export type WorkflowConditionField = (typeof WORKFLOW_CONDITION_FIELDS)[number];

export const WORKFLOW_CONDITION_OPERATORS = ["eq", "neq", "in", "not_in", "contains"] as const;

export type WorkflowConditionOperator = (typeof WORKFLOW_CONDITION_OPERATORS)[number];

export const WORKFLOW_ACTION_TYPES = [
  "change_status",
  "assign",
  "add_internal_comment",
  "create_notification",
  "sla_start",
  "sla_stop",
] as const;

export type WorkflowActionType = (typeof WORKFLOW_ACTION_TYPES)[number];

export interface WorkflowTrigger {
  type: WorkflowTriggerType;
  fromStatus?: string;
  toStatus?: string;
}

export interface WorkflowCondition {
  ordinal: number;
  field: WorkflowConditionField;
  operator: WorkflowConditionOperator;
  value: unknown;
}

export interface WorkflowAction {
  ordinal: number;
  type: WorkflowActionType;
  params: Record<string, unknown>;
}

export interface WorkflowDefinition {
  triggers: WorkflowTrigger[];
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function assertUniqueOrdinals(label: string, ordinals: number[]): void {
  const seen = new Set<number>();
  for (const ordinal of ordinals) {
    if (!isNonNegativeInt(ordinal)) {
      throw new Error(`${label} ordinal must be a non-negative integer`);
    }
    if (seen.has(ordinal)) {
      throw new Error(`Duplicate ${label} ordinal: ${ordinal}`);
    }
    seen.add(ordinal);
  }
}

function assertActionParams(action: WorkflowAction): void {
  const { params, type } = action;
  switch (type) {
    case "change_status":
      if (typeof params.status !== "string" || !params.status.trim()) {
        throw new Error("change_status action requires string params.status");
      }
      return;
    case "assign": {
      const hasUser = typeof params.assigneeUserId === "string" && params.assigneeUserId.length > 0;
      const hasGroup = typeof params.groupId === "string" && params.groupId.length > 0;
      if (!hasUser && !hasGroup) {
        throw new Error("assign action requires assigneeUserId and/or groupId");
      }
      return;
    }
    case "add_internal_comment":
      if (typeof params.body !== "string" || !params.body.trim()) {
        throw new Error("add_internal_comment action requires string params.body");
      }
      return;
    case "create_notification":
      if (typeof params.eventType !== "string" || !params.eventType.trim()) {
        throw new Error("create_notification action requires string params.eventType");
      }
      return;
    case "sla_start":
    case "sla_stop":
      if (
        params.targetType !== undefined &&
        params.targetType !== "response" &&
        params.targetType !== "resolution"
      ) {
        throw new Error(`${type} action targetType must be response or resolution when set`);
      }
      return;
    default:
      throw new Error(`Unknown action type: ${String(type)}`);
  }
}

export function assertValidWorkflowDefinition(definition: WorkflowDefinition): void {
  if (!Array.isArray(definition.triggers) || definition.triggers.length === 0) {
    throw new Error("At least one trigger is required");
  }
  if (!Array.isArray(definition.actions) || definition.actions.length === 0) {
    throw new Error("At least one action is required");
  }
  if (!Array.isArray(definition.conditions)) {
    throw new Error("conditions must be an array");
  }

  for (const trigger of definition.triggers) {
    if (!WORKFLOW_TRIGGER_TYPES.includes(trigger.type)) {
      throw new Error(`Unknown trigger type: ${String(trigger.type)}`);
    }
  }

  assertUniqueOrdinals(
    "condition",
    definition.conditions.map((condition) => condition.ordinal),
  );
  for (const condition of definition.conditions) {
    if (!WORKFLOW_CONDITION_FIELDS.includes(condition.field)) {
      throw new Error(`Unknown condition field: ${String(condition.field)}`);
    }
    if (!WORKFLOW_CONDITION_OPERATORS.includes(condition.operator)) {
      throw new Error(`Unknown condition operator: ${String(condition.operator)}`);
    }
  }

  const sortedActions = [...definition.actions].sort((a, b) => a.ordinal - b.ordinal);
  assertUniqueOrdinals(
    "action",
    sortedActions.map((action) => action.ordinal),
  );
  for (const action of sortedActions) {
    if (!WORKFLOW_ACTION_TYPES.includes(action.type)) {
      throw new Error(`Unknown action type: ${String(action.type)}`);
    }
    if (!action.params || typeof action.params !== "object" || Array.isArray(action.params)) {
      throw new Error("action params must be an object");
    }
    assertActionParams(action);
  }
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd apps/api && pnpm exec vitest run src/workflows/domain/workflow-definition.spec.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/workflows/domain/workflow-definition.ts apps/api/src/workflows/domain/workflow-definition.spec.ts
git commit -m "$(cat <<'EOF'
feat(workflows): add structural workflow definition validators

Introduce the E11-I01 catalog and pure schema checks before persistence.
EOF
)"
```

---

### Task 2: Prisma models, migrations, permissions, schema-guard

**Files:**

- Modify: `apps/api/prisma/schema.prisma` (add models; wire Tenant relations)
- Create: `apps/api/prisma/migrations/20260731180000_workflow_definition/migration.sql`
- Create: `apps/api/prisma/migrations/20260731181000_workflow_permissions/migration.sql`
- Modify: `apps/api/src/database/schema-guard.spec.ts`

**Interfaces:**

- Consumes: existing `ConfigPublicationState` enum
- Produces: Prisma models `Workflow`, `WorkflowVersion` mapped to `workflows`, `workflow_versions`

- [ ] **Step 1: Update schema-guard to expect workflows (fail until models exist)**

In `apps/api/src/database/schema-guard.spec.ts`:

1. Add `"workflows"` and `"workflow_versions"` to the `arrayContaining` foundation tables list.
2. Change the unimplemented deny-list from `["notification_intents", "reports", "workflows"]` to `["notification_intents", "reports", "workflow_executions"]` (execution tables remain deferred).

- [ ] **Step 2: Run schema-guard — expect FAIL**

```bash
cd apps/api && pnpm exec vitest run src/database/schema-guard.spec.ts
```

Expected: FAIL missing `workflows` / `workflow_versions`.

- [ ] **Step 3: Add Prisma models**

Append to `apps/api/prisma/schema.prisma` (and add `workflows Workflow[]` / `workflowVersions WorkflowVersion[]` on `Tenant`):

```prisma
model Workflow {
  id                  String             @id(map: "pk_workflows") @default(uuid()) @db.Uuid
  tenantId            String             @map("tenant_id") @db.Uuid
  key                 String             @db.VarChar(100)
  name                String             @db.VarChar(200)
  description         String?            @db.Text
  priority            Int
  enabled             Boolean            @default(true)
  pausedAt            DateTime?          @map("paused_at") @db.Timestamptz(3)
  pausedReason        String?            @map("paused_reason") @db.VarChar(500)
  activeVersionNumber Int?               @map("active_version_number")
  version             Int                @default(1)
  createdAt           DateTime           @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt           DateTime           @updatedAt @map("updated_at") @db.Timestamptz(3)
  deletedAt           DateTime?          @map("deleted_at") @db.Timestamptz(3)
  tenant              Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade, map: "fk_workflows__tenants__tenant_id")
  versions            WorkflowVersion[]

  @@unique([tenantId, key], map: "uq_workflows__tenant_id_key")
  @@index([tenantId, deletedAt], map: "idx_workflows__tenant_id_deleted_at")
  @@index([tenantId, enabled, priority], map: "idx_workflows__tenant_id_enabled_priority")
  @@map("workflows")
}

model WorkflowVersion {
  id            String                  @id(map: "pk_workflow_versions") @default(uuid()) @db.Uuid
  tenantId      String                  @map("tenant_id") @db.Uuid
  workflowId    String                  @map("workflow_id") @db.Uuid
  versionNumber Int                     @map("version_number")
  state         ConfigPublicationState  @default(DRAFT)
  triggers      Json
  conditions    Json                    @default("[]")
  actions       Json
  publishedAt   DateTime?               @map("published_at") @db.Timestamptz(3)
  createdAt     DateTime                @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt     DateTime                @updatedAt @map("updated_at") @db.Timestamptz(3)
  tenant        Tenant                  @relation(fields: [tenantId], references: [id], onDelete: Cascade, map: "fk_workflow_versions__tenants__tenant_id")
  workflow      Workflow                @relation(fields: [workflowId], references: [id], onDelete: Cascade, map: "fk_workflow_versions__workflows__workflow_id")

  @@unique([tenantId, workflowId, versionNumber], map: "uq_workflow_versions__tenant_workflow_version")
  @@index([tenantId, workflowId, state], map: "idx_workflow_versions__tenant_workflow_state")
  @@map("workflow_versions")
}
```

- [ ] **Step 4: Write SQL migrations**

`apps/api/prisma/migrations/20260731180000_workflow_definition/migration.sql` — create both tables with the same constraints/indexes as the Prisma models (UUID PKs, FKs to `tenants` / `workflows`, `config_publication_state` enum for `state`, JSON columns).

`apps/api/prisma/migrations/20260731181000_workflow_permissions/migration.sql`:

```sql
INSERT INTO "permissions" ("id", "key", "description", "is_system", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'workflow.read', 'Read workflow definitions and versions.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'workflow.create', 'Create workflow drafts.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'workflow.update', 'Update workflow drafts and soft-delete workflows.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'workflow.publish', 'Publish workflow versions.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'workflow.pause', 'Pause and resume published workflows.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
```

- [ ] **Step 5: Generate client and run schema-guard**

```bash
cd apps/api && pnpm exec prisma generate && pnpm exec vitest run src/database/schema-guard.spec.ts
```

Expected: PASS. If a local DB is available: `pnpm exec prisma migrate deploy`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260731180000_workflow_definition apps/api/prisma/migrations/20260731181000_workflow_permissions apps/api/src/database/schema-guard.spec.ts
git commit -m "$(cat <<'EOF'
feat(workflows): add workflow definition schema and permissions

Persist versioned workflow containers and seed RBAC keys for E11-I01.
EOF
)"
```

---

### Task 3: Repository and service (create / read / draft / publish)

**Files:**

- Create: `apps/api/src/workflows/workflows.repository.ts`
- Create: `apps/api/src/workflows/workflows.service.ts`
- Create: `apps/api/src/workflows/workflows.module.ts` (providers only for now; controller in Task 4)
- Modify: `apps/api/src/app.module.ts` (import module)

**Interfaces:**

- Consumes: `assertValidWorkflowDefinition`, `RbacService.can`, `buildAuditEventData` / repository `createAudit`
- Produces service methods:
  - `list(tenantId, actorUserId)`
  - `get(tenantId, workflowId, actorUserId)`
  - `create(input: CreateWorkflowInput)`
  - `updateDraft(input: UpdateWorkflowDraftInput)`
  - `publish(tenantId, workflowId, actorUserId, correlationId?)`

Mirror `SlaPoliciesService` transaction patterns from `apps/api/src/sla/sla-policies.service.ts`.

- [ ] **Step 1: Implement repository**

```typescript
import { Injectable } from "@nestjs/common";
import { ConfigPublicationState } from "@prisma/client";

import { type AuditEventInput, buildAuditEventData } from "../audit/audit-event";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class WorkflowsRepository {
  constructor(private readonly prisma: PrismaService) {}

  get client() {
    return this.prisma;
  }

  async createAudit(audit: AuditEventInput) {
    return this.prisma.auditEvent.create({ data: buildAuditEventData(audit) });
  }

  async findById(tenantId: string, id: string) {
    return this.prisma.workflow.findFirst({
      include: { versions: { orderBy: { versionNumber: "desc" } } },
      where: { deletedAt: null, id, tenantId },
    });
  }

  async findByKey(tenantId: string, key: string) {
    return this.prisma.workflow.findFirst({
      where: { deletedAt: null, key, tenantId },
    });
  }

  async findByPriority(tenantId: string, priority: number, excludeId?: string) {
    return this.prisma.workflow.findFirst({
      where: {
        deletedAt: null,
        priority,
        tenantId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async list(tenantId: string) {
    return this.prisma.workflow.findMany({
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 5,
        },
      },
      orderBy: [{ priority: "asc" }, { key: "asc" }],
      where: { deletedAt: null, tenantId },
    });
  }

  mapDefinitionJson(version: { actions: unknown; conditions: unknown; triggers: unknown }) {
    return {
      actions: version.actions,
      conditions: version.conditions,
      triggers: version.triggers,
    };
  }
}
```

- [ ] **Step 2: Implement service create/list/get/updateDraft/publish**

Key behaviors (must match spec):

1. `requirePermission` via `rbacService.can` → `ForbiddenException` on deny.
2. `create`: validate definition; conflict on key/priority; insert workflow + draft v1; audit `workflow.created`.
3. `updateDraft`: load workflow; ensure draft or clone latest → new draft; merge fields; re-validate definition; audit `workflow.draft_updated`; bump container `version`.
4. `publish`: require draft; retire other published; publish draft; set `activeVersionNumber`; audit `workflow.published`.
5. Response DTO mapper: snake-free camelCase JSON consistent with SLA responses (`id`, `key`, `name`, `priority`, `enabled`, `activeVersionNumber`, `versions: [...]`).

Store JSON via Prisma `Prisma.InputJsonValue` after `assertValidWorkflowDefinition`.

Map domain `Error` from validator → `BadRequestException`.

- [ ] **Step 3: Wire module + AppModule**

```typescript
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { RbacModule } from "../rbac/rbac.module";
import { WorkflowsRepository } from "./workflows.repository";
import { WorkflowsService } from "./workflows.service";

@Module({
  exports: [WorkflowsService, WorkflowsRepository],
  imports: [DatabaseModule, AuthModule, RbacModule],
  providers: [WorkflowsRepository, WorkflowsService],
})
export class WorkflowsModule {}
```

Import `WorkflowsModule` in `AppModule`.

- [ ] **Step 4: Smoke-compile**

```bash
cd apps/api && pnpm exec tsc -p tsconfig.build.json --noEmit
```

Expected: no type errors for workflows module.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/workflows apps/api/src/app.module.ts
git commit -m "$(cat <<'EOF'
feat(workflows): add draft and publish service layer

Support create, draft edit, and immutable publish without execution.
EOF
)"
```

---

### Task 4: Pause / resume / soft delete + HTTP controller + DTOs

**Files:**

- Create: `apps/api/src/workflows/dto/workflows.dto.ts`
- Create: `apps/api/src/workflows/workflows.controller.ts`
- Modify: `apps/api/src/workflows/workflows.service.ts`
- Modify: `apps/api/src/workflows/workflows.module.ts` (register controller)

**Interfaces:**

- Produces:
  - `pause(tenantId, workflowId, actorUserId, reason?, correlationId?)`
  - `resume(tenantId, workflowId, actorUserId, correlationId?)`
  - `softDelete(tenantId, workflowId, actorUserId, correlationId?)`
- Controller routes exactly as spec table under `@Controller("api/v1/workflows")` with `AuthAccessTokenGuard`.

- [ ] **Step 1: Add pause/resume/softDelete to service**

- Pause: if `!enabled` → `BadRequestException` ("Workflow is already paused"); set `enabled=false`, `pausedAt=now`, `pausedReason`; audit `workflow.paused`.
- Resume: if `enabled` → `BadRequestException` ("Workflow is not paused"); clear pause fields; audit `workflow.resumed`.
- Soft delete: set `deletedAt`; audit `workflow.deleted`. Do not delete version rows.

- [ ] **Step 2: DTOs**

Mirror SLA DTO helpers (`requireString`, `optionalString`, etc.) locally in `dto/workflows.dto.ts` or import shared helpers if already extracted (they are local to `sla.dto.ts` — duplicate the small helpers in workflows DTO to avoid cross-module coupling).

Swagger classes: `CreateWorkflowRequestDto`, `UpdateWorkflowDraftRequestDto`, `PauseWorkflowRequestDto` with `@ApiProperty` for `key`, `name`, `priority`, `triggers`, `conditions`, `actions`, `reason`.

- [ ] **Step 3: Controller**

Implement list/get/create/patch/publish/pause/resume/delete matching `SlaPoliciesController` auth context extraction (`getAuthenticatedRequestContext`, `getCorrelationId`).

Permission mapping:

- GET → service enforces `workflow.read`
- POST create → `workflow.create`
- PATCH / DELETE → `workflow.update`
- publish → `workflow.publish`
- pause/resume → `workflow.pause`

- [ ] **Step 4: Compile**

```bash
cd apps/api && pnpm exec tsc -p tsconfig.build.json --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/workflows
git commit -m "$(cat <<'EOF'
feat(workflows): expose workflow definition HTTP APIs

Add pause/resume/delete and OpenAPI-annotated controllers for E11-I01.
EOF
)"
```

---

### Task 5: PostgreSQL integration tests

**Files:**

- Create: `apps/api/src/workflows/workflows.integration.spec.ts`

**Interfaces:**

- Consumes: `WorkflowsService`, `PrismaRbacRepository`, `RbacService`, seeded permissions

- [ ] **Step 1: Write integration suite**

Pattern after `apps/api/src/sla/sla.integration.spec.ts`:

```typescript
const databaseUrl = process.env.DATABASE_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration("Workflow definition PostgreSQL integration", () => {
  // prisma cleanup: workflowVersion, workflow, auditEvent, rolePermission, userRole, role, user, tenant
  // seed tenantA/tenantB, admin with workflow.* permissions, agent without write perms

  it("creates a draft, publishes immutably, and versions a new draft", async () => {
    /* ... */
  });
  it("rejects duplicate key and duplicate priority", async () => {
    /* ... */
  });
  it("pauses and resumes without changing published JSON", async () => {
    /* ... */
  });
  it("soft-deletes while retaining versions", async () => {
    /* ... */
  });
  it("denies agent without workflow.create", async () => {
    /* ... */
  });
  it("isolates tenant B from tenant A workflows", async () => {
    /* ... */
  });
  it("writes audit events for create/publish/pause/resume/delete", async () => {
    /* ... */
  });
});
```

Assertions to include:

- After first publish: version state `PUBLISHED`, `activeVersionNumber === 1`.
- After edit+second publish: v1 `RETIRED`, v2 `PUBLISHED`; v1 `triggers`/`actions` unchanged bytes/JSON.
- Pause leaves version row JSON identical; `enabled === false`.
- Soft-deleted workflow `findById` returns null; raw prisma still finds versions.
- Agent create throws `ForbiddenException`.
- `get(tenantB, workflowIdFromA, ...)` → `NotFoundException`.

- [ ] **Step 2: Run integration tests**

```bash
cd apps/api && pnpm exec vitest run src/workflows/workflows.integration.spec.ts
```

Expected: PASS when `DATABASE_URL` set; skipped otherwise. Do not merge with failing DB tests if URL is configured in CI.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/workflows/workflows.integration.spec.ts
git commit -m "$(cat <<'EOF'
test(workflows): cover draft publish pause and tenant isolation

Prove E11-I01 lifecycle and RBAC against PostgreSQL.
EOF
)"
```

---

### Task 6: Documentation, ADR, OpenAPI coverage test

**Files:**

- Create: `docs/api/workflows.md`
- Create: `docs/adr/ADR-0007.md` (confirm next number vs existing ADRs on branch; SLA used ADR-0006)
- Create: `apps/api/src/workflows/workflows.openapi.spec.ts`
- Modify: `docs/api/README.md`, `docs/adr/README.md`, `docs/decision-log.md`, `docs/audit-events.md`, `docs/database/TABLES.md` (expand workflow column notes if thin)

- [ ] **Step 1: Write `docs/api/workflows.md`**

Table rows for every implemented endpoint from the spec, status `Implemented`. Explicit note: execution deferred to E11-I03; deep validation deferred to E11-I02.

- [ ] **Step 2: ADR-0007 — Workflow definition MVP**

Document: JSON-on-version storage; full catalog declared; pause vs retire; AND conditions; no execution; structural validation only. Link to design spec and `09-ticket-lifecycle.md`.

- [ ] **Step 3: Sync audit + decision log + API README**

Ensure audit actions include `workflow.created`, `workflow.draft_updated`, `workflow.resumed`, `workflow.deleted` alongside existing published/paused.

- [ ] **Step 4: OpenAPI doc coverage test**

```typescript
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Workflow OpenAPI documentation coverage", () => {
  const apiDoc = readFileSync(join(process.cwd(), "../../docs/api/workflows.md"), "utf8");

  it("documents CRUD publish pause resume delete", () => {
    expect(apiDoc).toContain("`GET /api/v1/workflows`");
    expect(apiDoc).toContain("`POST /api/v1/workflows`");
    expect(apiDoc).toContain("`PATCH /api/v1/workflows/{workflow_id}`");
    expect(apiDoc).toContain("`POST /api/v1/workflows/{workflow_id}/publish`");
    expect(apiDoc).toContain("`POST /api/v1/workflows/{workflow_id}/pause`");
    expect(apiDoc).toContain("`POST /api/v1/workflows/{workflow_id}/resume`");
    expect(apiDoc).toContain("`DELETE /api/v1/workflows/{workflow_id}`");
  });

  it("marks execution as deferred", () => {
    expect(apiDoc).toContain("E11-I03");
    expect(apiDoc).toContain("Deferred");
  });
});
```

- [ ] **Step 5: Run unit + openapi tests**

```bash
cd apps/api && pnpm exec vitest run src/workflows/domain/workflow-definition.spec.ts src/workflows/workflows.openapi.spec.ts src/database/schema-guard.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docs apps/api/src/workflows/workflows.openapi.spec.ts
git commit -m "$(cat <<'EOF'
docs(workflows): document E11-I01 definition APIs and ADR

Record publish semantics, audit actions, and deferred execution scope.
EOF
)"
```

---

## Spec coverage checklist

| Spec requirement                                  | Task                          |
| ------------------------------------------------- | ----------------------------- |
| Domain catalog + structural validation            | Task 1                        |
| `workflows` / `workflow_versions` + permissions   | Task 2                        |
| Create / draft edit / publish immutability        | Task 3                        |
| Pause / resume / soft delete + HTTP/RBAC          | Task 4                        |
| PostgreSQL integration + tenant isolation + audit | Task 5                        |
| OpenAPI docs + ADR + decision/audit sync          | Task 6                        |
| No execution engine                               | All tasks (explicit non-goal) |
| I02/I03 deferrals documented                      | Task 6                        |

## Self-review notes

- No TBD/placeholder steps remain.
- Types align: `WorkflowDefinition` → JSON columns → service validate → persist.
- Schema-guard deny-list updated so introducing `workflows` does not fight the old “unimplemented” assertion.
- Priority uniqueness is application-enforced among non-deleted rows (soft delete + unique DB constraint on priority would block key reuse patterns; do not add DB unique on priority).
