import { Inject, Injectable } from "@nestjs/common";
import {
  ConfigPublicationState,
  type Prisma,
  SlaTargetState,
  type SlaTargetType,
  TicketChannel,
  TicketPriority,
  TicketStatus,
  TicketType,
} from "@prisma/client";

import { type AuditEventInput, buildAuditEventData } from "../audit/audit-event";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class SlaRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  get client() {
    return this.prisma;
  }

  async createAudit(audit: AuditEventInput) {
    return this.prisma.auditEvent.create({ data: buildAuditEventData(audit) });
  }

  async findScheduleByKey(tenantId: string, key: string) {
    return this.prisma.businessSchedule.findFirst({
      include: { versions: { orderBy: { versionNumber: "desc" } } },
      where: { deletedAt: null, key, tenantId },
    });
  }

  async findScheduleById(tenantId: string, id: string) {
    return this.prisma.businessSchedule.findFirst({
      include: { versions: { orderBy: { versionNumber: "desc" } } },
      where: { deletedAt: null, id, tenantId },
    });
  }

  async listSchedules(tenantId: string) {
    return this.prisma.businessSchedule.findMany({
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 5,
        },
      },
      orderBy: { key: "asc" },
      where: { deletedAt: null, tenantId },
    });
  }

  async findPublishedScheduleVersion(tenantId: string, scheduleKey: string) {
    const schedule = await this.prisma.businessSchedule.findFirst({
      where: { deletedAt: null, key: scheduleKey, tenantId },
    });
    if (!schedule?.activeVersionNumber) {
      return null;
    }
    return this.prisma.businessScheduleVersion.findFirst({
      where: {
        scheduleId: schedule.id,
        state: ConfigPublicationState.PUBLISHED,
        tenantId,
        versionNumber: schedule.activeVersionNumber,
      },
    });
  }

  async findPolicyById(tenantId: string, id: string) {
    return this.prisma.slaPolicy.findFirst({
      include: { versions: { orderBy: { versionNumber: "desc" } } },
      where: { deletedAt: null, id, tenantId },
    });
  }

  async findPolicyByKey(tenantId: string, key: string) {
    return this.prisma.slaPolicy.findFirst({
      include: { versions: { orderBy: { versionNumber: "desc" } } },
      where: { deletedAt: null, key, tenantId },
    });
  }

  async listPolicies(tenantId: string) {
    return this.prisma.slaPolicy.findMany({
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 5,
        },
      },
      orderBy: { key: "asc" },
      where: { deletedAt: null, tenantId },
    });
  }

  async listPublishedPolicyVersions(tenantId: string) {
    return this.prisma.slaPolicyVersion.findMany({
      orderBy: { priority: "asc" },
      where: { state: ConfigPublicationState.PUBLISHED, tenantId },
    });
  }

  /** Published version of a specific pinned policy (Service Catalog mapping). */
  async findPublishedPolicyVersionById(tenantId: string, policyId: string) {
    return this.prisma.slaPolicyVersion.findFirst({
      where: {
        policyId,
        tenantId,
        state: ConfigPublicationState.PUBLISHED,
        policy: { deletedAt: null },
      },
    });
  }

  async findActiveTargetsForTicket(tenantId: string, ticketId: string) {
    return this.prisma.slaTarget.findMany({
      include: {
        policyVersion: true,
        scheduleVersion: true,
      },
      orderBy: { type: "asc" },
      where: {
        state: { in: [SlaTargetState.RUNNING, SlaTargetState.PAUSED] },
        tenantId,
        ticketId,
      },
    });
  }

  async findTargetsForTicket(tenantId: string, ticketId: string) {
    return this.prisma.slaTarget.findMany({
      include: {
        policyVersion: true,
        scheduleVersion: true,
      },
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
      where: { tenantId, ticketId },
    });
  }

  async findActiveTarget(tenantId: string, ticketId: string, type: SlaTargetType) {
    return this.prisma.slaTarget.findFirst({
      include: {
        policyVersion: true,
        scheduleVersion: true,
      },
      where: {
        state: { in: [SlaTargetState.RUNNING, SlaTargetState.PAUSED] },
        tenantId,
        ticketId,
        type,
      },
    });
  }

  async listActiveTimers(
    tenantId: string,
    options: {
      states?: SlaTargetState[];
      dueBefore?: Date;
      skip: number;
      take: number;
    },
  ) {
    const where: Prisma.SlaTargetWhereInput = {
      state: {
        in: options.states ?? [SlaTargetState.RUNNING, SlaTargetState.PAUSED],
      },
      tenantId,
      ...(options.dueBefore ? { dueAt: { lte: options.dueBefore } } : {}),
    };

    const [items, totalRecords] = await Promise.all([
      this.prisma.slaTarget.findMany({
        include: {
          policyVersion: true,
          scheduleVersion: true,
          ticket: true,
        },
        orderBy: { dueAt: "asc" },
        skip: options.skip,
        take: options.take,
        where,
      }),
      this.prisma.slaTarget.count({ where }),
    ]);

    return { items, totalRecords };
  }

  async metrics(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<{ breached: number; met: number; running: number; paused: number }> {
    const [breached, met, running, paused] = await Promise.all([
      this.prisma.slaTarget.count({
        where: {
          breachedAt: { gte: from, lte: to },
          state: SlaTargetState.BREACHED,
          tenantId,
        },
      }),
      this.prisma.slaTarget.count({
        where: {
          completedAt: { gte: from, lte: to },
          state: SlaTargetState.MET,
          tenantId,
        },
      }),
      this.prisma.slaTarget.count({
        where: { state: SlaTargetState.RUNNING, tenantId },
      }),
      this.prisma.slaTarget.count({
        where: { state: SlaTargetState.PAUSED, tenantId },
      }),
    ]);

    return { breached, met, paused, running };
  }

  async findTicket(tenantId: string, ticketId: string) {
    return this.prisma.ticket.findFirst({
      where: { deletedAt: null, id: ticketId, tenantId },
    });
  }
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

export function parseTicketEnums(value: {
  channel: string;
  priority: string;
  status: TicketStatus;
  type: string;
}): {
  channel: TicketChannel;
  priority: TicketPriority;
  status: TicketStatus;
  type: TicketType;
} {
  return {
    channel: value.channel as TicketChannel,
    priority: value.priority as TicketPriority,
    status: value.status,
    type: value.type as TicketType,
  };
}
