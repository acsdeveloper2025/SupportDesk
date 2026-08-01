import type { Prisma } from "@prisma/client";

export interface ActionExecutionContext {
  tenantId: string;
  executionId: string;
  ordinal: number;
  actionType: string;
  params: Record<string, unknown>;
  outboxEventPayload: Record<string, unknown>;
  parentDepth: number;
  correlationId: string;
}

export interface ActionResult {
  success: boolean;
  resultRef?: Record<string, unknown>;
  error?: string;
}

export interface WorkflowActionExecutor {
  readonly actionType: string;
  execute(tx: Prisma.TransactionClient, context: ActionExecutionContext): Promise<ActionResult>;
}
