import { Inject, Injectable } from "@nestjs/common";
import {
  type Notification as PrismaNotification,
  NotificationChannel,
  NotificationEventType,
  type NotificationPreference as PrismaNotificationPreference,
  type Prisma,
} from "@prisma/client";

import { type AuditEventInput, buildAuditEventData } from "../audit/audit-event";
import { PrismaService } from "../database/prisma.service";
import { NotificationEntity } from "./domain/notification.entity";

export interface NotificationFilters {
  unreadOnly?: boolean;
  archived?: boolean;
  eventTypes?: NotificationEventType[];
}

export interface NotificationSort {
  field: "createdAt";
  direction: "asc" | "desc";
}

export interface FindNotificationsParams {
  tenantId: string;
  recipientUserId: string;
  filters?: NotificationFilters;
  sort: NotificationSort;
  page: number;
  pageSize: number;
}

export interface NotificationPreferenceRecord {
  id: string;
  tenantId: string;
  userId: string;
  eventType: NotificationEventType;
  channel: NotificationChannel;
  enabled: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class NotificationsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(entity: NotificationEntity): Promise<NotificationEntity> {
    const created = await this.prisma.notification.create({
      data: {
        actorUserId: entity.actorUserId ?? null,
        body: entity.body ?? null,
        eventType: entity.eventType,
        id: entity.id,
        payload: (entity.payload ?? undefined) as Prisma.InputJsonValue | undefined,
        recipientUserId: entity.recipientUserId,
        resourceId: entity.resourceId ?? null,
        resourceType: entity.resourceType ?? null,
        tenantId: entity.tenantId,
        title: entity.title,
        version: entity.version,
      },
    });
    return this.mapToDomain(created);
  }

  async findById(tenantId: string, notificationId: string): Promise<NotificationEntity | null> {
    const record = await this.prisma.notification.findFirst({
      where: { id: notificationId, tenantId },
    });
    return record ? this.mapToDomain(record) : null;
  }

  async findMany(params: FindNotificationsParams): Promise<{
    items: NotificationEntity[];
    totalRecords: number;
  }> {
    const where = this.buildWhereClause(params);
    const [records, totalRecords] = await Promise.all([
      this.prisma.notification.findMany({
        orderBy: { [params.sort.field]: params.sort.direction },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        where,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items: records.map((record) => this.mapToDomain(record)),
      totalRecords,
    };
  }

  async countUnread(tenantId: string, recipientUserId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        archivedAt: null,
        readAt: null,
        recipientUserId,
        tenantId,
      },
    });
  }

  async updateWithAudit(
    entity: NotificationEntity,
    expectedVersion: number,
    audit: AuditEventInput,
  ): Promise<NotificationEntity> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.notification.updateMany({
        data: {
          archivedAt: entity.archivedAt ?? null,
          readAt: entity.readAt ?? null,
          updatedAt: entity.updatedAt,
          version: entity.version,
        },
        where: {
          id: entity.id,
          tenantId: entity.tenantId,
          version: expectedVersion,
        },
      });

      if (result.count === 0) {
        throw new Error("Notification concurrency conflict or not found");
      }

      await tx.auditEvent.create({
        data: buildAuditEventData(audit),
      });

      const updated = await tx.notification.findFirstOrThrow({
        where: { id: entity.id, tenantId: entity.tenantId },
      });
      return this.mapToDomain(updated);
    });
  }

  async findPreference(
    tenantId: string,
    userId: string,
    eventType: NotificationEventType,
    channel: NotificationChannel = NotificationChannel.IN_APP,
  ): Promise<NotificationPreferenceRecord | null> {
    const record = await this.prisma.notificationPreference.findUnique({
      where: {
        tenantId_userId_eventType_channel: {
          channel,
          eventType,
          tenantId,
          userId,
        },
      },
    });
    return record ? this.mapPreference(record) : null;
  }

  async listPreferences(tenantId: string, userId: string): Promise<NotificationPreferenceRecord[]> {
    const records = await this.prisma.notificationPreference.findMany({
      where: { tenantId, userId },
      orderBy: [{ eventType: "asc" }, { channel: "asc" }],
    });
    return records.map((record) => this.mapPreference(record));
  }

  async upsertPreference(
    input: {
      tenantId: string;
      userId: string;
      eventType: NotificationEventType;
      channel: NotificationChannel;
      enabled: boolean;
      expectedVersion?: number;
    },
    audit: AuditEventInput,
  ): Promise<NotificationPreferenceRecord> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.notificationPreference.findUnique({
        where: {
          tenantId_userId_eventType_channel: {
            channel: input.channel,
            eventType: input.eventType,
            tenantId: input.tenantId,
            userId: input.userId,
          },
        },
      });

      let record: PrismaNotificationPreference;
      if (existing) {
        if (input.expectedVersion !== undefined && existing.version !== input.expectedVersion) {
          throw new Error("Notification preference concurrency conflict");
        }
        record = await tx.notificationPreference.update({
          data: {
            enabled: input.enabled,
            version: existing.version + 1,
          },
          where: { id: existing.id },
        });
      } else {
        record = await tx.notificationPreference.create({
          data: {
            channel: input.channel,
            enabled: input.enabled,
            eventType: input.eventType,
            tenantId: input.tenantId,
            userId: input.userId,
            version: 1,
          },
        });
      }

      await tx.auditEvent.create({
        data: buildAuditEventData(audit),
      });

      return this.mapPreference(record);
    });
  }

  private buildWhereClause(params: FindNotificationsParams): Prisma.NotificationWhereInput {
    const where: Prisma.NotificationWhereInput = {
      recipientUserId: params.recipientUserId,
      tenantId: params.tenantId,
    };

    const filters = params.filters;
    if (!filters) {
      where.archivedAt = null;
      return where;
    }

    if (filters.unreadOnly) {
      where.readAt = null;
    }

    if (filters.archived === true) {
      where.archivedAt = { not: null };
    } else if (filters.archived === false || filters.archived === undefined) {
      where.archivedAt = null;
    }

    if (filters.eventTypes && filters.eventTypes.length > 0) {
      where.eventType = { in: filters.eventTypes };
    }

    return where;
  }

  private mapToDomain(record: PrismaNotification): NotificationEntity {
    return new NotificationEntity({
      actorUserId: record.actorUserId,
      archivedAt: record.archivedAt,
      body: record.body,
      createdAt: record.createdAt,
      eventType: record.eventType,
      id: record.id,
      payload: (record.payload as Record<string, unknown> | null) ?? null,
      readAt: record.readAt,
      recipientUserId: record.recipientUserId,
      resourceId: record.resourceId,
      resourceType: record.resourceType,
      tenantId: record.tenantId,
      title: record.title,
      updatedAt: record.updatedAt,
      version: record.version,
    });
  }

  private mapPreference(record: PrismaNotificationPreference): NotificationPreferenceRecord {
    return {
      channel: record.channel,
      createdAt: record.createdAt,
      enabled: record.enabled,
      eventType: record.eventType,
      id: record.id,
      tenantId: record.tenantId,
      updatedAt: record.updatedAt,
      userId: record.userId,
      version: record.version,
    };
  }
}
