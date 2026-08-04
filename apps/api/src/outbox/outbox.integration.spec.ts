import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { OutboxState } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AppModule } from "../app.module";
import { cleanDatabase } from "../common/testing/clean-database";
import { PrismaService } from "../database/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import { CommentsService } from "../ticketing/comments.service";
import { TicketsService } from "../ticketing/tickets.service";
import { OutboxRepository } from "./outbox.repository";
import { OutboxPublisherService } from "./outbox-publisher.service";

const databaseUrl = process.env.DATABASE_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration("Outbox Integration Tests", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let outboxPublisher: OutboxPublisherService;
  let outboxRepository: OutboxRepository;
  let ticketsService: TicketsService;
  let commentsService: CommentsService;

  let tenantId: string;
  let userId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    outboxPublisher = moduleRef.get(OutboxPublisherService);
    outboxRepository = moduleRef.get(OutboxRepository);
    ticketsService = moduleRef.get(TicketsService);
    commentsService = moduleRef.get(CommentsService);
    const rbacService = moduleRef.get(RbacService);
    vi.spyOn(rbacService, "can").mockResolvedValue(true);
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    // Setup test tenant and user
    const tenant = await prisma.tenant.create({
      data: {
        slug: `outbox-test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        name: "Outbox Test Tenant",
      },
    });
    tenantId = tenant.id;

    const user = await prisma.user.create({
      data: {
        email: `outbox-user-${Date.now()}@example.com`,
        emailNormalized: `outbox-user-${Date.now()}@example.com`,
        passwordHash: "hash",
        state: "ACTIVE",
      },
    });
    userId = user.id;

    const role = await prisma.role.create({
      data: {
        isSystem: true,
        key: "agent",
        name: "Agent",
        tenantId,
      },
    });

    await prisma.userRole.create({
      data: {
        roleId: role.id,
        tenantId,
        userId,
      },
    });
  });

  it("appends outbox event atomically when a ticket is created with audit", async () => {
    const ticket = await ticketsService.createTicket({
      channel: "WEB",
      description: "Testing outbox atomic append on create",
      priority: "HIGH",
      requesterUserId: userId,
      tenantId,
      title: "Outbox Ticket Test",
      type: "INCIDENT",
    });

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { tenantId, aggregateId: ticket.id },
    });

    expect(outboxEvents).toHaveLength(1);
    expect(outboxEvents[0]?.eventType).toBe("ticket.created");
    expect(outboxEvents[0]?.aggregateType).toBe("ticket");
    expect(outboxEvents[0]?.state).toBe(OutboxState.PENDING);
    expect(outboxEvents[0]?.automationDepth).toBe(0);
    expect(
      ((outboxEvents[0]?.payload as Record<string, unknown>)?.ticket as Record<string, unknown>)
        ?.title,
    ).toBe("Outbox Ticket Test");
  });

  it("appends outbox event atomically when a comment is added with audit", async () => {
    const ticket = await ticketsService.createTicket({
      channel: "WEB",
      description: "Ticket for comment outbox test",
      priority: "MEDIUM",
      requesterUserId: userId,
      tenantId,
      title: "Comment Outbox Ticket",
      type: "QUESTION",
    });

    const comment = await commentsService.createComment(
      tenantId,
      ticket.id,
      {
        body: "This is a comment for outbox testing",
        visibility: "PUBLIC",
      },
      userId,
    );

    const commentOutbox = await prisma.outboxEvent.findFirst({
      where: { tenantId, aggregateId: comment.id },
    });

    expect(commentOutbox).not.toBeNull();
    expect(commentOutbox?.eventType).toBe("comment.added");
    expect(commentOutbox?.aggregateType).toBe("comment");
    expect((commentOutbox?.payload as Record<string, unknown>).body).toBe(
      "This is a comment for outbox testing",
    );
  });

  it("claims pending outbox events using SKIP LOCKED lease", async () => {
    // Append 2 events directly
    await prisma.$transaction(async (tx) => {
      await outboxPublisher.appendOutboxEvent(tx, {
        tenantId,
        eventType: "ticket.created",
        aggregateType: "ticket",
        aggregateId: userId,
        payload: { test: true },
      });
      await outboxPublisher.appendOutboxEvent(tx, {
        tenantId,
        eventType: "ticket.status_changed",
        aggregateType: "ticket",
        aggregateId: userId,
        payload: { test: true },
      });
    });

    const claimed = await outboxRepository.claimPendingBatch(100, 60000, "test-worker");
    const tenantClaimed = claimed.filter((e) => e.tenantId === tenantId);

    expect(tenantClaimed.length).toBeGreaterThanOrEqual(2);
    for (const event of tenantClaimed) {
      expect(event.state).toBe(OutboxState.CLAIMED);
      expect(event.leaseOwner).toBe("test-worker");
      expect(event.leaseExpiresAt).not.toBeNull();
    }
  });

  it("replays a dead-lettered outbox event", async () => {
    const event = await prisma.$transaction(async (tx) => {
      return outboxPublisher.appendOutboxEvent(tx, {
        tenantId,
        eventType: "ticket.created",
        aggregateType: "ticket",
        aggregateId: userId,
        payload: { test: "replay" },
      });
    });

    // Record failure up to dead-letter
    await outboxRepository.recordAttemptFailure(event.id, tenantId, "simulated error", 1);

    const deadLettered = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
    expect(deadLettered?.state).toBe(OutboxState.DEAD_LETTERED);

    const replayed = await outboxRepository.replayOutboxEvent(event.id, tenantId);
    expect(replayed.state).toBe(OutboxState.PENDING);
    expect(replayed.attemptCount).toBe(0);
    expect(replayed.lastError).toBeNull();
  });
});
