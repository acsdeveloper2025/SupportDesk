import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigPublicationState, type Prisma } from "@prisma/client";

import { RbacService } from "../rbac/rbac.service";
import type {
  WorkflowAction,
  WorkflowCondition,
  WorkflowDefinition,
  WorkflowTrigger,
} from "./domain/workflow-definition";
import { diffWorkflowSnapshots } from "./domain/workflow-diff";
import type { WorkflowValidationReport } from "./domain/workflow-validation";
import { WorkflowValidationService } from "./workflow-validation.service";
import { WorkflowsRepository } from "./workflows.repository";

export interface CreateWorkflowInput {
  tenantId: string;
  actorUserId: string;
  key: string;
  name: string;
  description?: string;
  priority: number;
  triggers: WorkflowTrigger[];
  conditions?: WorkflowCondition[];
  actions: WorkflowAction[];
  correlationId?: string;
}

export interface UpdateWorkflowDraftInput {
  tenantId: string;
  workflowId: string;
  actorUserId: string;
  name?: string;
  description?: string | null;
  priority?: number;
  triggers?: WorkflowTrigger[];
  conditions?: WorkflowCondition[];
  actions?: WorkflowAction[];
  correlationId?: string;
}

type WorkflowWithVersions = NonNullable<Awaited<ReturnType<WorkflowsRepository["findById"]>>>;

export interface WorkflowVersionResponse {
  id: string;
  versionNumber: number;
  state: ConfigPublicationState;
  triggers: unknown;
  conditions: unknown;
  actions: unknown;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowResponse {
  id: string;
  key: string;
  name: string;
  description: string | null;
  priority: number;
  enabled: boolean;
  pausedAt: Date | null;
  pausedReason: string | null;
  activeVersionNumber: number | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  versions: WorkflowVersionResponse[];
}

@Injectable()
export class WorkflowsService {
  constructor(
    @Inject(WorkflowsRepository) private readonly repository: WorkflowsRepository,
    @Inject(RbacService) private readonly rbacService: RbacService,
    @Inject(WorkflowValidationService)
    private readonly validationService: WorkflowValidationService,
  ) {}

  async list(tenantId: string, actorUserId: string): Promise<WorkflowResponse[]> {
    await this.requirePermission(tenantId, actorUserId, "workflow.read");
    const workflows = await this.repository.list(tenantId);
    return workflows.map((workflow) => this.mapWorkflowResponse(workflow));
  }

  async get(tenantId: string, workflowId: string, actorUserId: string): Promise<WorkflowResponse> {
    await this.requirePermission(tenantId, actorUserId, "workflow.read");
    const workflow = await this.requireWorkflow(tenantId, workflowId);
    return this.mapWorkflowResponse(workflow);
  }

  async create(input: CreateWorkflowInput): Promise<WorkflowResponse> {
    await this.requirePermission(input.tenantId, input.actorUserId, "workflow.create");

    const key = input.key.trim();
    if (!key) {
      throw new BadRequestException("Workflow key is required");
    }

    this.validatePriority(input.priority);

    const definition: WorkflowDefinition = {
      actions: input.actions,
      conditions: input.conditions ?? [],
      triggers: input.triggers,
    };
    this.assertDraftDefinition(definition);

    const existingKey = await this.repository.findByKey(input.tenantId, key);
    if (existingKey) {
      throw new ConflictException("Workflow with this key already exists");
    }

    const existingPriority = await this.repository.findByPriority(input.tenantId, input.priority);
    if (existingPriority) {
      throw new ConflictException(`Another workflow already uses priority ${input.priority}`);
    }

    const workflowId = randomUUID();
    const versionId = randomUUID();

    await this.repository.client.$transaction(async (tx) => {
      await tx.workflow.create({
        data: {
          description: input.description,
          id: workflowId,
          key,
          name: input.name,
          priority: input.priority,
          tenantId: input.tenantId,
        },
      });

      await tx.workflowVersion.create({
        data: {
          actions: definition.actions as unknown as Prisma.InputJsonValue,
          conditions: definition.conditions as unknown as Prisma.InputJsonValue,
          id: versionId,
          state: ConfigPublicationState.DRAFT,
          tenantId: input.tenantId,
          triggers: definition.triggers as unknown as Prisma.InputJsonValue,
          versionNumber: 1,
          workflowId,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "workflow.created",
          actorUserId: input.actorUserId,
          correlationId: input.correlationId,
          metadata: { key, versionId, workflowId },
          outcome: "SUCCESS",
          targetId: workflowId,
          targetType: "workflow",
          tenantId: input.tenantId,
        },
      });
    });

    const workflow = await this.requireWorkflow(input.tenantId, workflowId);
    return this.mapWorkflowResponse(workflow);
  }

