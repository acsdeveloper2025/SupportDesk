import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ConfigPublicationState,
  type Prisma,
  TicketChannel,
  TicketPriority,
  TicketType,
} from "@prisma/client";

import { RbacService } from "../rbac/rbac.service";
import { SlaRepository } from "./sla.repository";

export interface CreatePolicyInput {
  tenantId: string;
  actorUserId: string;
  key: string;
  name: string;
  description?: string;
  priority: number;
  scheduleKey?: string;
  matchPriorities?: string[];
  matchTypes?: string[];
  matchChannels?: string[];
  responseMinutes: number;
  resolutionMinutes: number;
  pauseOnPending?: boolean;
  pauseOnHold?: boolean;
  restartResolutionOnReopen?: boolean;
  warningThresholdPercent?: number;
  correlationId?: string;
}

export interface UpdatePolicyDraftInput {
  tenantId: string;
  policyId: string;
  actorUserId: string;
  name?: string;
  description?: string | null;
  priority?: number;
  scheduleKey?: string;
  matchPriorities?: string[];
  matchTypes?: string[];
  matchChannels?: string[];
  responseMinutes?: number;
  resolutionMinutes?: number;
  pauseOnPending?: boolean;
  pauseOnHold?: boolean;
  restartResolutionOnReopen?: boolean;
  warningThresholdPercent?: number;
  correlationId?: string;
}

@Injectable()
export class SlaPoliciesService {
  constructor(
    @Inject(SlaRepository) private readonly repository: SlaRepository,
    @Inject(RbacService) private readonly rbacService: RbacService,
  ) {}

  async list(tenantId: string, actorUserId: string) {
    await this.requirePermission(tenantId, actorUserId, "sla.read");
    return this.repository.listPolicies(tenantId);
  }

  async get(tenantId: string, policyId: string, actorUserId: string) {
    await this.requirePermission(tenantId, actorUserId, "sla.read");
    const policy = await this.repository.findPolicyById(tenantId, policyId);
    if (!policy) {
      throw new NotFoundException("SLA policy not found");
    }
    return policy;
  }

  async create(input: CreatePolicyInput) {
    await this.requirePermission(input.tenantId, input.actorUserId, "sla.update");
    this.validateTargets(input.responseMinutes, input.resolutionMinutes);
    this.validateMatchLists(input.matchPriorities, input.matchTypes, input.matchChannels);

    const key = input.key.trim();
    if (!key) {
      throw new BadRequestException("Policy key is required");
    }

    const existing = await this.repository.findPolicyByKey(input.tenantId, key);
    if (existing) {
      throw new ConflictException("SLA policy with this key already exists");
    }

    const policyId = randomUUID();
    const versionId = randomUUID();

    await this.repository.client.$transaction(async (tx) => {
      await tx.slaPolicy.create({
        data: {
          description: input.description,
          id: policyId,
          key,
          name: input.name,
          tenantId: input.tenantId,
        },
      });

      await tx.slaPolicyVersion.create({
        data: {
          id: versionId,
          matchChannels: input.matchChannels ?? [],
          matchPriorities: input.matchPriorities ?? [],
          matchTypes: input.matchTypes ?? [],
          pauseOnHold: input.pauseOnHold ?? false,
          pauseOnPending: input.pauseOnPending ?? true,
          policyId,
          priority: input.priority,
          resolutionMinutes: input.resolutionMinutes,
          responseMinutes: input.responseMinutes,
          restartResolutionOnReopen: input.restartResolutionOnReopen ?? false,
          scheduleKey: input.scheduleKey ?? "default",
          state: ConfigPublicationState.DRAFT,
          tenantId: input.tenantId,
          versionNumber: 1,
          warningThresholdPercent: input.warningThresholdPercent ?? 80,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "sla.policy.created",
          actorUserId: input.actorUserId,
          correlationId: input.correlationId,
          metadata: { key, policyId, versionId },
          outcome: "SUCCESS",
          targetId: policyId,
          targetType: "sla_policy",
          tenantId: input.tenantId,
        },
      });
    });

    return this.repository.findPolicyById(input.tenantId, policyId);
  }

