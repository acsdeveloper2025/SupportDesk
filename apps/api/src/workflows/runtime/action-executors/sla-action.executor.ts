import { Injectable } from "@nestjs/common";
import { Prisma, SlaTargetState, SlaTargetType } from "@prisma/client";

import {
  ActionExecutionContext,
  ActionResult,
  WorkflowActionExecutor,
} from "./action-executor.interface";

@Injectable()
export class SlaActionExecutor implements WorkflowActionExecutor {
  readonly actionType = "sla_start"; // Handled alongside sla_stop

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
      return { success: false, error: "Missing ticket ID for SLA action" };
    }

    const targetType = (context.params.targetType ?? SlaTargetType.RESPONSE) as SlaTargetType;
    const isStop = context.actionType === "sla_stop";

    const target = await tx.slaTarget.findFirst({
      where: {
        tenantId: context.tenantId,
        ticketId,
        type: targetType,
        state: { in: [SlaTargetState.RUNNING, SlaTargetState.PAUSED] },
      },
    });

    if (!target) {
      return {
        success: true,
        resultRef: { ticketId, targetType, noop: true, message: "No active SLA target found" },
      };
    }

    if (isStop) {
      const now = new Date();
      const updated = await tx.slaTarget.update({
        where: { id: target.id },
        data: {
          completedAt: now,
          state: SlaTargetState.MET,
          version: { increment: 1 },
        },
      });

      return {
        success: true,
        resultRef: {
          targetId: updated.id,
          ticketId,
          targetType,
          action: "sla_stop",
          completedAt: now.toISOString(),
        },
      };
    } else {
      // sla_start / resume
      const now = new Date();
      const updated = await tx.slaTarget.update({
        where: { id: target.id },
        data: {
          state: SlaTargetState.RUNNING,
          pausedAt: null,
          version: { increment: 1 },
        },
      });

      return {
        success: true,
        resultRef: {
          targetId: updated.id,
          ticketId,
          targetType,
          action: "sla_start",
          resumedAt: now.toISOString(),
        },
      };
    }
  }
}