  async updateDraft(input: UpdateWorkflowDraftInput): Promise<WorkflowResponse> {
    await this.requirePermission(input.tenantId, input.actorUserId, "workflow.update");

    const workflow = await this.requireWorkflow(input.tenantId, input.workflowId);
    let draft = workflow.versions.find((version) => version.state === ConfigPublicationState.DRAFT);
    const latest = workflow.versions[0];
    if (!latest) {
      throw new BadRequestException("Workflow has no versions");
    }

    const baseVersion = draft ?? latest;
    const mergedDefinition: WorkflowDefinition = {
      actions: input.actions ?? (baseVersion.actions as unknown as WorkflowAction[]),
      conditions: input.conditions ?? (baseVersion.conditions as unknown as WorkflowCondition[]),
      triggers: input.triggers ?? (baseVersion.triggers as unknown as WorkflowTrigger[]),
    };
    this.assertDraftDefinition(mergedDefinition);

    const nextPriority = input.priority ?? workflow.priority;
    if (input.priority !== undefined) {
      this.validatePriority(nextPriority);
      const conflict = await this.repository.findByPriority(
        input.tenantId,
        nextPriority,
        workflow.id,
      );
      if (conflict) {
        throw new ConflictException(`Another workflow already uses priority ${nextPriority}`);
      }
    }

    const definitionJson = {
      actions: mergedDefinition.actions as unknown as Prisma.InputJsonValue,
      conditions: mergedDefinition.conditions as unknown as Prisma.InputJsonValue,
      triggers: mergedDefinition.triggers as unknown as Prisma.InputJsonValue,
    };

    let draftVersionId: string;

    if (!draft) {
      draft = await this.repository.client.workflowVersion.create({
        data: {
          ...definitionJson,
          id: randomUUID(),
          state: ConfigPublicationState.DRAFT,
          tenantId: input.tenantId,
          versionNumber: latest.versionNumber + 1,
          workflowId: workflow.id,
        },
      });
      draftVersionId = draft.id;
    } else {
      draft = await this.repository.client.workflowVersion.update({
        data: definitionJson,
        where: { id: draft.id },
      });
      draftVersionId = draft.id;
    }

    await this.repository.client.workflow.update({
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        version: { increment: 1 },
      },
      where: { id: workflow.id },
    });

    await this.repository.createAudit({
      action: "workflow.draft_updated",
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
      metadata: { versionId: draftVersionId, workflowId: workflow.id },
      outcome: "SUCCESS",
      targetId: workflow.id,
      targetType: "workflow",
      tenantId: input.tenantId,
    });

    const updated = await this.requireWorkflow(input.tenantId, workflow.id);
    return this.mapWorkflowResponse(updated);
  }

  async publish(
    tenantId: string,
    workflowId: string,
    actorUserId: string,
    correlationId?: string,
  ): Promise<WorkflowResponse> {
    await this.requirePermission(tenantId, actorUserId, "workflow.publish");

    const workflow = await this.requireWorkflow(tenantId, workflowId);
    const draft = workflow.versions.find(
      (version) => version.state === ConfigPublicationState.DRAFT,
    );
    if (!draft) {
      throw new BadRequestException("No draft workflow version to publish");
    }

    const definition = this.definitionFromVersion(draft);
    const report = await this.validationService.validateForPublish(tenantId, definition);
    if (!report.valid) {
      await this.repository.createAudit({
        action: "workflow.published",
        actorUserId,
        correlationId,
        metadata: {
          errorCodes: report.errors.map((error) => error.code),
          errorCount: report.errors.length,
          workflowId,
        },
        outcome: "FAILURE",
        targetId: workflowId,
        targetType: "workflow",
        tenantId,
      });
      throw new BadRequestException({
        code: "VALIDATION_FAILED",
        message: "Workflow validation failed",
        report,
      });
    }

    const now = new Date();
    await this.repository.client.$transaction(async (tx) => {
      await tx.workflowVersion.updateMany({
        data: { state: ConfigPublicationState.RETIRED },
        where: {
          state: ConfigPublicationState.PUBLISHED,
          tenantId,
          workflowId,
        },
      });

      await tx.workflowVersion.update({
        data: { publishedAt: now, state: ConfigPublicationState.PUBLISHED },
        where: { id: draft.id },
      });

      await tx.workflow.update({
        data: {
          activeVersionNumber: draft.versionNumber,
          version: { increment: 1 },
        },
        where: { id: workflowId },
      });

      await tx.auditEvent.create({
        data: {
          action: "workflow.published",
          actorUserId,
          correlationId,
          metadata: { versionNumber: draft.versionNumber, workflowId },
          outcome: "SUCCESS",
          targetId: workflowId,
          targetType: "workflow",
          tenantId,
        },
      });
    });

    const published = await this.requireWorkflow(tenantId, workflowId);
    return this.mapWorkflowResponse(published);
  }