  async updateDraft(input: UpdatePolicyDraftInput) {
    await this.requirePermission(input.tenantId, input.actorUserId, "sla.update");
    const policy = await this.repository.findPolicyById(input.tenantId, input.policyId);
    if (!policy) {
      throw new NotFoundException("SLA policy not found");
    }

    let draft = policy.versions.find((version) => version.state === ConfigPublicationState.DRAFT);
    const latest = policy.versions[0];
    if (!latest) {
      throw new BadRequestException("Policy has no versions");
    }

    if (input.responseMinutes !== undefined || input.resolutionMinutes !== undefined) {
      this.validateTargets(
        input.responseMinutes ?? latest.responseMinutes,
        input.resolutionMinutes ?? latest.resolutionMinutes,
      );
    }

    this.validateMatchLists(
      input.matchPriorities ?? undefined,
      input.matchTypes ?? undefined,
      input.matchChannels ?? undefined,
    );

    if (!draft) {
      draft = await this.repository.client.slaPolicyVersion.create({
        data: {
          id: randomUUID(),
          matchChannels: (input.matchChannels ?? latest.matchChannels) as Prisma.InputJsonValue,
          matchPriorities: (input.matchPriorities ??
            latest.matchPriorities) as Prisma.InputJsonValue,
          matchTypes: (input.matchTypes ?? latest.matchTypes) as Prisma.InputJsonValue,
          pauseOnHold: input.pauseOnHold ?? latest.pauseOnHold,
          pauseOnPending: input.pauseOnPending ?? latest.pauseOnPending,
          policyId: policy.id,
          priority: input.priority ?? latest.priority,
          resolutionMinutes: input.resolutionMinutes ?? latest.resolutionMinutes,
          responseMinutes: input.responseMinutes ?? latest.responseMinutes,
          restartResolutionOnReopen:
            input.restartResolutionOnReopen ?? latest.restartResolutionOnReopen,
          scheduleKey: input.scheduleKey ?? latest.scheduleKey,
          state: ConfigPublicationState.DRAFT,
          tenantId: input.tenantId,
          versionNumber: latest.versionNumber + 1,
          warningThresholdPercent: input.warningThresholdPercent ?? latest.warningThresholdPercent,
        },
      });
    } else {
      draft = await this.repository.client.slaPolicyVersion.update({
        data: {
          ...(input.matchChannels !== undefined ? { matchChannels: input.matchChannels } : {}),
          ...(input.matchPriorities !== undefined
            ? { matchPriorities: input.matchPriorities }
            : {}),
          ...(input.matchTypes !== undefined ? { matchTypes: input.matchTypes } : {}),
          ...(input.pauseOnHold !== undefined ? { pauseOnHold: input.pauseOnHold } : {}),
          ...(input.pauseOnPending !== undefined ? { pauseOnPending: input.pauseOnPending } : {}),
          ...(input.priority !== undefined ? { priority: input.priority } : {}),
          ...(input.resolutionMinutes !== undefined
            ? { resolutionMinutes: input.resolutionMinutes }
            : {}),
          ...(input.responseMinutes !== undefined
            ? { responseMinutes: input.responseMinutes }
            : {}),
          ...(input.restartResolutionOnReopen !== undefined
            ? { restartResolutionOnReopen: input.restartResolutionOnReopen }
            : {}),
          ...(input.scheduleKey !== undefined ? { scheduleKey: input.scheduleKey } : {}),
          ...(input.warningThresholdPercent !== undefined
            ? { warningThresholdPercent: input.warningThresholdPercent }
            : {}),
        },
        where: { id: draft.id },
      });
    }

    if (input.name !== undefined || input.description !== undefined) {
      await this.repository.client.slaPolicy.update({
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          version: { increment: 1 },
        },
        where: { id: policy.id },
      });
    }

