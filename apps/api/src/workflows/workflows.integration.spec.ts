import { randomUUID } from "node:crypto";

import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ConfigPublicationState, PrismaClient, RoleScope, UserState } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../database/prisma.service";
import { PrismaRbacRepository } from "../rbac/rbac.repository";
import { RbacService } from "../rbac/rbac.service";
import type {
  WorkflowAction,
  WorkflowCondition,
  WorkflowDefinition,
  WorkflowTrigger,
} from "./domain/workflow-definition";
import { WorkflowsRepository } from "./workflows.repository";
import { WorkflowsService } from "./workflows.service";

const databaseUrl = process.env.DATABASE_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;

const WORKFLOW_PERMISSIONS = [
  "workflow.read",
  "workflow.create",
  "workflow.update",
  "workflow.publish",
  "workflow.pause",
] as const;

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

describeIntegration("Workflow definition PostgreSQL integration", () => {
  const prisma = new PrismaClient();
  const prismaService = prisma as unknown as PrismaService;
  const rbacService = new RbacService(new PrismaRbacRepository(prismaService));
  const workflowsService = new WorkflowsService(
    new WorkflowsRepository(prismaService),
    rbacService,
  );

  let tenantA: string;
  let tenantB: string;
  let adminA: string;
  let adminB: string;
  let agentA: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.workflowVersion.deleteMany();
    await prisma.workflow.deleteMany();
    await prisma.slaEvaluation.deleteMany();
    await prisma.slaTarget.deleteMany();
    await prisma.slaPolicyVersion.deleteMany();
    await prisma.slaPolicy.deleteMany();
    await prisma.businessScheduleVersion.deleteMany();
    await prisma.businessSchedule.deleteMany();
    await prisma.notificationPreference.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.attachment.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.auditEvent.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.role.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();

    tenantA = randomUUID();
    tenantB = randomUUID();
    adminA = randomUUID();
    adminB = randomUUID();
    agentA = randomUUID();

    await prisma.tenant.createMany({
      data: [
        { id: tenantA, name: "Tenant A", slug: `wa-${tenantA.slice(0, 8)}` },
        { id: tenantB, name: "Tenant B", slug: `wb-${tenantB.slice(0, 8)}` },
      ],
    });

    await prisma.user.createMany({
      data: [
        {
          email: `admin-${adminA}@example.com`,
          emailNormalized: `admin-${adminA}@example.com`,
          id: adminA,
          passwordHash: "hash",
          state: UserState.ACTIVE,
        },
        {
          email: `admin-b-${adminB}@example.com`,
          emailNormalized: `admin-b-${adminB}@example.com`,
          id: adminB,
          passwordHash: "hash",
          state: UserState.ACTIVE,
        },
        {
          email: `agent-${agentA}@example.com`,
          emailNormalized: `agent-${agentA}@example.com`,
          id: agentA,
          passwordHash: "hash",
          state: UserState.ACTIVE,
        },
      ],
    });

    const adminRoleId = randomUUID();
    await prisma.role.create({
      data: {
        id: adminRoleId,
        key: "workflow-admin",
        name: "Workflow Admin",
        tenantId: tenantA,
      },
    });
    await prisma.userRole.create({
      data: { id: randomUUID(), roleId: adminRoleId, tenantId: tenantA, userId: adminA },
    });

    for (const key of WORKFLOW_PERMISSIONS) {
      const permission = await prisma.permission.upsert({
        create: {
          description: key,
          id: randomUUID(),
          isSystem: true,
          key,
        },
        update: {},
        where: { key },
      });
      await prisma.rolePermission.create({
        data: {
          id: randomUUID(),
          permissionId: permission.id,
          roleId: adminRoleId,
          scope: RoleScope.TENANT,
          tenantId: tenantA,
        },
      });
    }

    const adminBRoleId = randomUUID();
    await prisma.role.create({
      data: {
        id: adminBRoleId,
        key: "workflow-admin-b",
        name: "Workflow Admin B",
        tenantId: tenantB,
      },
    });
    await prisma.userRole.create({
      data: { id: randomUUID(), roleId: adminBRoleId, tenantId: tenantB, userId: adminB },
    });
    const readPermission = await prisma.permission.findUniqueOrThrow({
      where: { key: "workflow.read" },
    });
    await prisma.rolePermission.create({
      data: {
        id: randomUUID(),
        permissionId: readPermission.id,
        roleId: adminBRoleId,
        scope: RoleScope.TENANT,
        tenantId: tenantB,
      },
    });

    const agentRoleId = randomUUID();
    await prisma.role.create({
      data: {
        id: agentRoleId,
        key: "agent",
        name: "Agent",
        tenantId: tenantA,
      },
    });
    await prisma.userRole.create({
      data: { id: randomUUID(), roleId: agentRoleId, tenantId: tenantA, userId: agentA },
    });
    await prisma.rolePermission.create({
      data: {
        id: randomUUID(),
        permissionId: readPermission.id,
        roleId: agentRoleId,
        scope: RoleScope.TENANT,
        tenantId: tenantA,
      },
    });
  });

  async function createWorkflow(
    overrides: {
      key?: string;
      priority?: number;
      triggers?: WorkflowTrigger[];
      conditions?: WorkflowCondition[];
      actions?: WorkflowAction[];
    } = {},
  ) {
    const definition = validDefinition({
      ...(overrides.actions !== undefined ? { actions: overrides.actions } : {}),
      ...(overrides.conditions !== undefined ? { conditions: overrides.conditions } : {}),
      ...(overrides.triggers !== undefined ? { triggers: overrides.triggers } : {}),
    });
    return workflowsService.create({
      actions: definition.actions,
      actorUserId: adminA,
      conditions: definition.conditions,
      key: overrides.key ?? `wf-${randomUUID().slice(0, 8)}`,
      name: "Test Workflow",
      priority: overrides.priority ?? 100,
      tenantId: tenantA,
      triggers: definition.triggers,
    });
  }

  it("creates a draft, publishes immutably, and versions a new draft", async () => {
    const created = await createWorkflow({ key: "route-high", priority: 10 });
    expect(created.versions).toHaveLength(1);
    expect(created.versions[0]?.state).toBe(ConfigPublicationState.DRAFT);

    const firstPublished = await workflowsService.publish(tenantA, created.id, adminA);
    expect(firstPublished.activeVersionNumber).toBe(1);
    const v1Published = firstPublished.versions.find((version) => version.versionNumber === 1);
    expect(v1Published?.state).toBe(ConfigPublicationState.PUBLISHED);

    const v1Triggers = JSON.stringify(v1Published?.triggers);
    const v1Actions = JSON.stringify(v1Published?.actions);

    const revisedActions: WorkflowAction[] = [
      { ordinal: 0, params: { status: "pending" }, type: "change_status" },
      { ordinal: 1, params: { body: "revised" }, type: "add_internal_comment" },
    ];
    const draftUpdated = await workflowsService.updateDraft({
      actions: revisedActions,
      actorUserId: adminA,
      tenantId: tenantA,
      workflowId: created.id,
    });
    const v2Draft = draftUpdated.versions.find((version) => version.versionNumber === 2);
    expect(v2Draft?.state).toBe(ConfigPublicationState.DRAFT);

    const secondPublished = await workflowsService.publish(tenantA, created.id, adminA);
    expect(secondPublished.activeVersionNumber).toBe(2);

    const v1Retired = secondPublished.versions.find((version) => version.versionNumber === 1);
    const v2Published = secondPublished.versions.find((version) => version.versionNumber === 2);
    expect(v1Retired?.state).toBe(ConfigPublicationState.RETIRED);
    expect(v2Published?.state).toBe(ConfigPublicationState.PUBLISHED);
    expect(JSON.stringify(v1Retired?.triggers)).toBe(v1Triggers);
    expect(JSON.stringify(v1Retired?.actions)).toBe(v1Actions);
    expect(v2Published?.actions).toEqual(revisedActions);
  });

  it("rejects duplicate key and duplicate priority", async () => {
    await createWorkflow({ key: "unique-key", priority: 50 });

    const duplicateKey = createWorkflow({ key: "unique-key", priority: 51 });
    await expect(duplicateKey).rejects.toBeInstanceOf(ConflictException);

    const duplicatePriority = createWorkflow({ key: "other-key", priority: 50 });
    await expect(duplicatePriority).rejects.toBeInstanceOf(ConflictException);
  });

  it("pauses and resumes without changing published JSON", async () => {
    const created = await createWorkflow();
    await workflowsService.publish(tenantA, created.id, adminA);

    const beforePause = await prisma.workflowVersion.findFirst({
      where: { tenantId: tenantA, versionNumber: 1, workflowId: created.id },
    });
    const snapshot = {
      actions: JSON.stringify(beforePause?.actions),
      conditions: JSON.stringify(beforePause?.conditions),
      triggers: JSON.stringify(beforePause?.triggers),
    };

    const paused = await workflowsService.pause(tenantA, created.id, adminA, "maintenance");
    expect(paused.enabled).toBe(false);

    const afterPause = await prisma.workflowVersion.findFirst({
      where: { id: beforePause!.id },
    });
    expect(JSON.stringify(afterPause?.triggers)).toBe(snapshot.triggers);
    expect(JSON.stringify(afterPause?.conditions)).toBe(snapshot.conditions);
    expect(JSON.stringify(afterPause?.actions)).toBe(snapshot.actions);

    const resumed = await workflowsService.resume(tenantA, created.id, adminA);
    expect(resumed.enabled).toBe(true);

    const afterResume = await prisma.workflowVersion.findFirst({
      where: { id: beforePause!.id },
    });
    expect(JSON.stringify(afterResume?.triggers)).toBe(snapshot.triggers);
    expect(JSON.stringify(afterResume?.conditions)).toBe(snapshot.conditions);
    expect(JSON.stringify(afterResume?.actions)).toBe(snapshot.actions);
  });

  it("soft-deletes while retaining versions", async () => {
    const created = await createWorkflow();
    await workflowsService.publish(tenantA, created.id, adminA);

    await workflowsService.softDelete(tenantA, created.id, adminA);

    await expect(workflowsService.get(tenantA, created.id, adminA)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const rawWorkflow = await prisma.workflow.findFirst({ where: { id: created.id } });
    expect(rawWorkflow?.deletedAt).not.toBeNull();

    const versions = await prisma.workflowVersion.findMany({
      where: { workflowId: created.id },
    });
    expect(versions.length).toBeGreaterThanOrEqual(1);
  });

  it("denies agent without workflow.create", async () => {
    const definition = validDefinition();
    await expect(
      workflowsService.create({
        actions: definition.actions,
        actorUserId: agentA,
        conditions: definition.conditions,
        key: "agent-denied",
        name: "Agent Denied",
        priority: 200,
        tenantId: tenantA,
        triggers: definition.triggers,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("isolates tenant B from tenant A workflows", async () => {
    const created = await createWorkflow();

    await expect(workflowsService.get(tenantB, created.id, adminB)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("writes audit events for create/publish/pause/resume/delete", async () => {
    const created = await createWorkflow({ key: "audit-trail", priority: 300 });
    await workflowsService.publish(tenantA, created.id, adminA);
    await workflowsService.pause(tenantA, created.id, adminA, "hold");
    await workflowsService.resume(tenantA, created.id, adminA);
    await workflowsService.softDelete(tenantA, created.id, adminA);

    const actions = (
      await prisma.auditEvent.findMany({
        orderBy: { occurredAt: "asc" },
        where: { targetId: created.id, tenantId: tenantA },
      })
    ).map((event) => event.action);

    expect(actions).toContain("workflow.created");
    expect(actions).toContain("workflow.published");
    expect(actions).toContain("workflow.paused");
    expect(actions).toContain("workflow.resumed");
    expect(actions).toContain("workflow.deleted");
  });
});
