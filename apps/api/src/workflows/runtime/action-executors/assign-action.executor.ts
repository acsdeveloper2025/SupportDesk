import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { buildAuditEventData } from "../../../audit/audit-event";
import { OutboxPublisherService } from "../../../outbox/outbox-publisher.service";
import {
  ActionExecutionContext,
  ActionResult,
  WorkflowActionExecutor,
} from "./action-executor.interface";

@Injectable()
export class AssignActionExecutor implements WorkflowActionExecutor {
  readonly actionType = "assign";

  constructor(
    @Inject(OutboxPublisherService) private readonly outboxPublisher: OutboxPublisherService,
  ) {}

  async execute(
    tx: Prisma.TransactionClient,
    context: ActionExecutionContext,
  ): Promise<ActionResult> {
    const payload = context.outboxEventPayload;
    const ticketObj =
      payload.ticket && typeof payload.ticket === "object"
        ? (payload.ticket as Record<string, unknown>)
        : null;
    const ticketId =
      (typeof payload.ticketId === "string" ? payload.ticketId : null) ??
      (ticketObj && typeof ticketObj.id === "string" ? ticketObj.id : null) ??
      (typeof payload.aggregateId === "string" ? payload.aggregateId : null);

    if (!ticketId) {
      return { success: false, error: "Missing ticket ID in workflow payload" };
    }

    const assigneeUserId =
      typeof context.params.assigneeUserId === "string"
        ? context.params.assigneeUserId
        : typeof context.params.assigneeId === "string"
          ? context.params.assigneeId
          : null;
    const assignedGroupId =
      typeof context.params.assignedGroupId === "string"
        ? context.params.assignedGroupId
        : typeof context.params.groupId === "string"
          ? context.params.groupId
          : null;

    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.tenantId !== context.tenantId) {
      return { success: false, error: `Ticket ${ticketId} not found for tenant` };
    }

    if (assigneeUserId) {
      const user = await tx.user.findFirst({
        where: { id: assigneeUserId, state: "ACTIVE" },
      });
      if (!user) {
        return { success: false, error: `Assignee user ${assigneeUserId} is not active in tenant` };
      }
    }

    const fromAssigneeUserId = ticket.assigneeUserId;
    const fromAssignedGroupId = ticket.assignedGroupId;

    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        assigneeUserId,
        assignedGroupId,
        version: { increment: 1 },
      },
    });

    await tx.auditEvent.create({
      data: buildAuditEventData({
        action: "ticket.assigned",
        actorUserId: null,
        metadata: {
          fromAssigneeUserId,
          fromAssignedGroupId,
          publicRef: updated.publicRef,
          toAssigneeUserId: assigneeUserId,
          toAssignedGroupId: assignedGroupId,
          workflowExecutionId: context.executionId,
        },
        outcome: "SUCCESS",
        targetId: ticketId,
        targetType: "ticket",
        tenantId: context.tenantId,
      }),
    });

    await this.outboxPublisher.appendOutboxEvent(tx, {
      tenantId: context.tenantId,
      eventType: "ticket.assigned",
      aggregateType: "ticket",
      aggregateId: ticketId,
      payload: {
        ticket: {
          id: updated.id,
          tenantId: updated.tenantId,
          publicRef: updated.publicRef,
          title: updated.title,
          description: updated.description,
          status: updated.status,
          priority: updated.priority,
          channel: updated.channel,
          type: updated.type,
          requesterUserId: updated.requesterUserId,
          assigneeUserId: updated.assigneeUserId,
          assignedGroupId: updated.assignedGroupId,
          ticketVersion: updated.version,
        },
        fromAssigneeUserId,
        toAssigneeUserId: assigneeUserId,
        fromAssignedGroupId,
        toAssignedGroupId: assignedGroupId,
      },
      correlationId: context.correlationId,
      causationId: context.executionId,
      automationDepth: context.parentDepth + 1,
      dedupeKey: `wf:${context.executionId}:act:${context.ordinal}:assign`,
    });

    return {
      success: true,
      resultRef: {
        ticketId,
        assigneeUserId,
        assignedGroupId,
        version: updated.version,
      },
    };
  }
}
