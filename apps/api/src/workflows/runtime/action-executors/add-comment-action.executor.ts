import { Inject, Injectable } from "@nestjs/common";
import { CommentVisibility, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import { buildAuditEventData } from "../../../audit/audit-event";
import { OutboxPublisherService } from "../../../outbox/outbox-publisher.service";
import {
  ActionExecutionContext,
  ActionResult,
  WorkflowActionExecutor,
} from "./action-executor.interface";

@Injectable()
export class AddCommentActionExecutor implements WorkflowActionExecutor {
  readonly actionType = "add_internal_comment";

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

    const body =
      typeof context.params.body === "string"
        ? context.params.body
        : typeof context.params.commentBody === "string"
          ? context.params.commentBody
          : "";
    if (!body || body.trim().length === 0) {
      return { success: false, error: "Comment body cannot be empty" };
    }

    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.tenantId !== context.tenantId) {
      return { success: false, error: `Ticket ${ticketId} not found for tenant` };
    }

    const authorUserId =
      typeof context.params.authorUserId === "string"
        ? context.params.authorUserId
        : ticket.requesterUserId;
    const visibility = (
      typeof context.params.visibility === "string"
        ? context.params.visibility
        : CommentVisibility.INTERNAL
    ) as CommentVisibility;
    const commentId = randomUUID();

    await tx.comment.create({
      data: {
        id: commentId,
        tenantId: context.tenantId,
        ticketId,
        authorUserId,
        body,
        visibility,
        version: 1,
      },
    });

    await tx.auditEvent.create({
      data: buildAuditEventData({
        action: "comment.created",
        actorUserId: null,
        metadata: {
          commentId,
          publicRef: ticket.publicRef,
          visibility,
          workflowExecutionId: context.executionId,
        },
        outcome: "SUCCESS",
        targetId: commentId,
        targetType: "comment",
        tenantId: context.tenantId,
      }),
    });

    await this.outboxPublisher.appendOutboxEvent(tx, {
      tenantId: context.tenantId,
      eventType: "comment.added",
      aggregateType: "comment",
      aggregateId: commentId,
      payload: {
        commentId,
        ticketId,
        authorUserId,
        visibility,
        body,
        ticket: {
          id: ticket.id,
          tenantId: ticket.tenantId,
          publicRef: ticket.publicRef,
          title: ticket.title,
          description: ticket.description,
          status: ticket.status,
          priority: ticket.priority,
          channel: ticket.channel,
          type: ticket.type,
          requesterUserId: ticket.requesterUserId,
          assigneeUserId: ticket.assigneeUserId,
          assignedGroupId: ticket.assignedGroupId,
          ticketVersion: ticket.version,
        },
      },
      correlationId: context.correlationId,
      causationId: context.executionId,
      automationDepth: context.parentDepth + 1,
      dedupeKey: `wf:${context.executionId}:act:${context.ordinal}:add_comment`,
    });

    return {
      success: true,
      resultRef: {
        commentId,
        ticketId,
        visibility,
      },
    };
  }
}
