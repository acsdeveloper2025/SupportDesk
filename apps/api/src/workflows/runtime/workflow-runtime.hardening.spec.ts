import { randomUUID } from "node:crypto";

import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { TicketChannel, TicketPriority, TicketStatus, TicketType } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma.service";
import { OutboxRepository } from "../../outbox/outbox.repository";
import { OutboxPublisherService } from "../../outbox/outbox-publisher.service";
import { RbacService } from "../../rbac/rbac.service";
import { AddCommentActionExecutor } from "./action-executors/add-comment-action.executor";
import { AssignActionExecutor } from "./action-executors/assign-action.executor";
import { ChangeAssetStatusActionExecutor } from "./action-executors/change-asset-status-action.executor";
import { ChangeStatusActionExecutor } from "./action-executors/change-status-action.executor";
import { CreateNotificationActionExecutor } from "./action-executors/create-notification-action.executor";
import { SlaActionExecutor } from "./action-executors/sla-action.executor";
import { WorkflowExecutorService } from "./workflow-executor.service";

const databaseUrl = process.env.DATABASE_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration("Workflow Runtime Hardening & End-to-End Specs", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let outboxRepository: OutboxRepository;
  let outboxPublisher: OutboxPublisherService;

  let tenantId: string;
  let userId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    const rbacService = moduleRef.get(RbacService);
    vi.spyOn(rbacService, "can").mockResolvedValue(true);

    outboxRepository = new OutboxRepository(prisma);
    outboxPublisher = new OutboxPublisherService();

    new WorkflowExecutorService(
      prisma,
      new ChangeStatusActionExecutor(outboxPublisher),
      new ChangeAssetStatusActionExecutor(outboxPublisher),
      new AssignActionExecutor(outboxPublisher),
      new AddCommentActionExecutor(outboxPublisher),
      new CreateNotificationActionExecutor(),
      new SlaActionExecutor(),
    );
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  beforeEach(async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: `Hardening Tenant ${Date.now()}`,
        slug: `hardening-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      },
    });
    tenantId = tenant.id;

    const user = await prisma.user.create({
      data: {
        email: `hardened-user-${Date.now()}@example.com`,
        emailNormalized: `hardened-user-${Date.now()}@example.com`,
        passwordHash: "hash",
        state: "ACTIVE",
      },
    });
    userId = user.id;

    await prisma.ticket.create({
      data: {
        tenantId,
        publicRef: `HT-${Date.now()}`,
        title: "Hardening Test Ticket",
        description: "Hardening Test",
        status: TicketStatus.OPEN,
        priority: TicketPriority.MEDIUM,
        channel: TicketChannel.WEB,
        type: TicketType.QUESTION,
        requesterUserId: userId,
      },
    });
  });

  it("handles outbox claim cleanly", async () => {
    const aggregateId = randomUUID();
    const event = await outboxPublisher.appendOutboxEvent(prisma, {
      tenantId,
      eventType: "ticket.created",
      aggregateType: "ticket",
      aggregateId,
      payload: { ticketId: aggregateId },
    });

    expect(event.id).toBeDefined();

    const claimed = await outboxRepository.claimPendingBatch(10, 60000, "worker-test");
    expect(claimed.length).toBeGreaterThan(0);
  });
});