  async validate(
    tenantId: string,
    workflowId: string,
    actorUserId: string,
    correlationId?: string,
    definitionOverride?: WorkflowDefinition,
  ): Promise<WorkflowValidationReport> {
    await this.requirePermission(tenantId, actorUserId, "workflow.read");
    const workflow = await this.requireWorkflow(tenantId, workflowId);

    let definition = definitionOverride;
    if (!definition) {
      const draft = workflow.versions.find(
        (version) => version.state === ConfigPublicationState.DRAFT,
      );
      if (!draft) {
        throw new BadRequestException("No draft workflow version to validate");
      }
      definition = this.definitionFromVersion(draft);
    }

    const report = await this.validationService.validateForPublish(tenantId, definition);
    await this.repository.createAudit({
      action: "workflow.validated",
      actorUserId,
      correlationId,
      metadata: {
        errorCount: report.errors.length,
        valid: report.valid,
        warningCount: report.warnings.length,
        workflowId,
      },
      outcome: report.valid ? "SUCCESS" : "FAILURE",
      targetId: workflowId,
      targetType: "workflow",
      tenantId,
    });
    return report;
  }

  async cloneDraft(
    tenantId: string,
    workflowId: string,
    actorUserId: string,
    fromVersionNumber?: number,
    correlationId?: string,
  ): Promise<WorkflowResponse> {
    await this.requirePermission(tenantId, actorUserId, "workflow.update");
    const workflow = await this.requireWorkflow(tenantId, workflowId);

    const existingDraft = workflow.versions.find(
      (version) => version.state === ConfigPublicationState.DRAFT,
    );
    if (existingDraft) {
      throw new ConflictException("Draft already exists; update or publish it first");
    }

    const source = fromVersionNumber
      ? workflow.versions.find((version) => version.versionNumber === fromVersionNumber)
      : (workflow.versions.find((version) => version.state === ConfigPublicationState.PUBLISHED) ??
        workflow.versions[0]);

    if (!source) {
      throw new NotFoundException("Source workflow version not found");
    }

    const nextVersion =
      Math.max(...workflow.versions.map((version) => version.versionNumber), 0) + 1;

    await this.repository.client.workflowVersion.create({
      data: {
        actions: source.actions as Prisma.InputJsonValue,
        conditions: source.conditions as Prisma.InputJsonValue,
        id: randomUUID(),
        state: ConfigPublicationState.DRAFT,
        tenantId,
        triggers: source.triggers as Prisma.InputJsonValue,
        versionNumber: nextVersion,
        workflowId,
      },
    });

    await this.repository.createAudit({
      action: "workflow.draft_cloned",
      actorUserId,
      correlationId,
      metadata: {
        fromVersion: source.versionNumber,
        toVersion: nextVersion,
        workflowId,
      },
      outcome: "SUCCESS",
      targetId: workflowId,
      targetType: "workflow",
      tenantId,
    });

    const updated = await this.requireWorkflow(tenantId, workflowId);
    return this.mapWorkflowResponse(updated);
  }

  async diffVersions(
    tenantId: string,
    workflowId: string,
    actorUserId: string,
    fromVersion: number,
    toVersion: number,
  ) {
    await this.requirePermission(tenantId, actorUserId, "workflow.read");
    const workflow = await this.requireWorkflow(tenantId, workflowId);
    const from = workflow.versions.find((version) => version.versionNumber === fromVersion);
    const to = workflow.versions.find((version) => version.versionNumber === toVersion);
    if (!from || !to) {
      throw new NotFoundException("One or both workflow versions were not found");
    }

    return diffWorkflowSnapshots(
      fromVersion,
      toVersion,
      {
        actions: from.actions,
        conditions: from.conditions,
        triggers: from.triggers,
      },
      {
        actions: to.actions,
        conditions: to.conditions,
        triggers: to.triggers,
      },
    );
  }

