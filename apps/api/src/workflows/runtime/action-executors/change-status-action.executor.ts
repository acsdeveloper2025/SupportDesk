import { Inject, Injectable } from "@nestjs/common";
import { Prisma, TicketStatus } from "@prisma/client";

import { buildAuditEventData } from "../../../audit/audit-event";
import { OutboxPublisherService } from "../../../outbox/outbox-publisher.service";
import {
  ActionExecutionContext,
  ActionResult,
  WorkflowActionExecutor,
} from "./action-executor.interface";

@Injectable()
export class ChangeStatusActionExecutor implements WorkflowActionExecutor {
  readonly actionType = "change_status";

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

    const rawStatus = (
      typeof context.params.status === "string"
        ? context.params.status
        : typeof context.params.toStatus === "string"
          ? context.params.toStatus
          : typeof context.params.targetStatus === "string"
            ? context.params.targetStatus
            : ""
    ) as TicketStatus;

    if (!rawStatus || !Object.values(TicketStatus).includes(rawStatus)) {
      return { success: false, error: `Invalid target status '${rawStatus}'` };
    }
    const targetStatus = rawStatus;

    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.tenantId !== context.tenantId) {
      return { success: false, error: `Ticket ${ticketId} not found for tenant` };
    }

    if (ticket.status === targetStatus) {
      return { success: true, resultRef: { ticketId, status: targetStatus, noop: true } };
    }

    const fromStatus = ticket.status;
    const now = new Date();
    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        status: targetStatus,
        solvedAt: targetStatus === TicketStatus.SOLVED ? now : ticket.solvedAt,
        closedAt: targetStatus === TicketStatus.CLOSED ? now : ticket.closedAt,
        version: { increment: 1 },
      },
    });

    await tx.auditEvent.create({
      data: buildAuditEventData({
        action: "ticket.status_changed",
        actorUserId: null, // System AutomationActor
        metadata: {
          fromStatus,
          publicRef: updated.publicRef,
          toStatus: targetStatus,
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
      eventType: "ticket.status_changed",
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
        fromStatus,
        toStatus: targetStatus,
      },
      correlationId: context.correlationId,
      causationId: context.executionId,
      automationDepth: context.parentDepth + 1,
      dedupeKey: `wf:${context.executionId}:act:${context.ordinal}:change_status`,
    });

    return {
      success: true,
      resultRef: {
        ticketId,
        fromStatus,
        toStatus: targetStatus,
        version: updated.version,
      },
    };
  }
}
