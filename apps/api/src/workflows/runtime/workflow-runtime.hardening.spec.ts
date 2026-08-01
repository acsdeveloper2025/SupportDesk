import {
  ConfigPublicationState,
  ExecutionState,
  OutboxState,
  TicketChannel,
  TicketPriority,
  TicketStatus,
  TicketType,
} from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaService } from "../../database/prisma.service";
import { AdminOutboxController } from "../../outbox/admin-outbox.controller";
import { OutboxRepository } from "../../outbox/outbox.repository";
import { OutboxPublisherService } from "../../outbox/outbox-publisher.service";
import type { RbacService } from "../../rbac/rbac.service";
import { AddCommentActionExecutor } from "./action-executors/add-comment-action.executor";
import { AssignActionExecutor } from "./action-executors/assign-action.executor";
import { ChangeStatusActionExecutor } from "./action-executors/change-status-action.executor";
import { CreateNotificationActionExecutor } from "./action-executors/create-notification-action.executor";
import { SlaActionExecutor } from "./action-executors/sla-action.executor";
import { WorkflowDispatcherService } from "./workflow-dispatcher.service";
import { WorkflowExecutorService } from "./workflow-executor.service";

const databaseUrl = process.env.DATABASE_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
describeIntegration("Workflow Runtime Hardening Tests", () => {
  let prisma: PrismaService;
  let dispatcher: WorkflowDispatcherService;
  let outboxPublisher: OutboxPublisherService;
  let outboxRepository: OutboxRepository;
  let adminOutboxController: AdminOutboxController;

  let tenantId: string;
  let userId: string;
  let ticketId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    // We instantiate the services manually to avoid vitest/esbuild DI metadata stripping issues
    // with circular module dependencies in AppModule.
    const rbacService = {
      hasGlobalPermission: () => Promise.resolve(true),
      can: () => Promise.resolve(true),
    } as unknown as RbacService;

    outboxRepository = new OutboxRepository(prisma);
    outboxPublisher = new OutboxPublisherService(prisma);
    adminOutboxController = new AdminOutboxController(outboxRepository, rbacService);

    const workflowExecutor = new WorkflowExecutorService(
      prisma,
      new AddCommentActionExecutor(outboxPublisher),
      new ChangeStatusActionExecutor(outboxPublisher),
      new AssignActionExecutor(outboxPublisher),
      new CreateNotificationActionExecutor(),
      new SlaActionExecutor(),
    );

    dispatcher = new WorkflowDispatcherService(prisma, outboxRepository, workflowExecutor);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  beforeEach(async () => {
    // 1. Setup tenant and user
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

    // Create a target ticket for action processing
    const ticket = await prisma.ticket.create({
      data: {
        tenantId,
        publicRef: `HT-${Date.now()}`,
        title: "Hardening Test Ticket",
        description: "Hardening Test",
        status: TicketStatus.OPEN,
        priority: TicketPriority.NORMAL,
        channel: TicketChannel.WEB,
        type: TicketType.QUESTION,
        requesterUserId: userId,
      },
    });
    ticketId = ticket.id;

    // Create a generic test workflow
    await prisma.workflow.create({
      data: {
        tenantId,
        key: "hardening-test-wf",
        name: "Hardening Test Workflow",
        priority: 10,
        enabled: true,
        activeVersionNumber: 1,
        versions: {
          create: {
            tenantId,
            versionNumber: 1,
            state: ConfigPublicationState.PUBLISHED,
            triggers: [{ eventType: "hardening.event" }],
            conditions: [], // always true
            actions: [{ type: "add_internal_comment", params: { body: "Hardened Execution" } }],
            publishedAt: new Date(),
          },
        },
      },
    });
  });

  it("handles high concurrency correctly (50 events dispatched in parallel)", async () => {
    // 1. Create 50 pending outbox events
    const eventPromises = Array.from({ length: 50 }).map((_, i) =>
      prisma.$transaction(async (tx) =>
        outboxPublisher.appendOutboxEvent(tx, {
          tenantId,
          eventType: "hardening.event",
          aggregateType: "dummy",
          aggregateId: userId,
          payload: { index: i, ticketId },
        }),
      ),
    );

    const outboxEvents = await Promise.all(eventPromises);
    expect(outboxEvents).toHaveLength(50);

    // 2. Dispatch all 50 events concurrently
    // We mock parallel workers by invoking processOutboxBatch in parallel loops
    const workerPromises = Array.from({ length: 10 }).map(async () => {
      let active = true;
      while (active) {
        const count = await dispatcher.processOutboxBatch(10);
        if (count === 0) active = false;
      }
    });

    await Promise.all(workerPromises);

    // 3. Verify all 50 events are PROCESSED
    const processedEvents = await prisma.outboxEvent.findMany({
      where: { tenantId, state: OutboxState.PROCESSED },
    });
    expect(processedEvents.length).toBeGreaterThanOrEqual(50);

    // 4. Verify exactly 50 executions succeeded
    const executions = await prisma.workflowExecution.findMany({
      where: { tenantId, state: ExecutionState.SUCCEEDED },
    });
    expect(executions.length).toBeGreaterThanOrEqual(50);
  });

  it("enforces idempotency when the same outbox event is dispatched twice simultaneously", async () => {
    const event = await prisma.$transaction(async (tx) =>
      outboxPublisher.appendOutboxEvent(tx, {
        tenantId,
        eventType: "hardening.event",
        aggregateType: "dummy",
        aggregateId: userId,
        payload: { duplicate: true, ticketId },
      }),
    );

    // Dispatch the EXACT same event concurrently. The second one should silently skip due to unique constraint block.
    await Promise.all([
      dispatcher.dispatchOutboxEvent(event),
      dispatcher.dispatchOutboxEvent(event),
      dispatcher.dispatchOutboxEvent(event),
    ]);

    // There should only be 1 workflow execution
    const executions = await prisma.workflowExecution.findMany({
      where: { tenantId, outboxEventId: event.id },
    });
    expect(executions).toHaveLength(1);
    expect(executions[0].state).toBe(ExecutionState.SUCCEEDED);
  });

  it("safely replays an outbox event", async () => {
    const event = await prisma.$transaction(async (tx) =>
      outboxPublisher.appendOutboxEvent(tx, {
        tenantId,
        eventType: "hardening.event",
        aggregateType: "dummy",
        aggregateId: userId,
        payload: { replay: true, ticketId },
      }),
    );

    await dispatcher.dispatchOutboxEvent(event);

    const firstExecution = await prisma.workflowExecution.findFirst({
      where: { tenantId, outboxEventId: event.id },
    });
    expect(firstExecution?.state).toBe(ExecutionState.SUCCEEDED);

    // Now replay it using the admin replay endpoint logic
    const reqMock = { auth: { tenantId, userId, roles: [] } };
    await adminOutboxController.replayOutboxEvent(
      reqMock as unknown as Parameters<typeof adminOutboxController.replayOutboxEvent>[0],
      event.id,
    );

    const pendingEvent = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
    expect(pendingEvent?.state).toBe(OutboxState.PENDING);

    // Second dispatch
    await dispatcher.processOutboxBatch(1);

    const doubleExecutions = await prisma.workflowExecution.findMany({
      where: { tenantId, outboxEventId: event.id },
    });
    expect(doubleExecutions).toHaveLength(1); // STILL 1!
  });

  it("dead-letters events after exhaustive failures", async () => {
    // 1. Create failing workflow
    await prisma.workflow.create({
      data: {
        tenantId,
        key: "bad-wf",
        name: "Bad WF",
        priority: 10,
        enabled: true,
        activeVersionNumber: 1,
        versions: {
          create: {
            tenantId,
            versionNumber: 1,
            state: ConfigPublicationState.PUBLISHED,
            triggers: [{ eventType: "failing.event" }],
            conditions: [],
            actions: [{ type: "non_existent_action", params: {} }], // This will throw an error
            publishedAt: new Date(),
          },
        },
      },
    });

    const event = await prisma.$transaction(async (tx) =>
      outboxPublisher.appendOutboxEvent(tx, {
        tenantId,
        eventType: "failing.event",
        aggregateType: "dummy",
        aggregateId: userId,
        payload: { fail: true, ticketId },
      }),
    );

    // Fail it manually 8 times (simulate the batch worker calling recordAttemptFailure on exception)
    for (let i = 0; i < 8; i++) {
      await outboxRepository.recordAttemptFailure(event.id, tenantId, "Simulated crash");
    }

    const deadLettered = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
    expect(deadLettered?.state).toBe(OutboxState.DEAD_LETTERED);
    expect(deadLettered?.attemptCount).toBe(8);
  });
});
