import { randomUUID } from "node:crypto";

import {
  NotificationChannel,
  NotificationEventType,
  PrismaClient,
  RoleScope,
  UserState,
} from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { cleanDatabase } from "../common/testing/clean-database";
import type { PrismaService } from "../database/prisma.service";
import { PrismaRbacRepository } from "../rbac/rbac.repository";
import { RbacService } from "../rbac/rbac.service";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationsService } from "./notifications.service";

const databaseUrl = process.env.DATABASE_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration("Notifications PostgreSQL integration", () => {
  const prisma = new PrismaClient();
  const prismaService = prisma as unknown as PrismaService;
  const rbacService = new RbacService(new PrismaRbacRepository(prismaService));
  const repository = new NotificationsRepository(prismaService);
  const service = new NotificationsService(repository, rbacService);

  let tenantA: string;
  let tenantB: string;
  let userA: string;
  let userB: string;
  let actor: string;

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
    userA = randomUUID();
    userB = randomUUID();
    actor = randomUUID();

    await prisma.tenant.createMany({
      data: [
        { id: tenantA, name: "Tenant A", slug: `na-${tenantA.slice(0, 8)}` },
        { id: tenantB, name: "Tenant B", slug: `nb-${tenantB.slice(0, 8)}` },
      ],
    });

    await prisma.user.createMany({
      data: [
        {
          email: `a-${userA}@example.com`,
          emailNormalized: `a-${userA}@example.com`,
          id: userA,
          passwordHash: "hash",
          state: UserState.ACTIVE,
        },
        {
          email: `b-${userB}@example.com`,
          emailNormalized: `b-${userB}@example.com`,
          id: userB,
          passwordHash: "hash",
          state: UserState.ACTIVE,
        },
        {
          email: `actor-${actor}@example.com`,
          emailNormalized: `actor-${actor}@example.com`,
          id: actor,
          passwordHash: "hash",
          state: UserState.ACTIVE,
        },
      ],
    });
  });

  it("creates, lists, counts, marks read, and isolates tenants", async () => {
    const created = await service.create({
      actorUserId: actor,
      body: "You were assigned",
      eventType: NotificationEventType.TICKET_ASSIGNED,
      recipientUserId: userA,
      resourceId: randomUUID(),
      resourceType: "ticket",
      tenantId: tenantA,
      title: "Ticket assigned",
    });
    expect(created).not.toBeNull();

    await service.create({
      actorUserId: actor,
      eventType: NotificationEventType.TICKET_STATUS_CHANGED,
      recipientUserId: userB,
      tenantId: tenantB,
      title: "Other tenant",
    });

    const listed = await service.listForUser({
      page: 1,
      pageSize: 20,
      recipientUserId: userA,
      sort: { direction: "desc", field: "createdAt" },
      tenantId: tenantA,
    });
    expect(listed.totalRecords).toBe(1);
    expect(listed.items[0]?.title).toBe("Ticket assigned");

    const unread = await service.countUnread(tenantA, userA);
    expect(unread).toBe(1);

    const updated = await service.updateOwnNotification({
      actorUserId: userA,
      notificationId: created!.id,
      read: true,
      tenantId: tenantA,
      version: 1,
    });
    expect(updated.isRead).toBe(true);
    expect(await service.countUnread(tenantA, userA)).toBe(0);

    const crossTenant = await service.listForUser({
      page: 1,
      pageSize: 20,
      recipientUserId: userA,
      sort: { direction: "desc", field: "createdAt" },
      tenantId: tenantB,
    });
    expect(crossTenant.totalRecords).toBe(0);

    await expect(
      prisma.auditEvent.count({
        where: { action: "notification.read", tenantId: tenantA },
      }),
    ).resolves.toBe(1);
  });

  it("honors preferences and blocks mandatory disable", async () => {
    await service.updatePreferences({
      actorUserId: userA,
      preferences: [
        {
          channel: NotificationChannel.IN_APP,
          enabled: false,
          eventType: NotificationEventType.TICKET_ASSIGNED,
        },
      ],
      targetUserId: userA,
      tenantId: tenantA,
    });

    const suppressed = await service.create({
      actorUserId: actor,
      eventType: NotificationEventType.TICKET_ASSIGNED,
      recipientUserId: userA,
      tenantId: tenantA,
      title: "Should suppress",
    });
    expect(suppressed).toBeNull();

    await expect(
      service.updatePreferences({
        actorUserId: userA,
        preferences: [
          {
            channel: NotificationChannel.IN_APP,
            enabled: false,
            eventType: NotificationEventType.AUTH_SESSION_REVOKED,
          },
        ],
        targetUserId: userA,
        tenantId: tenantA,
      }),
    ).rejects.toThrow(/Mandatory notification event/);

    const prefs = await service.getPreferences(tenantA, userA, userA);
    const assigned = prefs.preferences.find(
      (item) => item.eventType === NotificationEventType.TICKET_ASSIGNED,
    );
    expect(assigned?.enabled).toBe(false);
  });

  it("allows tenant-scoped preference read with RBAC grant", async () => {
    const roleId = randomUUID();
    await prisma.role.create({
      data: { id: roleId, isSystem: true, key: "admin", name: "Admin", tenantId: tenantA },
    });
    await prisma.userRole.create({
      data: { roleId, tenantId: tenantA, userId: actor },
    });
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { key: "notification.preference.read" },
    });
    await prisma.rolePermission.create({
      data: {
        permissionId: permission.id,
        roleId,
        scope: RoleScope.TENANT,
        tenantId: tenantA,
      },
    });

    const prefs = await service.getPreferences(tenantA, userA, actor);
    expect(prefs.userId).toBe(userA);
  });
});
