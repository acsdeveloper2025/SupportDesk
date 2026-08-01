import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { isAllowedAssetTransition } from "../../../assets/domain/asset-lifecycle";
import { buildAuditEventData } from "../../../audit/audit-event";
import { OutboxPublisherService } from "../../../outbox/outbox-publisher.service";
import {
  ActionExecutionContext,
  ActionResult,
  WorkflowActionExecutor,
} from "./action-executor.interface";

const VALID_LIFECYCLE_STATES = [
  "DRAFT",
  "IN_STOCK",
  "ASSIGNED",
  "IN_REPAIR",
  "RETIRED",
  "DISPOSED",
  "LOST",
  "ARCHIVED",
] as const;

@Injectable()
export class ChangeAssetStatusActionExecutor implements WorkflowActionExecutor {
  readonly actionType = "change_asset_status";

  constructor(
    @Inject(OutboxPublisherService) private readonly outboxPublisher: OutboxPublisherService,
  ) {}

  async execute(
    tx: Prisma.TransactionClient,
    context: ActionExecutionContext,
  ): Promise<ActionResult> {
    const payload = context.outboxEventPayload;
    const assetObj =
      payload.asset && typeof payload.asset === "object"
        ? (payload.asset as Record<string, unknown>)
        : null;
    const assetId =
      (typeof payload.assetId === "string" ? payload.assetId : null) ??
      (assetObj && typeof assetObj.id === "string" ? assetObj.id : null) ??
      (typeof payload.aggregateId === "string" ? payload.aggregateId : null);

    if (!assetId) {
      return { success: false, error: "Missing asset ID in workflow payload" };
    }

    const rawState =
      typeof context.params.lifecycleState === "string"
        ? context.params.lifecycleState
        : typeof context.params.toState === "string"
          ? context.params.toState
          : "";
    if (!rawState || !(VALID_LIFECYCLE_STATES as readonly string[]).includes(rawState)) {
      return { success: false, error: `Invalid target lifecycle state '${rawState}'` };
    }
    const targetState = rawState as (typeof VALID_LIFECYCLE_STATES)[number];

    const asset = await tx.asset.findFirst({
      where: { tenantId: context.tenantId, id: assetId, deletedAt: null },
    });
    if (!asset) {
      return { success: false, error: `Asset ${assetId} not found for tenant` };
    }

    if (asset.lifecycleState === targetState) {
      return { success: true, resultRef: { assetId, lifecycleState: targetState, noop: true } };
    }

    if (!isAllowedAssetTransition(asset.lifecycleState, targetState)) {
      return {
        success: false,
        error: `Lifecycle transition ${asset.lifecycleState} -> ${targetState} is not allowed`,
      };
    }

    const fromState = asset.lifecycleState;
    const updated = await tx.asset.update({
      where: { id: assetId },
      data: { lifecycleState: targetState, version: { increment: 1 } },
    });

    await tx.assetHistory.create({
      data: {
        tenantId: context.tenantId,
        assetId,
        action: "asset.status_changed",
        fromState,
        toState: targetState,
        actorUserId: null,
        comment: "Changed by workflow automation",
        metadata: { workflowExecutionId: context.executionId },
      },
    });

    await tx.auditEvent.create({
      data: buildAuditEventData({
        action: "asset.status_changed",
        actorUserId: null, // System AutomationActor
        metadata: {
          assetRef: updated.assetRef,
          fromLifecycleState: fromState,
          toLifecycleState: targetState,
          workflowExecutionId: context.executionId,
        },
        outcome: "SUCCESS",
        targetId: assetId,
        targetType: "asset",
        tenantId: context.tenantId,
      }),
    });

    await this.outboxPublisher.appendOutboxEvent(tx, {
      tenantId: context.tenantId,
      eventType: "asset.status_changed",
      aggregateType: "asset",
      aggregateId: assetId,
      payload: {
        asset: {
          id: assetId,
          tenantId: context.tenantId,
          assetRef: updated.assetRef,
          name: updated.name,
          lifecycleState: targetState,
          fromLifecycleState: fromState,
        },
        assetId,
        assetRef: updated.assetRef,
        assetType: updated.assetTypeId,
        lifecycleState: targetState,
        fromLifecycleState: fromState,
      },
      correlationId: context.correlationId,
      causationId: context.executionId,
      automationDepth: context.parentDepth + 1,
      dedupeKey: `wf:${context.executionId}:act:${context.ordinal}:change_asset_status`,
    });

    return {
      success: true,
      resultRef: {
        assetId,
        fromLifecycleState: fromState,
        lifecycleState: targetState,
        version: updated.version,
      },
    };
  }
}
