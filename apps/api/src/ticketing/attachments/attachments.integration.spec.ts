import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { PrismaClient, RoleScope, UserState, VirusScanStatus } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../database/prisma.service";
import { NotificationsRepository } from "../../notifications/notifications.repository";
import { NotificationsService } from "../../notifications/notifications.service";
import { PrismaRbacRepository } from "../../rbac/rbac.repository";
import { RbacService } from "../../rbac/rbac.service";
import { TicketsRepository } from "../tickets.repository";
import { TicketsService } from "../tickets.service";
import { AttachmentsRepository } from "./attachments.repository";
import { AttachmentsService } from "./attachments.service";
import { LocalAttachmentStorage } from "./local-attachment-storage";
import { NoOpVirusScanner } from "./virus-scanner";

const databaseUrl = process.env.DATABASE_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration("Attachments PostgreSQL integration", () => {
  const prisma = new PrismaClient();
  const prismaService = prisma as unknown as PrismaService;

  let storageRoot: string;
  let storage: LocalAttachmentStorage;
  let ticketsService: TicketsService;
  let attachmentsService: AttachmentsService;

  let tenantA: string;
  let tenantB: string;
  let userA: string;
  let userB: string;
  let roleA: string;
  let roleB: string;

  beforeAll(async () => {
    await prisma.$connect();
    storageRoot = await mkdtemp(path.join(tmpdir(), "sd-att-int-"));
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await rm(storageRoot, { force: true, recursive: true });
  });

  beforeEach(async () => {
    await prisma.notificationPreference.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.attachment.deleteMany();
    await prisma.comment.deleteMany();
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
    roleB = randomUUID();

    storage = new LocalAttachmentStorage(storageRoot);
    const ticketsRepository = new TicketsRepository(prismaService);
    const attachmentsRepository = new AttachmentsRepository(prismaService);
    const rbacService = new RbacService(new PrismaRbacRepository(prismaService));
    const notificationsService = new NotificationsService(
      new NotificationsRepository(prismaService),
      rbacService,
    );
    ticketsService = new TicketsService(ticketsRepository, notificationsService);
    attachmentsService = new AttachmentsService(
      attachmentsRepository,
      ticketsRepository,
      storage,
      new NoOpVirusScanner(),
      rbacService,
      notificationsService,
    );

    await prisma.tenant.createMany({
      data: [
        { id: tenantA, name: "Tenant A", slug: `ta-${tenantA.slice(0, 8)}` },
        { id: tenantB, name: "Tenant B", slug: `tb-${tenantB.slice(0, 8)}` },
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
      ],
    });

    await prisma.role.createMany({
      data: [
        { id: roleA, isSystem: true, key: "agent", name: "Agent", tenantId: tenantA },
        { id: roleB, isSystem: true, key: "agent", name: "Agent", tenantId: tenantB },
      ],
    });

    await prisma.userRole.createMany({
      data: [
        { roleId: roleA, tenantId: tenantA, userId: userA },
        { roleId: roleB, tenantId: tenantB, userId: userB },
      ],
    });

    for (const [tenantId, roleId, userId] of [
      [tenantA, roleA, userA],
      [tenantB, roleB, userB],
    ] as const) {
      void userId;
      for (const key of [
        "ticket.create",
        "ticket.read",
        "ticket.attachment.create",
        "ticket.attachment.read",
        "ticket.attachment.delete",
      ]) {
        const permission = await prisma.permission.findUniqueOrThrow({ where: { key } });
        await prisma.rolePermission.create({
          data: {
            permissionId: permission.id,
            roleId,
            scope: RoleScope.TENANT,
            tenantId,
          },
        });
      }
    }
  });

  it("uploads, lists, downloads, and soft-deletes attachments", async () => {
    const ticket = await ticketsService.createTicket({
      description: "Need file",
      requesterUserId: userA,
      tenantId: tenantA,
      title: "Attachment ticket",
    });

    const buffer = Buffer.from("%PDF-1.4 hello");
    const uploaded = await attachmentsService.upload({
      actorUserId: userA,
      buffer,
      mimeType: "application/pdf",
      originalFilename: "hello.pdf",
      size: buffer.length,
      tenantId: tenantA,
      ticketId: ticket.id,
    });

    expect(uploaded.virusScanStatus).toBe(VirusScanStatus.CLEAN);
    expect(uploaded.storedFilename).not.toBe("hello.pdf");
    expect(
      await prisma.auditEvent.count({
        where: { action: "attachment.uploaded", tenantId: tenantA },
      }),
    ).toBe(1);

    const listed = await attachmentsService.list(tenantA, ticket.id, userA);
    expect(listed).toHaveLength(1);

    const download = await attachmentsService.getDownload(tenantA, uploaded.id, userA);
    const parts: Uint8Array[] = [];
    for await (const chunk of download.stream) {
      parts.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    expect(Buffer.concat(parts).toString("utf8")).toContain("%PDF-1.4 hello");

    await attachmentsService.softDelete(tenantA, uploaded.id, userA, "cleanup");
    expect(
      await prisma.auditEvent.count({ where: { action: "attachment.deleted", tenantId: tenantA } }),
    ).toBe(1);
    expect(await attachmentsService.list(tenantA, ticket.id, userA)).toHaveLength(0);
  });

  it("enforces tenant isolation on download", async () => {
    const ticket = await ticketsService.createTicket({
      description: "A",
      requesterUserId: userA,
      tenantId: tenantA,
      title: "A",
    });
    const buffer = Buffer.from("plain text");
    const uploaded = await attachmentsService.upload({
      actorUserId: userA,
      buffer,
      mimeType: "text/plain",
      originalFilename: "note.txt",
      size: buffer.length,
      tenantId: tenantA,
      ticketId: ticket.id,
    });

    await expect(attachmentsService.getDownload(tenantB, uploaded.id, userB)).rejects.toThrow(
      /not found/i,
    );
  });

  it("rejects invalid MIME and oversized uploads", async () => {
    const ticket = await ticketsService.createTicket({
      description: "A",
      requesterUserId: userA,
      tenantId: tenantA,
      title: "A",
    });

    await expect(
      attachmentsService.upload({
        actorUserId: userA,
        buffer: Buffer.from("MZ"),
        mimeType: "application/x-msdownload",
        originalFilename: "bad.exe",
        size: 2,
        tenantId: tenantA,
        ticketId: ticket.id,
      }),
    ).rejects.toThrow(/extension|MIME/i);

    await expect(
      attachmentsService.upload({
        actorUserId: userA,
        buffer: Buffer.alloc(11 * 1024 * 1024),
        mimeType: "application/pdf",
        originalFilename: "big.pdf",
        size: 11 * 1024 * 1024,
        tenantId: tenantA,
        ticketId: ticket.id,
      }),
    ).rejects.toThrow(/maximum size/i);
  });

  it("rejects unauthorized actors without attachment permissions", async () => {
    const ticket = await ticketsService.createTicket({
      description: "A",
      requesterUserId: userA,
      tenantId: tenantA,
      title: "A",
    });

    await prisma.rolePermission.deleteMany({ where: { tenantId: tenantA } });

    await expect(
      attachmentsService.upload({
        actorUserId: userA,
        buffer: Buffer.from("x"),
        mimeType: "text/plain",
        originalFilename: "x.txt",
        size: 1,
        tenantId: tenantA,
        ticketId: ticket.id,
      }),
    ).rejects.toThrow(/permission/i);
  });
});