  async pause(
    tenantId: string,
    workflowId: string,
    actorUserId: string,
    reason?: string,
    correlationId?: string,
  ): Promise<WorkflowResponse> {
    await this.requirePermission(tenantId, actorUserId, "workflow.pause");

    const workflow = await this.requireWorkflow(tenantId, workflowId);
    if (!workflow.enabled) {
      throw new BadRequestException("Workflow is already paused");
    }

    const now = new Date();
    await this.repository.client.workflow.update({
      data: {
        enabled: false,
        pausedAt: now,
        pausedReason: reason ?? null,
        version: { increment: 1 },
      },
      where: { id: workflowId },
    });

    await this.repository.createAudit({
      action: "workflow.paused",
      actorUserId,
      correlationId,
      metadata: { reason, workflowId },
      outcome: "SUCCESS",
      targetId: workflowId,
      targetType: "workflow",
      tenantId,
    });

    const updated = await this.requireWorkflow(tenantId, workflowId);
    return this.mapWorkflowResponse(updated);
  }

  async resume(
    tenantId: string,
    workflowId: string,
    actorUserId: string,
    correlationId?: string,
  ): Promise<WorkflowResponse> {
    await this.requirePermission(tenantId, actorUserId, "workflow.pause");

    const workflow = await this.requireWorkflow(tenantId, workflowId);
    if (workflow.enabled) {
      throw new BadRequestException("Workflow is not paused");
    }

    await this.repository.client.workflow.update({
      data: {
        enabled: true,
        pausedAt: null,
        pausedReason: null,
        version: { increment: 1 },
      },
      where: { id: workflowId },
    });

    await this.repository.createAudit({
      action: "workflow.resumed",
      actorUserId,
      correlationId,
      metadata: { workflowId },
      outcome: "SUCCESS",
      targetId: workflowId,
      targetType: "workflow",
      tenantId,
    });

    const updated = await this.requireWorkflow(tenantId, workflowId);
    return this.mapWorkflowResponse(updated);
  }

  async softDelete(
    tenantId: string,
    workflowId: string,
    actorUserId: string,
    correlationId?: string,
  ): Promise<void> {
    await this.requirePermission(tenantId, actorUserId, "workflow.update");

    await this.requireWorkflow(tenantId, workflowId);

    const now = new Date();
    await this.repository.client.workflow.update({
      data: {
        deletedAt: now,
        version: { increment: 1 },
      },
      where: { id: workflowId },
    });

    await this.repository.createAudit({
      action: "workflow.deleted",
      actorUserId,
      correlationId,
      metadata: { workflowId },
      outcome: "SUCCESS",
      targetId: workflowId,
      targetType: "workflow",
      tenantId,
    });
  }

  private mapWorkflowResponse(workflow: WorkflowWithVersions): WorkflowResponse {
    return {
      activeVersionNumber: workflow.activeVersionNumber,
      createdAt: workflow.createdAt,
      description: workflow.description,
      enabled: workflow.enabled,
      id: workflow.id,
      key: workflow.key,
      name: workflow.name,
      pausedAt: workflow.pausedAt,
      pausedReason: workflow.pausedReason,
      priority: workflow.priority,
      updatedAt: workflow.updatedAt,
      version: workflow.version,
      versions: workflow.versions.map((version) => ({
        actions: version.actions,
        conditions: version.conditions,
        createdAt: version.createdAt,
        id: version.id,
        publishedAt: version.publishedAt,
        state: version.state,
        triggers: version.triggers,
        updatedAt: version.updatedAt,
        versionNumber: version.versionNumber,
      })),
    };
  }

  private async requireWorkflow(
    tenantId: string,
    workflowId: string,
  ): Promise<WorkflowWithVersions> {
    const workflow = await this.repository.findById(tenantId, workflowId);
    if (!workflow) {
      throw new NotFoundException("Workflow not found");
    }
    return workflow;
  }

  private definitionFromVersion(version: {
    actions: unknown;
    conditions: unknown;
    triggers: unknown;
  }): WorkflowDefinition {
    return {
      actions: version.actions as WorkflowAction[],
      conditions: version.conditions as WorkflowCondition[],
      triggers: version.triggers as WorkflowTrigger[],
    };
  }

  private assertDraftDefinition(definition: WorkflowDefinition): void {
    const report = this.validationService.validateDraft(definition);
    if (!report.valid) {
      throw new BadRequestException({
        code: "VALIDATION_FAILED",
        message: "Workflow validation failed",
        report,
      });
    }
  }

  private validatePriority(priority: number): void {
    if (!Number.isInteger(priority) || priority <= 0) {
      throw new BadRequestException("priority must be a positive integer");
    }
  }

  private async requirePermission(tenantId: string, userId: string, permissionKey: string) {
    const allowed = await this.rbacService.can({ permissionKey, tenantId, userId });
    if (!allowed) {
      throw new ForbiddenException(`Missing permission ${permissionKey}`);
    }
  }
}
