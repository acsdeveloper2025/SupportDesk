import { randomUUID } from "node:crypto";

import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  type BusinessScheduleVersion,
  NotificationEventType,
  type SlaPolicyVersion,
  type SlaTarget,
  SlaTargetState,
  SlaTargetType,
  type Ticket,
  TicketStatus,
} from "@prisma/client";

import { NotificationsService } from "../notifications/notifications.service";
import {
  BusinessHoursClock,
  businessMinutesToMs,
  parseHolidays,
  parseWeeklyHours,
} from "./domain/business-hours-clock";
import { selectMatchingSlaPolicy } from "./domain/sla-policy-matcher";
import { asStringArray, SlaRepository } from "./sla.repository";

export interface TicketSlaContext {
  id: string;
  tenantId: string;
  publicRef: string;
  channel: Ticket["channel"];
  priority: Ticket["priority"];
  type: Ticket["type"];
  status: TicketStatus;
  requesterUserId: string;
  assigneeUserId?: string | null;
  createdAt?: Date;
}

@Injectable()
export class SlaEngineService {
  private readonly logger = new Logger(SlaEngineService.name);

  constructor(
    @Inject(SlaRepository) private readonly repository: SlaRepository,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
  ) {}

  async onTicketCreated(ticket: TicketSlaContext, actorUserId?: string): Promise<void> {
    try {
      await this.startTargetsForTicket(ticket, actorUserId);
    } catch (error) {
      this.logger.error(
        `Failed to start SLA targets for ticket=${ticket.id}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async onTicketStatusChanged(
    ticket: TicketSlaContext,
    previousStatus: TicketStatus,
    actorUserId?: string,
  ): Promise<void> {
    try {
      const now = new Date();
      await this.evaluateTargetsForTicket(ticket, now, actorUserId);

      if (ticket.status === TicketStatus.SOLVED) {
        await this.completeTarget(ticket, SlaTargetType.RESOLUTION, now, actorUserId);
      }

      if (previousStatus === TicketStatus.SOLVED && ticket.status === TicketStatus.OPEN) {
        await this.handleReopen(ticket, now, actorUserId);
      }

      await this.syncPauseState(ticket, now, actorUserId);
      await this.evaluateTargetsForTicket(ticket, now, actorUserId);
    } catch (error) {
      this.logger.error(
        `Failed SLA status handling for ticket=${ticket.id}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async onPublicAgentComment(
    ticket: TicketSlaContext,
    authorUserId: string,
    actorUserId?: string,
  ): Promise<void> {
    try {
      if (authorUserId === ticket.requesterUserId) {
        return;
      }
      const now = new Date();
      await this.completeTarget(ticket, SlaTargetType.RESPONSE, now, actorUserId ?? authorUserId);
      await this.evaluateTargetsForTicket(ticket, now, actorUserId ?? authorUserId);
    } catch (error) {
      this.logger.error(
        `Failed SLA response completion for ticket=${ticket.id}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async getTicketSlaStatus(tenantId: string, ticketId: string, now = new Date()) {
    const ticket = await this.repository.findTicket(tenantId, ticketId);
    if (!ticket) {
      return null;
    }

    await this.evaluateTargetsForTicket(
      {
        assigneeUserId: ticket.assigneeUserId,
        channel: ticket.channel,
        id: ticket.id,
        priority: ticket.priority,
        publicRef: ticket.publicRef,
        requesterUserId: ticket.requesterUserId,
        status: ticket.status,
        tenantId: ticket.tenantId,
        type: ticket.type,
      },
      now,
    );

    const targets = await this.repository.findTargetsForTicket(tenantId, ticketId);
    return targets.map((target) => this.toTargetView(target, now));
  }

  async listActiveTimers(
    tenantId: string,
    options: { page: number; pageSize: number; dueBefore?: Date; states?: SlaTargetState[] },
  ) {
    const now = new Date();
    const skip = (options.page - 1) * options.pageSize;
    const { items } = await this.repository.listActiveTimers(tenantId, {
      dueBefore: options.dueBefore,
      skip,
      states: options.states,
      take: options.pageSize,
    });

    for (const item of items) {
      await this.evaluateSingleTarget(
        item,
        {
          assigneeUserId: item.ticket.assigneeUserId,
          channel: item.ticket.channel,
          id: item.ticket.id,
          priority: item.ticket.priority,
          publicRef: item.ticket.publicRef,
          requesterUserId: item.ticket.requesterUserId,
          status: item.ticket.status,
          tenantId: item.ticket.tenantId,
          type: item.ticket.type,
        },
        now,
      );
    }

    const refreshed = await this.repository.listActiveTimers(tenantId, {
      dueBefore: options.dueBefore,
      skip,
      states: options.states,
      take: options.pageSize,
    });

    const totalPages =
      refreshed.totalRecords === 0 ? 0 : Math.ceil(refreshed.totalRecords / options.pageSize);

    return {
      currentPage: options.page,
      hasNextPage: options.page < totalPages,
      hasPreviousPage: options.page > 1 && totalPages > 0,
      items: refreshed.items.map((target) => this.toTargetView(target, now)),
      pageSize: options.pageSize,
      totalPages,
      totalRecords: refreshed.totalRecords,
    };
  }

  async getMetrics(tenantId: string, from: Date, to: Date) {
    return this.repository.metrics(tenantId, from, to);
  }

  private async startTargetsForTicket(ticket: TicketSlaContext, actorUserId?: string) {
    const published = await this.repository.listPublishedPolicyVersions(ticket.tenantId);
    const matched = selectMatchingSlaPolicy(
      published.map((policy) => ({
        ...policy,
        matchChannels: asStringArray(policy.matchChannels),
        matchPriorities: asStringArray(policy.matchPriorities),
        matchTypes: asStringArray(policy.matchTypes),
      })),
      {
        channel: ticket.channel,
        priority: ticket.priority,
        type: ticket.type,
      },
    );

    if (!matched) {
      return;
    }

    const scheduleVersion = await this.repository.findPublishedScheduleVersion(
      ticket.tenantId,
      matched.scheduleKey,
    );
    if (!scheduleVersion) {
      this.logger.warn(
        `No published schedule '${matched.scheduleKey}' for tenant=${ticket.tenantId}; skipping SLA`,
      );
      return;
    }

    const clock = this.clockFromSchedule(scheduleVersion);
    const startedAt = ticket.createdAt ?? new Date();

    await this.createTarget({
      actorUserId,
      clock,
      minutes: matched.responseMinutes,
      policyVersion: matched,
      scheduleVersion,
      startedAt,
      ticket,
      type: SlaTargetType.RESPONSE,
    });

    await this.createTarget({
      actorUserId,
      clock,
      minutes: matched.resolutionMinutes,
      policyVersion: matched,
      scheduleVersion,
      startedAt,
      ticket,
      type: SlaTargetType.RESOLUTION,
    });

    await this.syncPauseState(ticket, startedAt, actorUserId);
  }

  private async createTarget(input: {
    ticket: TicketSlaContext;
    type: SlaTargetType;
    policyVersion: SlaPolicyVersion;
    scheduleVersion: BusinessScheduleVersion;
    clock: BusinessHoursClock;
    minutes: number;
    startedAt: Date;
    actorUserId?: string;
  }) {
    const dueAt = input.clock.addBusinessMs(input.startedAt, businessMinutesToMs(input.minutes));
    const targetId = randomUUID();

    await this.repository.client.$transaction(async (tx) => {
      await tx.slaTarget.create({
        data: {
          dueAt,
          id: targetId,
          policyVersionId: input.policyVersion.id,
          scheduleVersionId: input.scheduleVersion.id,
          startedAt: input.startedAt,
          state: SlaTargetState.RUNNING,
          tenantId: input.ticket.tenantId,
          ticketId: input.ticket.id,
          type: input.type,
        },
      });

      await tx.slaEvaluation.create({
        data: {
          computedDueAt: dueAt,
          id: randomUUID(),
          inputs: {
            channel: input.ticket.channel,
            minutes: input.minutes,
            priority: input.ticket.priority,
            type: input.ticket.type,
          },
          policyVersionId: input.policyVersion.id,
          reason: "target_started",
          scheduleVersionId: input.scheduleVersion.id,
          targetId,
          tenantId: input.ticket.tenantId,
          ticketId: input.ticket.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "sla.target_created",
          actorUserId: input.actorUserId,
          metadata: {
            dueAt: dueAt.toISOString(),
            policyVersionId: input.policyVersion.id,
            publicRef: input.ticket.publicRef,
            scheduleVersionId: input.scheduleVersion.id,
            targetType: input.type,
          },
          outcome: "SUCCESS",
          targetId,
          targetType: "sla_target",
          tenantId: input.ticket.tenantId,
        },
      });
    });
  }

  private async completeTarget(
    ticket: TicketSlaContext,
    type: SlaTargetType,
    now: Date,
    actorUserId?: string,
  ) {
    const target = await this.repository.findActiveTarget(ticket.tenantId, ticket.id, type);
    if (!target) {
      return;
    }

    if (target.state === SlaTargetState.PAUSED && target.pausedAt) {
      await this.resumeTarget(target, ticket, now, actorUserId, false);
    }

    const current = await this.repository.findActiveTarget(ticket.tenantId, ticket.id, type);
    if (!current || current.state === SlaTargetState.BREACHED) {
      return;
    }

    await this.repository.client.$transaction(async (tx) => {
      await tx.slaTarget.update({
        data: {
          completedAt: now,
          state: SlaTargetState.MET,
          version: { increment: 1 },
        },
        where: { id: current.id },
      });

      await tx.auditEvent.create({
        data: {
          action: "sla.met",
          actorUserId,
          metadata: {
            completedAt: now.toISOString(),
            publicRef: ticket.publicRef,
            targetType: type,
          },
          outcome: "SUCCESS",
          targetId: current.id,
          targetType: "sla_target",
          tenantId: ticket.tenantId,
        },
      });
    });
  }

  private async handleReopen(ticket: TicketSlaContext, now: Date, actorUserId?: string) {
    const resolutionTargets = await this.repository.client.slaTarget.findMany({
      include: { policyVersion: true, scheduleVersion: true },
      orderBy: { createdAt: "desc" },
      take: 1,
      where: {
        tenantId: ticket.tenantId,
        ticketId: ticket.id,
        type: SlaTargetType.RESOLUTION,
      },
    });

    const latest = resolutionTargets[0];
    if (!latest?.policyVersion.restartResolutionOnReopen) {
      return;
    }

    const clock = this.clockFromSchedule(latest.scheduleVersion);
    await this.createTarget({
      actorUserId,
      clock,
      minutes: latest.policyVersion.resolutionMinutes,
      policyVersion: latest.policyVersion,
      scheduleVersion: latest.scheduleVersion,
      startedAt: now,
      ticket,
      type: SlaTargetType.RESOLUTION,
    });
  }

  private async syncPauseState(ticket: TicketSlaContext, now: Date, actorUserId?: string) {
    const targets = await this.repository.findActiveTargetsForTicket(ticket.tenantId, ticket.id);

    for (const target of targets) {
      const shouldPause = this.shouldPause(ticket.status, target.policyVersion);
      if (shouldPause && target.state === SlaTargetState.RUNNING) {
        await this.pauseTarget(target, ticket, now, actorUserId);
      } else if (!shouldPause && target.state === SlaTargetState.PAUSED) {
        await this.resumeTarget(target, ticket, now, actorUserId, true);
      }
    }
  }

  private shouldPause(status: TicketStatus, policy: SlaPolicyVersion): boolean {
    if (status === TicketStatus.PENDING) {
      return policy.pauseOnPending;
    }
    if (status === TicketStatus.ON_HOLD) {
      return policy.pauseOnHold;
    }
    return false;
  }

  private async pauseTarget(
    target: SlaTarget & {
      policyVersion: SlaPolicyVersion;
      scheduleVersion: BusinessScheduleVersion;
    },
    ticket: TicketSlaContext,
    now: Date,
    actorUserId?: string,
  ) {
    await this.repository.client.$transaction(async (tx) => {
      await tx.slaTarget.update({
        data: {
          pausedAt: now,
          state: SlaTargetState.PAUSED,
          version: { increment: 1 },
        },
        where: { id: target.id },
      });

      await tx.auditEvent.create({
        data: {
          action: "sla.paused",
          actorUserId,
          metadata: {
            pausedAt: now.toISOString(),
            publicRef: ticket.publicRef,
            targetType: target.type,
          },
          outcome: "SUCCESS",
          targetId: target.id,
          targetType: "sla_target",
          tenantId: ticket.tenantId,
        },
      });
    });
  }

  private async resumeTarget(
    target: SlaTarget & {
      policyVersion: SlaPolicyVersion;
      scheduleVersion: BusinessScheduleVersion;
    },
    ticket: TicketSlaContext,
    now: Date,
    actorUserId?: string,
    writeAudit = true,
  ) {
    if (!target.pausedAt) {
      return;
    }

    const clock = this.clockFromSchedule(target.scheduleVersion);
    const remaining = clock.remainingBusinessMs(target.pausedAt, target.dueAt);
    const dueAt = clock.addBusinessMs(now, remaining);
    const pauseMs = BigInt(Math.max(0, now.getTime() - target.pausedAt.getTime()));

    await this.repository.client.$transaction(async (tx) => {
      await tx.slaTarget.update({
        data: {
          accumulatedPauseMs: { increment: pauseMs },
          dueAt,
          pausedAt: null,
          state: SlaTargetState.RUNNING,
          version: { increment: 1 },
        },
        where: { id: target.id },
      });

      if (writeAudit) {
        await tx.auditEvent.create({
          data: {
            action: "sla.resumed",
            actorUserId,
            metadata: {
              dueAt: dueAt.toISOString(),
              publicRef: ticket.publicRef,
              targetType: target.type,
            },
            outcome: "SUCCESS",
            targetId: target.id,
            targetType: "sla_target",
            tenantId: ticket.tenantId,
          },
        });
      }
    });
  }

  private async evaluateTargetsForTicket(
    ticket: TicketSlaContext,
    now: Date,
    actorUserId?: string,
  ) {
    const targets = await this.repository.findActiveTargetsForTicket(ticket.tenantId, ticket.id);
    for (const target of targets) {
      await this.evaluateSingleTarget(target, ticket, now, actorUserId);
    }
  }

  private async evaluateSingleTarget(
    target: SlaTarget & {
      policyVersion: SlaPolicyVersion;
      scheduleVersion: BusinessScheduleVersion;
    },
    ticket: TicketSlaContext,
    now: Date,
    actorUserId?: string,
  ) {
    if (target.state === SlaTargetState.PAUSED) {
      return;
    }
    if (target.state !== SlaTargetState.RUNNING) {
      return;
    }

    const clock = this.clockFromSchedule(target.scheduleVersion);
    const totalMs = businessMinutesToMs(
      target.type === SlaTargetType.RESPONSE
        ? target.policyVersion.responseMinutes
        : target.policyVersion.resolutionMinutes,
    );
    const remaining = clock.remainingBusinessMs(now, target.dueAt);
    const elapsedRatio = totalMs === 0 ? 1 : 1 - remaining / totalMs;
    const warningRatio = target.policyVersion.warningThresholdPercent / 100;

    if (!target.warningNotifiedAt && elapsedRatio >= warningRatio && now < target.dueAt) {
      await this.repository.client.slaTarget.update({
        data: {
          warningNotifiedAt: now,
          version: { increment: 1 },
        },
        where: { id: target.id },
      });

      await this.repository.createAudit({
        action: "sla.warning",
        actorUserId,
        metadata: {
          dueAt: target.dueAt.toISOString(),
          publicRef: ticket.publicRef,
          targetType: target.type,
          thresholdPercent: target.policyVersion.warningThresholdPercent,
        },
        outcome: "SUCCESS",
        targetId: target.id,
        targetType: "sla_target",
        tenantId: ticket.tenantId,
      });

      await this.notifyAssignee(ticket, NotificationEventType.SLA_WARNING, {
        dueAt: target.dueAt.toISOString(),
        targetType: target.type,
      });
    }

    if (now >= target.dueAt) {
      await this.repository.client.$transaction(async (tx) => {
        await tx.slaTarget.update({
          data: {
            breachedAt: now,
            state: SlaTargetState.BREACHED,
            version: { increment: 1 },
          },
          where: { id: target.id },
        });

        await tx.auditEvent.create({
          data: {
            action: "sla.breached",
            actorUserId,
            metadata: {
              breachedAt: now.toISOString(),
              dueAt: target.dueAt.toISOString(),
              publicRef: ticket.publicRef,
              targetType: target.type,
            },
            outcome: "SUCCESS",
            targetId: target.id,
            targetType: "sla_target",
            tenantId: ticket.tenantId,
          },
        });
      });

      await this.notifyAssignee(ticket, NotificationEventType.SLA_BREACHED, {
        breachedAt: now.toISOString(),
        dueAt: target.dueAt.toISOString(),
        targetType: target.type,
      });
    }
  }

  private async notifyAssignee(
    ticket: TicketSlaContext,
    eventType: NotificationEventType,
    payload: Record<string, unknown>,
  ) {
    const recipientUserId = ticket.assigneeUserId ?? ticket.requesterUserId;
    const label = eventType === NotificationEventType.SLA_BREACHED ? "breached" : "at risk";
    await this.notificationsService.createSafe({
      body: `SLA ${String(payload.targetType)} ${label} for ticket ${ticket.publicRef}.`,
      eventType,
      payload: {
        publicRef: ticket.publicRef,
        ...payload,
      },
      recipientUserId,
      resourceId: ticket.id,
      resourceType: "ticket",
      tenantId: ticket.tenantId,
      title: `Ticket ${ticket.publicRef} SLA ${label}`,
    });
  }

  private clockFromSchedule(scheduleVersion: BusinessScheduleVersion): BusinessHoursClock {
    return new BusinessHoursClock({
      holidays: parseHolidays(scheduleVersion.holidays),
      timeZone: scheduleVersion.timeZone,
      weeklyHours: parseWeeklyHours(scheduleVersion.weeklyHours),
    });
  }

  private toTargetView(
    target: SlaTarget & {
      policyVersion?: SlaPolicyVersion;
      scheduleVersion?: BusinessScheduleVersion;
      ticket?: Ticket;
    },
    now: Date,
  ) {
    const scheduleVersion = target.scheduleVersion;
    let remainingBusinessMs: number | null = null;
    if (
      scheduleVersion &&
      (target.state === SlaTargetState.RUNNING || target.state === SlaTargetState.PAUSED)
    ) {
      const clock = this.clockFromSchedule(scheduleVersion);
      const reference =
        target.state === SlaTargetState.PAUSED && target.pausedAt ? target.pausedAt : now;
      remainingBusinessMs = clock.remainingBusinessMs(reference, target.dueAt);
    }

    return {
      accumulatedPauseMs: target.accumulatedPauseMs.toString(),
      breachedAt: target.breachedAt,
      completedAt: target.completedAt,
      dueAt: target.dueAt,
      id: target.id,
      policyVersionId: target.policyVersionId,
      remainingBusinessMs,
      scheduleVersionId: target.scheduleVersionId,
      startedAt: target.startedAt,
      state: target.state,
      ticketId: target.ticketId,
      type: target.type,
      warningNotifiedAt: target.warningNotifiedAt,
    };
  }
}
