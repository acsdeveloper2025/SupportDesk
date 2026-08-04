import { randomUUID } from "node:crypto";

import {
  PrismaClient,
  RoleScope,
  SlaTargetState,
  SlaTargetType,
  TicketPriority,
  TicketStatus,
  UserState,
} from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { cleanDatabase } from "../common/testing/clean-database";
import type { PrismaService } from "../database/prisma.service";
import { NotificationsRepository } from "../notifications/notifications.repository";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaRbacRepository } from "../rbac/rbac.repository";
import { RbacService } from "../rbac/rbac.service";
import { CommentsRepository } from "../ticketing/comments.repository";
import { CommentsService } from "../ticketing/comments.service";
import { TicketsRepository } from "../ticketing/tickets.repository";
import { TicketsService } from "../ticketing/tickets.service";
import { BusinessSchedulesService } from "./business-schedules.service";
import { standardWeekdayNineToFive } from "./domain/schedule.types";
import { SlaRepository } from "./sla.repository";
import { SlaEngineService } from "./sla-engine.service";
import { SlaPoliciesService } from "./sla-policies.service";

const databaseUrl = process.env.DATABASE_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration("SLA PostgreSQL integration", () => {
  const prisma = new PrismaClient();
  const prismaService = prisma as unknown as PrismaService;
  const rbacService = new RbacService(new PrismaRbacRepository(prismaService));
  const notificationsService = new NotificationsService(
    new NotificationsRepository(prismaService),
    rbacService,
  );
  const slaRepository = new SlaRepository(prismaService);
  const slaEngine = new SlaEngineService(slaRepository, notificationsService);
  const schedulesService = new BusinessSchedulesService(slaRepository, rbacService);
  const policiesService = new SlaPoliciesService(slaRepository, rbacService);
  const ticketsRepository = new TicketsRepository(prismaService);
  const commentsRepository = new CommentsRepository(prismaService);
  const ticketsService = new TicketsService(ticketsRepository, notificationsService, slaEngine);
  const commentsService = new CommentsService(
    commentsRepository,
    ticketsRepository,
    rbacService,
    notificationsService,
    slaEngine,
  );

  let tenantA: string;
  let tenantB: string;
  let adminA: string;
  let agentA: string;
  let requesterA: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    tenantA = randomUUID();
    tenantB = randomUUID();
    adminA = randomUUID();
    agentA = randomUUID();
    requesterA = randomUUID();

    await prisma.tenant.createMany({
      data: [
        { id: tenantA, name: "Tenant A", slug: `sa-${tenantA.slice(0, 8)}` },
        { id: tenantB, name: "Tenant B", slug: `sb-${tenantB.slice(0, 8)}` },
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
          email: `agent-${agentA}@example.com`,
          emailNormalized: `agent-${agentA}@example.com`,
          id: agentA,
          passwordHash: "hash",
          state: UserState.ACTIVE,
        },
        {
          email: `req-${requesterA}@example.com`,
          emailNormalized: `req-${requesterA}@example.com`,
          id: requesterA,
          passwordHash: "hash",
          state: UserState.ACTIVE,
        },
      ],
    });

    const roleId = randomUUID();
    await prisma.role.create({
      data: {
        id: roleId,
        key: "sla-admin",
        name: "SLA Admin",
        tenantId: tenantA,
      },
    });

    await prisma.userRole.create({
      data: {
        id: randomUUID(),
        roleId,
        tenantId: tenantA,
        userId: adminA,
      },
    });

    for (const key of [
      "sla.read",
      "sla.update",
      "ticket.create",
      "ticket.read",
      "ticket.transition",
      "ticket.comment.public.create",
      "ticket.comment.read",
    ]) {
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
          roleId,
          scope: RoleScope.TENANT,
          tenantId: tenantA,
        },
      });
    }

    // Agent role for comments
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
    for (const key of ["ticket.comment.public.create", "ticket.comment.read", "ticket.read"]) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key } });
      await prisma.rolePermission.create({
        data: {
          id: randomUUID(),
          permissionId: permission.id,
          roleId: agentRoleId,
          scope: RoleScope.TENANT,
          tenantId: tenantA,
        },
      });
    }
  });

  async function publishDefaultScheduleAndPolicy() {
    const schedule = await schedulesService.create({
      actorUserId: adminA,
      name: "Default",
      tenantId: tenantA,
      timeZone: "UTC",
      weeklyHours: standardWeekdayNineToFive(),
    });
    await schedulesService.publish(tenantA, schedule!.id, adminA);

    const policy = await policiesService.create({
      actorUserId: adminA,
      key: "default",
      name: "Default SLA",
      priority: 100,
      resolutionMinutes: 240,
      responseMinutes: 60,
      tenantId: tenantA,
    });
    await policiesService.publish(tenantA, policy!.id, adminA);
  }

  it("isolates schedules by tenant", async () => {
    await schedulesService.create({
      actorUserId: adminA,
      name: "Default",
      tenantId: tenantA,
      timeZone: "UTC",
    });

    const listB = await schedulesService.list(tenantB, adminA).catch((error: unknown) => error);
    // adminA lacks tenant B membership/permissions
    expect(listB).toBeInstanceOf(Error);
  });

  it("starts response and resolution targets on ticket create", async () => {
    await publishDefaultScheduleAndPolicy();

    const ticket = await ticketsService.createTicket({
      description: "Need help",
      priority: TicketPriority.HIGH,
      requesterUserId: requesterA,
      tenantId: tenantA,
      title: "Help",
    });

    const targets = await prisma.slaTarget.findMany({
      where: { tenantId: tenantA, ticketId: ticket.id },
    });
    expect(targets).toHaveLength(2);
    expect(targets.map((target) => target.type).sort()).toEqual([
      SlaTargetType.RESOLUTION,
      SlaTargetType.RESPONSE,
    ]);
    expect(targets.every((target) => target.state === SlaTargetState.RUNNING)).toBe(true);

    const audits = await prisma.auditEvent.findMany({
      where: { action: "sla.target_created", tenantId: tenantA },
    });
    expect(audits.length).toBeGreaterThanOrEqual(2);
  });

  it("pauses on pending and resumes on open", async () => {
    await publishDefaultScheduleAndPolicy();

    const ticket = await ticketsService.createTicket({
      description: "Need help",
      requesterUserId: requesterA,
      tenantId: tenantA,
      title: "Help",
    });

    await ticketsService.transitionStatus({
      actorUserId: adminA,
      expectedVersion: ticket.version,
      newStatus: TicketStatus.OPEN,
      ticketId: ticket.id,
      tenantId: tenantA,
    });

    const opened = await ticketsService.getTicketById(tenantA, ticket.id);
    await ticketsService.transitionStatus({
      actorUserId: adminA,
      expectedVersion: opened.version,
      newStatus: TicketStatus.PENDING,
      ticketId: ticket.id,
      tenantId: tenantA,
    });

    let targets = await prisma.slaTarget.findMany({
      where: { state: SlaTargetState.PAUSED, tenantId: tenantA, ticketId: ticket.id },
    });
    expect(targets.length).toBe(2);

    const pending = await ticketsService.getTicketById(tenantA, ticket.id);
    await ticketsService.transitionStatus({
      actorUserId: adminA,
      expectedVersion: pending.version,
      newStatus: TicketStatus.OPEN,
      ticketId: ticket.id,
      tenantId: tenantA,
    });

    targets = await prisma.slaTarget.findMany({
      where: { state: SlaTargetState.RUNNING, tenantId: tenantA, ticketId: ticket.id },
    });
    expect(targets.length).toBe(2);

    const pauseAudits = await prisma.auditEvent.count({
      where: { action: "sla.paused", tenantId: tenantA },
    });
    const resumeAudits = await prisma.auditEvent.count({
      where: { action: "sla.resumed", tenantId: tenantA },
    });
    expect(pauseAudits).toBeGreaterThanOrEqual(2);
    expect(resumeAudits).toBeGreaterThanOrEqual(2);
  });

  it("completes response SLA on public agent comment and resolution on solved", async () => {
    await publishDefaultScheduleAndPolicy();

    const ticket = await ticketsService.createTicket({
      description: "Need help",
      requesterUserId: requesterA,
      tenantId: tenantA,
      title: "Help",
    });

    await commentsService.createComment(
      tenantA,
      ticket.id,
      { body: "We are looking into this." },
      agentA,
    );

    const response = await prisma.slaTarget.findFirst({
      where: {
        tenantId: tenantA,
        ticketId: ticket.id,
        type: SlaTargetType.RESPONSE,
      },
    });
    expect(response?.state).toBe(SlaTargetState.MET);

    const current = await ticketsService.getTicketById(tenantA, ticket.id);
    await ticketsService.transitionStatus({
      actorUserId: adminA,
      expectedVersion: current.version,
      newStatus: TicketStatus.OPEN,
      ticketId: ticket.id,
      tenantId: tenantA,
    });
    const opened = await ticketsService.getTicketById(tenantA, ticket.id);
    await ticketsService.transitionStatus({
      actorUserId: adminA,
      expectedVersion: opened.version,
      newStatus: TicketStatus.SOLVED,
      ticketId: ticket.id,
      tenantId: tenantA,
    });

    const resolution = await prisma.slaTarget.findFirst({
      where: {
        tenantId: tenantA,
        ticketId: ticket.id,
        type: SlaTargetType.RESOLUTION,
      },
    });
    expect(resolution?.state).toBe(SlaTargetState.MET);
  });

  it("marks targets breached when dueAt is in the past on status read", async () => {
    await publishDefaultScheduleAndPolicy();

    const ticket = await ticketsService.createTicket({
      description: "Need help",
      requesterUserId: requesterA,
      tenantId: tenantA,
      title: "Help",
    });

    const past = new Date(Date.now() - 60_000);
    await prisma.slaTarget.updateMany({
      data: { dueAt: past },
      where: { ticketId: ticket.id },
    });

    const status = await slaEngine.getTicketSlaStatus(tenantA, ticket.id);
    expect(status?.every((target) => target.state === SlaTargetState.BREACHED)).toBe(true);

    const breachAudits = await prisma.auditEvent.count({
      where: { action: "sla.breached", tenantId: tenantA },
    });
    expect(breachAudits).toBeGreaterThanOrEqual(2);
  });
});
