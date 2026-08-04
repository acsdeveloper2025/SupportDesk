import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigPublicationState, ExecutionState, OutboxEvent, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import { buildAuditEventData } from "../../audit/audit-event";
import { PrismaService } from "../../database/prisma.service";
import { OutboxRepository } from "../../outbox/outbox.repository";
import {
  evaluateWorkflowConditions,
  WorkflowCondition,
} from "../domain/workflow-condition-evaluator";
import { evaluateRecursionBudget } from "../domain/workflow-recursion-budget";
import { WorkflowActionDefinition, WorkflowExecutorService } from "./workflow-executor.service";

export const DEFAULT_FAILURE_AUTO_PAUSE_THRESHOLD = 10;
export const DEFAULT_FAILURE_AUTO_PAUSE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class WorkflowDispatcherService {
  private readonly logger = new Logger(WorkflowDispatcherService.name);

  constructor(
    @Inject(forwardRef(() => PrismaService))
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => OutboxRepository))
    private readonly outboxRepository: OutboxRepository,
    @Inject(forwardRef(() => WorkflowExecutorService))
    private readonly workflowExecutor: WorkflowExecutorService,
  ) {}

  async processOutboxBatch(
    batchSize = 20,
    leaseDurationMs = 60000,
    leaseOwner = "worker-1",
  ): Promise<number> {
    const claimed = await this.outboxRepository.claimPendingBatch(
      batchSize,
      leaseDurationMs,
      leaseOwner,
    );

    for (const event of claimed) {
      try {
        await this.dispatchOutboxEvent(event);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Error dispatching outbox event ${event.id} (${event.eventType}): ${errorMsg}`,
        );
        await this.outboxRepository.recordAttemptFailure(event.id, event.tenantId, errorMsg);
      }
    }

    return claimed.length;
  }

  async dispatchOutboxEvent(event: OutboxEvent): Promise<void> {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const budgetCheck = evaluateRecursionBudget(event.automationDepth);

    // Recursion Depth Budget Enforcement
    if (budgetCheck.isCapped) {
      this.logger.warn(
        `Outbox event ${event.id} tenant=${event.tenantId} depth=${event.automationDepth} capped by platform max`,
      );

      await this.prisma.auditEvent.create({
        data: buildAuditEventData({
          action: "workflow.automation_depth_capped",
          actorUserId: null,
          metadata: {
            automationDepth: event.automationDepth,
            eventType: event.eventType,
            outboxEventId: event.id,
            reason: budgetCheck.reason,
          },
          outcome: "SUCCESS",
          targetId: event.id,
          targetType: "outbox_event",
          tenantId: event.tenantId,
        }),
      });

      await this.outboxRepository.markProcessed(event.id, event.tenantId);
      return;
    }

    // Load matching enabled workflows and their published active versions
    const matchingWorkflows = await this.prisma.workflow.findMany({
      where: {
        tenantId: event.tenantId,
        enabled: true,
        deletedAt: null,
      },
      include: {
        versions: {
          where: {
            state: ConfigPublicationState.PUBLISHED,
          },
        },
      },
      orderBy: { priority: "asc" },
      take: 50,
    });

    // Filter workflows whose published active version contains eventType in triggers
    const activeWorkflows = matchingWorkflows.filter((wf) => {
      if (!wf.activeVersionNumber) return false;
      const pubVersion = wf.versions.find((v) => v.versionNumber === wf.activeVersionNumber);
      if (!pubVersion) return false;

      const rawTriggers = pubVersion.triggers ?? [];
      const triggers = (
        typeof rawTriggers === "string" ? (JSON.parse(rawTriggers) as unknown) : rawTriggers
      ) as unknown[];
      return triggers.some(
        (t) =>
          (typeof t === "string" && t === event.eventType) ||
          (t &&
            typeof t === "object" &&
            ((t as Record<string, unknown>).eventType ?? (t as Record<string, unknown>).type) ===
              event.eventType),
      );
    });

    for (const workflow of activeWorkflows) {
      const version = workflow.versions.find(
        (v) => v.versionNumber === workflow.activeVersionNumber,
      )!;

      // Idempotent execution record creation
      let execution = await this.prisma.workflowExecution.findUnique({
        where: {
          tenantId_outboxEventId_workflowVersionId: {
            tenantId: event.tenantId,
            outboxEventId: event.id,
            workflowVersionId: version.id,
          },
        },
      });

      if (execution && execution.state !== ExecutionState.RUNNING) {
        // Already executed
        continue;
      }

      if (!execution) {
        try {
          execution = await this.prisma.workflowExecution.create({
            data: {
              id: randomUUID(),
              tenantId: event.tenantId,
              outboxEventId: event.id,
              workflowId: workflow.id,
              workflowVersionId: version.id,
              workflowVersionNumber: version.versionNumber,
              triggerEventType: event.eventType,
              priority: workflow.priority,
              automationDepth: event.automationDepth,
              state: ExecutionState.RUNNING,
            },
          });
        } catch {
          // On unique constraint conflict, skip
          continue;
        }
      }

      const rawConditions = version.conditions ?? [];
      const conditions = (
        typeof rawConditions === "string" ? JSON.parse(rawConditions) : rawConditions
      ) as WorkflowCondition[];
      const conditionEval = evaluateWorkflowConditions(conditions, payload);

      if (!conditionEval.passed) {
        await this.prisma.workflowExecution.update({
          where: { id: execution.id },
          data: {
            state: ExecutionState.SKIPPED_CONDITIONS,
            conditionResult: conditionEval as unknown as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        });
        continue;
      }

      // Execute Workflow Actions
      const rawActions = version.actions ?? [];
      const actions = (
        typeof rawActions === "string" ? JSON.parse(rawActions) : rawActions
      ) as WorkflowActionDefinition[];
      const execResult = await this.workflowExecutor.executeActions(
        execution.id,
        event.tenantId,
        actions,
        payload,
        event.automationDepth,
        event.correlationId,
      );

      const finalState: ExecutionState =
        execResult.state === "SUCCEEDED"
          ? ExecutionState.SUCCEEDED
          : execResult.state === "PARTIAL_FAILED"
            ? ExecutionState.PARTIAL_FAILED
            : ExecutionState.FAILED;

      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          state: finalState,
          conditionResult: conditionEval as unknown as Prisma.InputJsonValue,
          lastError: execResult.lastError
            ? (execResult.lastError as Prisma.InputJsonValue)
            : Prisma.DbNull,
          completedAt: new Date(),
        },
      });

      // If execution failed, emit audit event and check auto-pause threshold
      if (finalState === ExecutionState.FAILED || finalState === ExecutionState.PARTIAL_FAILED) {
        await this.prisma.auditEvent.create({
          data: buildAuditEventData({
            action: "workflow.execution_failed",
            actorUserId: null,
            metadata: {
              executionId: execution.id,
              lastError: execResult.lastError,
              state: finalState,
              workflowId: workflow.id,
              workflowKey: workflow.key,
            },
            outcome: "FAILURE",
            targetId: execution.id,
            targetType: "workflow_execution",
            tenantId: event.tenantId,
          }),
        });

        await this.evaluateAutoPauseThreshold(event.tenantId, workflow.id);
      }
    }

    // Mark outbox event as PROCESSED
    await this.outboxRepository.markProcessed(event.id, event.tenantId);
  }

  private async evaluateAutoPauseThreshold(
    tenantId: string,
    workflowId: string,
    windowMs = DEFAULT_FAILURE_AUTO_PAUSE_WINDOW_MS,
    threshold = DEFAULT_FAILURE_AUTO_PAUSE_THRESHOLD,
  ): Promise<void> {
    const windowStart = new Date(Date.now() - windowMs);

    const failureCount = await this.prisma.workflowExecution.count({
      where: {
        tenantId,
        workflowId,
        startedAt: { gte: windowStart },
        state: {
          in: [ExecutionState.FAILED, ExecutionState.PARTIAL_FAILED, ExecutionState.DEAD_LETTERED],
        },
      },
    });

    if (failureCount >= threshold) {
      const now = new Date();
      const pausedReason = `auto_paused_failure_threshold (${failureCount} failures in 1h)`;

      await this.prisma.workflow.update({
        where: { id: workflowId },
        data: {
          enabled: false,
          pausedAt: now,
          pausedReason,
        },
      });

      await this.prisma.auditEvent.create({
        data: buildAuditEventData({
          action: "workflow.paused",
          actorUserId: null,
          metadata: {
            failureCount,
            pausedReason,
            threshold,
            windowMs,
            workflowId,
          },
          outcome: "SUCCESS",
          targetId: workflowId,
          targetType: "workflow",
          tenantId,
        }),
      });

      this.logger.warn(
        `Auto-paused workflow ${workflowId} for tenant ${tenantId} due to ${failureCount} failures`,
      );
    }
  }
}