    await this.repository.createAudit({
      action: "sla.policy.draft_updated",
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
      metadata: { policyId: policy.id, versionId: draft.id },
      outcome: "SUCCESS",
      targetId: policy.id,
      targetType: "sla_policy",
      tenantId: input.tenantId,
    });

    return this.repository.findPolicyById(input.tenantId, policy.id);
  }

  async publish(tenantId: string, policyId: string, actorUserId: string, correlationId?: string) {
    await this.requirePermission(tenantId, actorUserId, "sla.update");
    const policy = await this.repository.findPolicyById(tenantId, policyId);
    if (!policy) {
      throw new NotFoundException("SLA policy not found");
    }

    const draft = policy.versions.find((version) => version.state === ConfigPublicationState.DRAFT);
    if (!draft) {
      throw new BadRequestException("No draft policy version to publish");
    }

    const schedule = await this.repository.findPublishedScheduleVersion(
      tenantId,
      draft.scheduleKey,
    );
    if (!schedule) {
      throw new BadRequestException(
        `Published business schedule '${draft.scheduleKey}' is required before publishing an SLA policy`,
      );
    }

    const conflict = await this.repository.client.slaPolicyVersion.findFirst({
      where: {
        priority: draft.priority,
        state: ConfigPublicationState.PUBLISHED,
        tenantId,
        NOT: { policyId },
      },
    });
    if (conflict) {
      throw new ConflictException(
        `Another published SLA policy already uses priority ${draft.priority}`,
      );
    }

    const now = new Date();
    await this.repository.client.$transaction(async (tx) => {
      await tx.slaPolicyVersion.updateMany({
        data: { state: ConfigPublicationState.RETIRED },
        where: {
          policyId,
          state: ConfigPublicationState.PUBLISHED,
          tenantId,
        },
      });

      await tx.slaPolicyVersion.update({
        data: { publishedAt: now, state: ConfigPublicationState.PUBLISHED },
        where: { id: draft.id },
      });

      await tx.slaPolicy.update({
        data: {
          activeVersionNumber: draft.versionNumber,
          version: { increment: 1 },
        },
        where: { id: policyId },
      });

      await tx.auditEvent.create({
        data: {
          action: "sla.policy.published",
          actorUserId,
          correlationId,
          metadata: { policyId, versionNumber: draft.versionNumber },
          outcome: "SUCCESS",
          targetId: policyId,
          targetType: "sla_policy",
          tenantId,
        },
      });
    });

    return this.repository.findPolicyById(tenantId, policyId);
  }

  private validateTargets(responseMinutes: number, resolutionMinutes: number) {
    if (!Number.isInteger(responseMinutes) || responseMinutes <= 0) {
      throw new BadRequestException("responseMinutes must be a positive integer");
    }
    if (!Number.isInteger(resolutionMinutes) || resolutionMinutes <= 0) {
      throw new BadRequestException("resolutionMinutes must be a positive integer");
    }
  }

  private validateMatchLists(priorities?: string[], types?: string[], channels?: string[]) {
    const priorityValues = new Set(Object.values(TicketPriority));
    const typeValues = new Set(Object.values(TicketType));
    const channelValues = new Set(Object.values(TicketChannel));

    for (const value of priorities ?? []) {
      if (!priorityValues.has(value as TicketPriority)) {
        throw new BadRequestException(`Invalid match priority: ${value}`);
      }
    }
    for (const value of types ?? []) {
      if (!typeValues.has(value as TicketType)) {
        throw new BadRequestException(`Invalid match type: ${value}`);
      }
    }
    for (const value of channels ?? []) {
      if (!channelValues.has(value as TicketChannel)) {
        throw new BadRequestException(`Invalid match channel: ${value}`);
      }
    }
  }

  private async requirePermission(tenantId: string, userId: string, permissionKey: string) {
    const allowed = await this.rbacService.can({ permissionKey, tenantId, userId });
    if (!allowed) {
      throw new ForbiddenException(`Missing permission ${permissionKey}`);
    }
  }
}
