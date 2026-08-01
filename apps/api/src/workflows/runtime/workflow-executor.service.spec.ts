import { ActionAttemptState } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../database/prisma.service";
import type { AddCommentActionExecutor } from "./action-executors/add-comment-action.executor";
import type { AssignActionExecutor } from "./action-executors/assign-action.executor";
import type { ChangeAssetStatusActionExecutor } from "./action-executors/change-asset-status-action.executor";
import type { ChangeStatusActionExecutor } from "./action-executors/change-status-action.executor";
import type { CreateNotificationActionExecutor } from "./action-executors/create-notification-action.executor";
import type { SlaActionExecutor } from "./action-executors/sla-action.executor";
import { WorkflowExecutorService } from "./workflow-executor.service";

describe("WorkflowExecutorService Unit Tests", () => {
  it("returns SUCCEEDED when actions array is empty", async () => {
    const service = new WorkflowExecutorService(
      {} as unknown as PrismaService,
      {} as unknown as ChangeStatusActionExecutor,
      {} as unknown as ChangeAssetStatusActionExecutor,
      {} as unknown as AssignActionExecutor,
      {} as unknown as AddCommentActionExecutor,
      {} as unknown as CreateNotificationActionExecutor,
      {} as unknown as SlaActionExecutor,
    );

    const result = await service.executeActions("exec-1", "tenant-1", [], {}, 0, "corr-1");
    expect(result.state).toBe("SUCCEEDED");
  });

  it("skips action ordinals that have already SUCCEEDED", async () => {
    const mockPrisma = {
      workflowActionAttempt: {
        findUnique: vi.fn().mockResolvedValue({
          state: ActionAttemptState.SUCCEEDED,
        }),
      },
    };

    const mockChangeStatus = { execute: vi.fn() };

    const service = new WorkflowExecutorService(
      mockPrisma as unknown as PrismaService,
      mockChangeStatus as unknown as ChangeStatusActionExecutor,
      {} as unknown as ChangeAssetStatusActionExecutor,
      {} as unknown as AssignActionExecutor,
      {} as unknown as AddCommentActionExecutor,
      {} as unknown as CreateNotificationActionExecutor,
      {} as unknown as SlaActionExecutor,
    );

    const result = await service.executeActions(
      "exec-1",
      "tenant-1",
      [{ type: "change_status", params: { status: "OPEN" } }],
      {},
      0,
      "corr-1",
    );

    expect(result.state).toBe("SUCCEEDED");
    expect(mockChangeStatus.execute).not.toHaveBeenCalled();
  });
});
