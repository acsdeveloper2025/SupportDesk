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
import { DateTime } from "luxon";

import { RbacService } from "../rbac/rbac.service";
import { parseHolidays, parseWeeklyHours } from "./domain/business-hours-clock";
import { standardWeekdayNineToFive } from "./domain/schedule.types";
import { SlaRepository } from "./sla.repository";

export interface CreateScheduleInput {
  tenantId: string;
  actorUserId: string;
  key?: string;
  name: string;
  description?: string;
  timeZone: string;
  weeklyHours?: unknown;
  holidays?: unknown;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UpdateScheduleDraftInput {
  tenantId: string;
  scheduleId: string;
  actorUserId: string;
  name?: string;
  description?: string | null;
  timeZone?: string;
  weeklyHours?: unknown;
  holidays?: unknown;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class BusinessSchedulesService {
  constructor(
    @Inject(SlaRepository) private readonly repository: SlaRepository,
    @Inject(RbacService) private readonly rbacService: RbacService,
  ) {}

  async list(tenantId: string, actorUserId: string) {
    await this.requirePermission(tenantId, actorUserId, "sla.read");
    return this.repository.listSchedules(tenantId);
  }

  async get(tenantId: string, scheduleId: string, actorUserId: string) {
    await this.requirePermission(tenantId, actorUserId, "sla.read");
    const schedule = await this.repository.findScheduleById(tenantId, scheduleId);
    if (!schedule) {
      throw new NotFoundException("Business schedule not found");
    }
    return schedule;
  }

  async create(input: CreateScheduleInput) {
    await this.requirePermission(input.tenantId, input.actorUserId, "sla.update");

    const key = input.key?.trim() || "default";
    if (key !== "default") {
      throw new BadRequestException("MVP supports only the default business schedule key");
    }

    const existing = await this.repository.findScheduleByKey(input.tenantId, key);
    if (existing) {
      throw new ConflictException("Business schedule with this key already exists");
    }

    this.assertValidTimeZone(input.timeZone);
    const weeklyHours = parseWeeklyHours(input.weeklyHours ?? standardWeekdayNineToFive());
    const holidays = parseHolidays(input.holidays ?? []);

    const scheduleId = randomUUID();
    const versionId = randomUUID();
    const now = new Date();

    const created = await this.repository.client.$transaction(async (tx) => {
      const schedule = await tx.businessSchedule.create({
        data: {
          description: input.description,
          id: scheduleId,
          key,
          name: input.name,
          tenantId: input.tenantId,
        },
      });

      await tx.businessScheduleVersion.create({
        data: {
          holidays: holidays,
          id: versionId,
          scheduleId,
          state: ConfigPublicationState.DRAFT,
          tenantId: input.tenantId,
          timeZone: input.timeZone,
          versionNumber: 1,
          weeklyHours: weeklyHours as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "sla.schedule.created",
          actorUserId: input.actorUserId,
          correlationId: input.correlationId,
          metadata: { key, scheduleId, versionId },
          outcome: "SUCCESS",
          targetId: scheduleId,
          targetType: "business_schedule",
          tenantId: input.tenantId,
        },
      });

      return schedule;
    });

    void now;
    return this.repository.findScheduleById(input.tenantId, created.id);
  }

  async updateDraft(input: UpdateScheduleDraftInput) {
    await this.requirePermission(input.tenantId, input.actorUserId, "sla.update");
    const schedule = await this.repository.findScheduleById(input.tenantId, input.scheduleId);
    if (!schedule) {
      throw new NotFoundException("Business schedule not found");
    }

    let draft = schedule.versions.find((version) => version.state === ConfigPublicationState.DRAFT);
    const latest = schedule.versions[0];

    if (!draft) {
      if (!latest) {
        throw new BadRequestException("Schedule has no versions");
      }
      const nextNumber = latest.versionNumber + 1;
      draft = await this.repository.client.businessScheduleVersion.create({
        data: {
          holidays: (input.holidays !== undefined
            ? parseHolidays(input.holidays)
            : latest.holidays) as Prisma.InputJsonValue,
          id: randomUUID(),
          scheduleId: schedule.id,
          state: ConfigPublicationState.DRAFT,
          tenantId: input.tenantId,
          timeZone: input.timeZone ?? latest.timeZone,
          versionNumber: nextNumber,
          weeklyHours: (input.weeklyHours !== undefined
            ? parseWeeklyHours(input.weeklyHours)
            : latest.weeklyHours) as unknown as Prisma.InputJsonValue,
        },
      });
    } else {
      if (input.timeZone) {
        this.assertValidTimeZone(input.timeZone);
      }
      draft = await this.repository.client.businessScheduleVersion.update({
        data: {
          ...(input.timeZone ? { timeZone: input.timeZone } : {}),
          ...(input.weeklyHours !== undefined
            ? {
                weeklyHours: parseWeeklyHours(
                  input.weeklyHours,
                ) as unknown as Prisma.InputJsonValue,
              }
            : {}),
          ...(input.holidays !== undefined ? { holidays: parseHolidays(input.holidays) } : {}),
        },
        where: { id: draft.id },
      });
    }

    if (input.name !== undefined || input.description !== undefined) {
      await this.repository.client.businessSchedule.update({
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          version: { increment: 1 },
        },
        where: { id: schedule.id },
      });
    }

    await this.repository.createAudit({
      action: "sla.schedule.draft_updated",
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
      ipAddress: input.ipAddress,
      metadata: { scheduleId: schedule.id, versionId: draft.id },
      outcome: "SUCCESS",
      targetId: schedule.id,
      targetType: "business_schedule",
      tenantId: input.tenantId,
      userAgent: input.userAgent,
    });

    return this.repository.findScheduleById(input.tenantId, schedule.id);
  }

  async publish(tenantId: string, scheduleId: string, actorUserId: string, correlationId?: string) {
    await this.requirePermission(tenantId, actorUserId, "sla.update");
    const schedule = await this.repository.findScheduleById(tenantId, scheduleId);
    if (!schedule) {
      throw new NotFoundException("Business schedule not found");
    }

    const draft = schedule.versions.find(
      (version) => version.state === ConfigPublicationState.DRAFT,
    );
    if (!draft) {
      throw new BadRequestException("No draft schedule version to publish");
    }

    this.assertValidTimeZone(draft.timeZone);
    parseWeeklyHours(draft.weeklyHours);
    parseHolidays(draft.holidays);

    const now = new Date();
    await this.repository.client.$transaction(async (tx) => {
      if (schedule.activeVersionNumber) {
        await tx.businessScheduleVersion.updateMany({
          data: { state: ConfigPublicationState.RETIRED },
          where: {
            scheduleId,
            state: ConfigPublicationState.PUBLISHED,
            tenantId,
          },
        });
      }

      await tx.businessScheduleVersion.update({
        data: { publishedAt: now, state: ConfigPublicationState.PUBLISHED },
        where: { id: draft.id },
      });

      await tx.businessSchedule.update({
        data: {
          activeVersionNumber: draft.versionNumber,
          version: { increment: 1 },
        },
        where: { id: scheduleId },
      });

      await tx.auditEvent.create({
        data: {
          action: "sla.schedule.published",
          actorUserId,
          correlationId,
          metadata: { scheduleId, versionNumber: draft.versionNumber },
          outcome: "SUCCESS",
          targetId: scheduleId,
          targetType: "business_schedule",
          tenantId,
        },
      });
    });

    return this.repository.findScheduleById(tenantId, scheduleId);
  }

  private assertValidTimeZone(timeZone: string) {
    if (!DateTime.now().setZone(timeZone).isValid) {
      throw new BadRequestException(`Invalid IANA time zone: ${timeZone}`);
    }
  }

  private async requirePermission(tenantId: string, userId: string, permissionKey: string) {
    const allowed = await this.rbacService.can({ permissionKey, tenantId, userId });
    if (!allowed) {
      throw new ForbiddenException(`Missing permission ${permissionKey}`);
    }
  }
}
