import { randomUUID } from "node:crypto";

import {
  CommentVisibility,
  PrismaClient,
  RoleScope,
  TicketPriority,
  TicketStatus,
  UserState,
} from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../database/prisma.service";
import { PrismaRbacRepository } from "../rbac/rbac.repository";
import { RbacService } from "../rbac/rbac.service";
import { CommentsRepository } from "./comments.repository";
import { CommentsService } from "./comments.service";
import { TicketConcurrencyException } from "./domain/ticket.aggregate";
import { TicketsRepository } from "./tickets.repository";
import { TicketsService } from "./tickets.service";

const databaseUrl = process.env.DATABASE_URL;

const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration("Ticketing PostgreSQL integration", () => {
  const prisma = new PrismaClient();
  const prismaService = prisma as unknown as PrismaService;
  const ticketsRepository = new TicketsRepository(prismaService);
  const commentsRepository = new CommentsRepository(prismaService);
  const rbacRepository = new PrismaRbacRepository(prismaService);
  const rbacService = new RbacService(rbacRepository);
  const ticketsService = new TicketsService(ticketsRepository);
  const commentsService = new CommentsService(commentsRepository, ticketsRepository, rbacService);

  let tenantA: string;
  let tenantB: string;
  let userA: string;
  let userB: string;
  let roleA: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
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
    userA = randomUUID();
    userB = randomUUID();
    roleA = randomUUID();

    await prisma.tenant.createMany({
      data: [
        { id: tenantA, name: "Tenant A", slug: `tenant-a-${tenantA.slice(0, 8)}` },
        { id: tenantB, name: "Tenant B", slug: `tenant-b-${tenantB.slice(0, 8)}` },
      ],
    });

    await prisma.user.createMany({
      data: [
        {
          email: `user-a-${userA}@example.com`,
          emailNormalized: `user-a-${userA}@example.com`,
          id: userA,
          passwordHash: "hash",
          state: UserState.ACTIVE,
        },
        {
          email: `user-b-${userB}@example.com`,
          emailNormalized: `user-b-${userB}@example.com`,
          id: userB,
          passwordHash: "hash",
          state: UserState.ACTIVE,
        },
      ],
    });

    await prisma.role.create({
      data: {
        id: roleA,
        isSystem: true,
        key: "agent",
        name: "Agent",
        tenantId: tenantA,
      },
    });

    await prisma.userRole.create({
      data: {
        roleId: roleA,
        tenantId: tenantA,
        userId: userA,
      },
    });

    const permissionKeys = [
      "ticket.create",
      "ticket.read",
      "ticket.update",
      "ticket.assign",
      "ticket.transition",
      "ticket.comment.public.create",
      "ticket.comment.internal.create",
      "ticket.comment.read",
      "ticket.comment.internal.read",
      "ticket.comment.update",
      "ticket.comment.delete",
    ];

    for (const key of permissionKeys) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key } });
      await prisma.rolePermission.create({
        data: {
          permissionId: permission.id,
          roleId: roleA,
          scope: RoleScope.TENANT,
          tenantId: tenantA,
        },
      });
    }
  });

  it("creates, reads, updates, assigns, transitions, and comments with atomic audits", async () => {
    const created = await ticketsService.createTicket({
      description: "VPN drops every hour",
      priority: TicketPriority.HIGH,
      requesterUserId: userA,
      tenantId: tenantA,
      title: "VPN drop",
    });

    expect(created.publicRef).toMatch(/^TKT-/);
    expect(
      await prisma.auditEvent.count({ where: { action: "ticket.created", tenantId: tenantA } }),
    ).toBe(1);

    const byId = await ticketsService.getTicketById(tenantA, created.id);
    expect(byId.title).toBe("VPN drop");

    const updated = await ticketsService.updateTicket({
      actorUserId: userA,
      expectedVersion: created.version,
      tenantId: tenantA,
      ticketId: created.id,
      title: "VPN drop (updated)",
    });
    expect(updated.title).toBe("VPN drop (updated)");
    expect(updated.version).toBe(2);

    const assigned = await ticketsService.assignTicket({
      actorUserId: userA,
      assigneeUserId: userA,
      expectedVersion: updated.version,
      tenantId: tenantA,
      ticketId: created.id,
    });
    expect(assigned.assigneeUserId).toBe(userA);

    const transitioned = await ticketsService.transitionStatus({
      actorUserId: userA,
      expectedVersion: assigned.version,
      newStatus: TicketStatus.OPEN,
      tenantId: tenantA,
      ticketId: created.id,
    });
    expect(transitioned.status).toBe(TicketStatus.OPEN);

    const comment = await commentsService.createComment(
      tenantA,
      created.id,
      { body: "Looking into this", visibility: CommentVisibility.PUBLIC },
      userA,
    );
    expect(comment.body).toBe("Looking into this");
    expect(
      await prisma.auditEvent.count({
        where: { action: "ticket.comment.created", tenantId: tenantA },
      }),
    ).toBe(1);
  });

  it("enforces tenant isolation for ticket reads", async () => {
    const created = await ticketsService.createTicket({
      description: "Tenant A only",
      requesterUserId: userA,
      tenantId: tenantA,
      title: "Isolated",
    });

    await expect(ticketsService.getTicketById(tenantB, created.id)).rejects.toThrow(/not found/i);
  });

  it("enforces optimistic concurrency on updates", async () => {
    const created = await ticketsService.createTicket({
      description: "Concurrency check",
      requesterUserId: userA,
      tenantId: tenantA,
      title: "Versioned",
    });

    await expect(
      ticketsService.updateTicket({
        actorUserId: userA,
        expectedVersion: 999,
        tenantId: tenantA,
        ticketId: created.id,
        title: "Should fail",
      }),
    ).rejects.toBeInstanceOf(TicketConcurrencyException);
  });

  it("seeds canonical ticketing permissions", async () => {
    const keys = await prisma.permission.findMany({
      select: { key: true },
      where: {
        key: {
          in: [
            "ticket.create",
            "ticket.read",
            "ticket.update",
            "ticket.assign",
            "ticket.transition",
            "ticket.comment.public.create",
            "ticket.comment.read",
          ],
        },
      },
    });

    expect(keys.map((row) => row.key).sort()).toEqual([
      "ticket.assign",
      "ticket.comment.public.create",
      "ticket.comment.read",
      "ticket.create",
      "ticket.read",
      "ticket.transition",
      "ticket.update",
    ]);
    expect(await prisma.permission.count({ where: { key: "ticket.status_change" } })).toBe(0);
    expect(await prisma.permission.count({ where: { key: "comment.read" } })).toBe(0);
  });
});
