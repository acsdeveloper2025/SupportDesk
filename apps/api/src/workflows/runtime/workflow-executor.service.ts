import { Inject, Injectable, Logger } from "@nestjs/common";
import { ActionAttemptState, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import { PrismaService } from "../../database/prisma.service";
import {
  ActionExecutionContext,
  WorkflowActionExecutor,
} from "./action-executors/action-executor.interface";
import { AddCommentActionExecutor } from "./action-executors/add-comment-action.executor";
import { AssignActionExecutor } from "./action-executors/assign-action.executor";
import { ChangeStatusActionExecutor } from "./action-executors/change-status-action.executor";
import { CreateNotificationActionExecutor } from "./action-executors/create-notification-action.executor";
import { SlaActionExecutor } from "./action-executors/sla-action.executor";

export interface WorkflowActionDefinition {
  type?: string;
  actionType?: string;
  params?: Record<string, unknown>;
}

export interface WorkflowExecutorResult {
  state: "SUCCEEDED" | "PARTIAL_FAILED" | "FAILED";
  lastError?: unknown;
}

@Injectable()
export class WorkflowExecutorService {
  private readonly logger = new Logger(WorkflowExecutorService.name);
  private readonly executors: Map<string, WorkflowActionExecutor>;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ChangeStatusActionExecutor) changeStatus: ChangeStatusActionExecutor,
    @Inject(AssignActionExecutor) assign: AssignActionExecutor,
    @Inject(AddCommentActionExecutor) addComment: AddCommentActionExecutor,
    @Inject(CreateNotificationActionExecutor) createNotification: CreateNotificationActionExecutor,
    @Inject(SlaActionExecutor) sla: SlaActionExecutor,
  ) {
    this.executors = new Map<string, WorkflowActionExecutor>([
      ["change_status", changeStatus],
      ["assign", assign],
      ["add_internal_comment", addComment],
      ["create_notification", createNotification],
      ["sla_start", sla],
      ["sla_stop", sla],
    ]);
  }

  async executeActions(
    executionId: string,
    tenantId: string,
    actions: WorkflowActionDefinition[],
    outboxPayload: Record<string, unknown>,
    automationDepth: number,
    correlationId: string,
    maxActionAttempts = 5,
  ): Promise<WorkflowExecutorResult> {
    if (!actions || actions.length === 0) {
      return { state: "SUCCEEDED" };
    }

    let hasSuccess = false;
    let hasFailure = false;
    let lastError: unknown = null;

    for (let ordinal = 0; ordinal < actions.length; ordinal++) {
      const action = actions[ordinal];
      if (!action) continue;
      const actionType = action.type ?? action.actionType ?? "";
      const params = (action.params ?? action ?? {}) as Record<string, unknown>;

      // Check existing attempt state for idempotent resumption
      const existingAttempt = await this.prisma.workflowActionAttempt.findUnique({
        where: {
          tenantId_executionId_ordinal: {
            tenantId,
            executionId,
            ordinal,
          },
        },
      });

      if (existingAttempt?.state === ActionAttemptState.SUCCEEDED) {
        hasSuccess = true;
        continue;
      }

      const executor = this.executors.get(actionType);
      if (!executor) {
        const errorMsg = `No executor registered for action type '${actionType}'`;
        this.logger.error(errorMsg);
        await this.recordAttemptFailure(
          tenantId,
          executionId,
          ordinal,
          actionType,
          params,
          errorMsg,
          existingAttempt?.attemptNumber ?? 0,
          maxActionAttempts,
        );
        hasFailure = true;
        lastError = { message: errorMsg, actionType, ordinal };
        continue;
      }

      const context: ActionExecutionContext = {
        tenantId,
        executionId,
        ordinal,
        actionType,
        params,
        outboxEventPayload: outboxPayload,
        parentDepth: automationDepth,
        correlationId,
      };

      // Execute single action inside its own DB transaction
      try {
        const attemptResult = await this.prisma.$transaction(async (tx) => {
          // Upsert attempt to RUNNING
          await tx.workflowActionAttempt.upsert({
            where: {
              tenantId_executionId_ordinal: {
                tenantId,
                executionId,
                ordinal,
              },
            },
            create: {
              id: randomUUID(),
              tenantId,
              executionId,
              ordinal,
              actionType,
              paramsSnapshot: params as Prisma.InputJsonValue,
              state: ActionAttemptState.RUNNING,
              attemptNumber: 1,
            },
            update: {
              state: ActionAttemptState.RUNNING,
              attemptNumber: { increment: 1 },
              startedAt: new Date(),
            },
          });

          const res = await executor.execute(tx, context);
          if (!res.success) {
            throw new Error(res.error ?? "Action execution failed");
          }

          // Mark attempt SUCCEEDED in same transaction
          await tx.workflowActionAttempt.update({
            where: {
              tenantId_executionId_ordinal: {
                tenantId,
                executionId,
                ordinal,
              },
            },
            data: {
              state: ActionAttemptState.SUCCEEDED,
              resultRef: (res.resultRef ?? {}) as Prisma.InputJsonValue,
              completedAt: new Date(),
              lastError: Prisma.DbNull,
            },
          });

          return res;
        });

        if (attemptResult.success) {
          hasSuccess = true;
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Action execution failed at ordinal ${ordinal} (${actionType}) for execution ${executionId}: ${errorMsg}`,
        );
        hasFailure = true;
        lastError = { message: errorMsg, actionType, ordinal };

        await this.recordAttemptFailure(
          tenantId,
          executionId,
          ordinal,
          actionType,
          params,
          errorMsg,
          existingAttempt?.attemptNumber ?? 0,
          maxActionAttempts,
        );
      }
    }

    if (hasSuccess && !hasFailure) {
      return { state: "SUCCEEDED" };
    }
    if (hasSuccess && hasFailure) {
      return { state: "PARTIAL_FAILED", lastError };
    }
    return { state: "FAILED", lastError };
  }

  private async recordAttemptFailure(
    tenantId: string,
    executionId: string,
    ordinal: number,
    actionType: string,
    params: unknown,
    errorMsg: string,
    currentAttempts: number,
    maxAttempts: number,
  ): Promise<void> {
    const nextAttempts = currentAttempts + 1;
    const isTerminal = nextAttempts >= maxAttempts;
    const state: ActionAttemptState = isTerminal
      ? ActionAttemptState.DEAD_LETTERED
      : ActionAttemptState.FAILED;

    await this.prisma.workflowActionAttempt.upsert({
      where: {
        tenantId_executionId_ordinal: {
          tenantId,
          executionId,
          ordinal,
        },
      },
      create: {
        id: randomUUID(),
        tenantId,
        executionId,
        ordinal,
        actionType,
        paramsSnapshot: params as Prisma.InputJsonValue,
        state,
        attemptNumber: nextAttempts,
        lastError: {
          message: errorMsg,
          timestamp: new Date().toISOString(),
        },
      },
      update: {
        state,
        attemptNumber: nextAttempts,
        lastError: {
          message: errorMsg,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }
}
