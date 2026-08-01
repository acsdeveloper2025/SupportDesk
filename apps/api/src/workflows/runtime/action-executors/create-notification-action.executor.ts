import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import {
  ActionExecutionContext,
  ActionResult,
  WorkflowActionExecutor,
} from "./action-executor.interface";

@Injectable()
export class CreateNotificationActionExecutor implements WorkflowActionExecutor {
  readonly actionType = "create_notification";

  async execute(
    tx: Prisma.TransactionClient,
    context: ActionExecutionContext,
  ): Promise<ActionResult> {
    const payload = context.outboxEventPayload;
    const ticketObj =
      payload.ticket && typeof payload.ticket === "object"
        ? (payload.ticket as Record<string, unknown>)
        : null;

    const recipientUserId =
      typeof context.params.recipientUserId === "string"
        ? context.params.recipientUserId
        : typeof context.params.recipientId === "string"
          ? context.params.recipientId
          : ticketObj && typeof ticketObj.assigneeUserId === "string"
            ? ticketObj.assigneeUserId
            : ticketObj && typeof ticketObj.requesterUserId === "string"
              ? ticketObj.requesterUserId
              : typeof payload.requesterUserId === "string"
                ? payload.requesterUserId
                : null;

    if (!recipientUserId) {
      return { success: false, error: "Recipient user ID could not be determined" };
    }

    const channel = (context.params.channel ?? "in_app") as string;
    const templateKey = (context.params.templateKey ?? "workflow_notification") as string;
    const dedupeKey = `intent:${context.tenantId}:${context.executionId}:${context.ordinal}:${recipientUserId}`;
    const intentId = randomUUID();

    const intent = await tx.notificationIntent.upsert({
      where: {
        tenantId_dedupeKey: {
          tenantId: context.tenantId,
          dedupeKey,
        },
      },
      create: {
        id: intentId,
        tenantId: context.tenantId,
        sourceType: "workflow_action",
        sourceId: context.executionId,
        recipientUserId,
        channel,
        templateKey,
        payload: {
          executionId: context.executionId,
          ordinal: context.ordinal,
          params: context.params as Prisma.InputJsonValue,
          outboxPayload: context.outboxEventPayload as Prisma.InputJsonValue,
        },
        dedupeKey,
      },
      update: {}, // Deduplication: if intent exists, do nothing
    });

    return {
      success: true,
      resultRef: {
        notificationIntentId: intent.id,
        recipientUserId,
        channel,
        templateKey,
      },
    };
  }
}
