import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { ConfigPublicationState, ExecutionState, OutboxState, TicketStatus } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma.service";
import { OutboxPublisherService } from "../../outbox/outbox-publisher.service";
import { TicketsService } from "../../ticketing/tickets.service";
import { WorkflowDispatcherService } from "./workflow-dispatcher.service";

const databaseUrl = process.env.DATABASE_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration("Workflow Runtime Integration Tests", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let dispatcher: WorkflowDispatcherService;
  let outboxPublisher: OutboxPublisherService;
  let ticketsService: TicketsService;

  let tenantId: string;
  let userId: string;
  let assigneeId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    dispatcher = moduleRef.get(WorkflowDispatcherService);
    outboxPublisher = moduleRef.get(OutboxPublisherService);
    ticketsService = moduleRef.get(TicketsService);
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  beforeEach(async () => {
    const tenant = await prisma.tenant.create({
      data: {
        slug: `wf-runtime-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        name: "Workflow Runtime Tenant",
      },
    });
    tenantId = tenant.id;

    const user = await prisma.user.create({
      data: {
        email: `wf-user-${Date.now()}@example.com`,
        emailNormalized: `wf-user-${Date.now()}@example.com`,
        passwordHash: "hash",
        state: "ACTIVE",
      },
    });
    userId = user.id;

    const assignee = await prisma.user.create({
      data: {
        email: `wf-assignee-${Date.now()}@example.com`,
        emailNormalized: `wf-assignee-${Date.now()}@example.com`,
        passwordHash: "hash",
        state: "ACTIVE",
      },
    });
    assigneeId = assignee.id;
  });

  it("dispatches matched published workflow, evaluates conditions, and executes action pipeline", async () => {
    // 1. Create published workflow: when ticket.created & priority == 'HIGH' -> change status to open, assign to assigneeId, add comment
    const workflow = await prisma.workflow.create({
      data: {
        tenantId,
        key: "auto-triage-high-priority",
        name: "Auto Triage High Priority",
        priority: 10,
        enabled: true,
        activeVersionNumber: 1,
        versions: {
          create: {
            tenantId,
            versionNumber: 1,
            state: ConfigPublicationState.PUBLISHED,
            triggers: [{ eventType: "ticket.created" }],
            conditions: [{ field: "ticket.priority", operator: "equals", value: "HIGH" }],
            actions: [
              { type: "change_status", params: { status: "OPEN" } },
              { type: "assign", params: { assigneeUserId: assigneeId } },
              { type: "add_internal_comment", params: { body: "Auto-triaged by workflow engine" } },
              {
                type: "create_notification",
                params: {
                  channel: "in_app",
                  templateKey: "high_priority_assigned",
                  recipientUserId: assigneeId,
                },
              },
            ],
            publishedAt: new Date(),
          },
        },
      },
    });

    // 2. Create ticket with HIGH priority -> appends ticket.created outbox event
    const ticket = await ticketsService.createTicket({
      channel: "WEB",
      description: "High priority issue needing auto triage",
      priority: "HIGH",
      requesterUserId: userId,
      tenantId,
      title: "Server Down Alert",
      type: "INCIDENT",
    });

    const outboxEvent = await prisma.outboxEvent.findFirst({
      where: { tenantId, aggregateId: ticket.id, eventType: "ticket.created" },
    });
    expect(outboxEvent).not.toBeNull();

    // 3. Dispatch outbox event
    await dispatcher.dispatchOutboxEvent(outboxEvent!);

    // 4. Verify outbox event is marked PROCESSED
    const processedOutbox = await prisma.outboxEvent.findUnique({ where: { id: outboxEvent!.id } });
    expect(processedOutbox?.state).toBe(OutboxState.PROCESSED);

    // 5. Verify workflow_executions row state is SUCCEEDED
    const execution = await prisma.workflowExecution.findFirst({
      where: { tenantId, workflowId: workflow.id, outboxEventId: outboxEvent!.id },
      include: { actionAttempts: true },
    });
    expect(execution).not.toBeNull();
    expect(execution?.state).toBe(ExecutionState.SUCCEEDED);
    expect(execution?.actionAttempts).toHaveLength(4);

    for (const attempt of execution?.actionAttempts ?? []) {
      expect(attempt.state).toBe("SUCCEEDED");
    }

    // 6. Verify domain side-effects on ticket
    const updatedTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(updatedTicket?.status).toBe(TicketStatus.OPEN);
    expect(updatedTicket?.assigneeUserId).toBe(assigneeId);

    // 7. Verify comment created
    const comments = await prisma.comment.findMany({ where: { tenantId, ticketId: ticket.id } });
    expect(comments).toHaveLength(1);
    expect(comments[0]?.body).toBe("Auto-triaged by workflow engine");

    // 8. Verify notification intent created
    const intents = await prisma.notificationIntent.findMany({
      where: { tenantId, recipientUserId: assigneeId },
    });
    expect(intents).toHaveLength(1);
    expect(intents[0]?.templateKey).toBe("high_priority_assigned");
  });

  it("skips workflow execution when conditions do not pass", async () => {
    // Workflow requires LOW priority
    const workflow = await prisma.workflow.create({
      data: {
        tenantId,
        key: "auto-triage-low-priority",
        name: "Auto Triage Low Priority",
        priority: 10,
        enabled: true,
        activeVersionNumber: 1,
        versions: {
          create: {
            tenantId,
            versionNumber: 1,
            state: ConfigPublicationState.PUBLISHED,
            triggers: [{ eventType: "ticket.created" }],
            conditions: [{ field: "ticket.priority", operator: "equals", value: "LOW" }],
            actions: [{ type: "change_status", params: { status: "CLOSED" } }],
            publishedAt: new Date(),
          },
        },
      },
    });

    // Create URGENT priority ticket
    const ticket = await ticketsService.createTicket({
      channel: "WEB",
      description: "Urgent issue",
      priority: "URGENT",
      requesterUserId: userId,
      tenantId,
      title: "Urgent Outage",
      type: "INCIDENT",
    });

    const outboxEvent = await prisma.outboxEvent.findFirst({
      where: { tenantId, aggregateId: ticket.id, eventType: "ticket.created" },
    });

    await dispatcher.dispatchOutboxEvent(outboxEvent!);

    const execution = await prisma.workflowExecution.findFirst({
      where: { tenantId, workflowId: workflow.id, outboxEventId: outboxEvent!.id },
    });
    expect(execution?.state).toBe(ExecutionState.SKIPPED_CONDITIONS);

    // Ticket status remains NEW
    const updatedTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(updatedTicket?.status).toBe(TicketStatus.NEW);
  });

  it("enforces platform recursion depth cap = 3 and logs audit", async () => {
    const cappedOutbox = await prisma.$transaction(async (tx) => {
      return outboxPublisher.appendOutboxEvent(tx, {
        tenantId,
        eventType: "ticket.created",
        aggregateType: "ticket",
        aggregateId: userId,
        payload: { ticket: { id: userId, priority: "HIGH" } },
        automationDepth: 3, // Platform hard max 3
      });
    });

    await dispatcher.dispatchOutboxEvent(cappedOutbox);

    const audit = await prisma.auditEvent.findFirst({
      where: { tenantId, action: "workflow.automation_depth_capped" },
    });
    expect(audit).not.toBeNull();
    expect((audit?.metadata as Record<string, unknown>).automationDepth).toBe(3);

    const processed = await prisma.outboxEvent.findUnique({ where: { id: cappedOutbox.id } });
    expect(processed?.state).toBe(OutboxState.PROCESSED);
  });
});
