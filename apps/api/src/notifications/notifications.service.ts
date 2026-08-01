import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PreconditionFailedException,
} from "@nestjs/common";
import { NotificationChannel, NotificationEventType } from "@prisma/client";

import { RbacService } from "../rbac/rbac.service";
import { NotificationEntity } from "./domain/notification.entity";
import {
  ALL_NOTIFICATION_EVENT_TYPES,
  DEFAULT_NOTIFICATION_CHANNEL,
  isMandatoryNotificationEvent,
} from "./notification.constants";
import {
  type NotificationFilters,
  type NotificationPreferenceRecord,
  type NotificationSort,
  NotificationsRepository,
} from "./notifications.repository";

export interface CreateNotificationInput {
  tenantId: string;
  recipientUserId: string;
  eventType: NotificationEventType;
  title: string;
  body?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  actorUserId?: string | null;
  payload?: Record<string, unknown> | null;
  /** Skip preference checks for mandatory/security notices forced by caller. */
  force?: boolean;
}

export interface ListNotificationsInput {
  tenantId: string;
  recipientUserId: string;
  filters?: NotificationFilters;
  sort: NotificationSort;
  page: number;
  pageSize: number;
}

export interface ListNotificationsResult {
  items: NotificationEntity[];
  totalRecords: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface UpdateNotificationInput {
  tenantId: string;
  notificationId: string;
  actorUserId: string;
  version: number;
  read?: boolean;
  archived?: boolean;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface PreferenceView {
  id: string | null;
  eventType: NotificationEventType;
  channel: NotificationChannel;
  enabled: boolean;
  mandatory: boolean;
  version: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(NotificationsRepository)
    private readonly notificationsRepository: NotificationsRepository,
    @Inject(RbacService) private readonly rbacService: RbacService,
  ) {}

  /**
   * Synchronously create an in-app notification for one recipient.
   * Returns null when suppressed (self-notify, disabled preference).
   * Never throws to callers of {@link createSafe}; use this when failure must surface.
   */
  async create(input: CreateNotificationInput): Promise<NotificationEntity | null> {
    if (input.actorUserId && input.actorUserId === input.recipientUserId) {
      return null;
    }

    const mandatory = isMandatoryNotificationEvent(input.eventType);
    if (!input.force && !mandatory) {
      const preference = await this.notificationsRepository.findPreference(
        input.tenantId,
        input.recipientUserId,
        input.eventType,
        NotificationChannel.IN_APP,
      );
      if (preference && !preference.enabled) {
        return null;
      }
    }

    const now = new Date();
    const entity = new NotificationEntity({
      actorUserId: input.actorUserId ?? null,
      body: input.body ?? null,
      createdAt: now,
      eventType: input.eventType,
      id: randomUUID(),
      payload: input.payload ?? null,
      recipientUserId: input.recipientUserId,
      resourceId: input.resourceId ?? null,
      resourceType: input.resourceType ?? null,
      tenantId: input.tenantId,
      title: input.title,
      updatedAt: now,
      version: 1,
    });

    return this.notificationsRepository.create(entity);
  }

  /**
   * Best-effort create that never fails the calling business transaction.
   */
  async createSafe(input: CreateNotificationInput): Promise<NotificationEntity | null> {
    try {
      return await this.create(input);
    } catch (error) {
      this.logger.error(
        `Failed to create notification eventType=${input.eventType} tenant=${input.tenantId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  async createManySafe(inputs: CreateNotificationInput[]): Promise<void> {
    for (const input of inputs) {
      await this.createSafe(input);
    }
  }

  async listForUser(input: ListNotificationsInput): Promise<ListNotificationsResult> {
    const { items, totalRecords } = await this.notificationsRepository.findMany({
      filters: input.filters,
      page: input.page,
      pageSize: input.pageSize,
      recipientUserId: input.recipientUserId,
      sort: input.sort,
      tenantId: input.tenantId,
    });

    const totalPages = totalRecords === 0 ? 0 : Math.ceil(totalRecords / input.pageSize);

    return {
      currentPage: input.page,
      hasNextPage: input.page < totalPages,
      hasPreviousPage: input.page > 1 && totalPages > 0,
      items,
      pageSize: input.pageSize,
      totalPages,
      totalRecords,
    };
  }

  async countUnread(tenantId: string, recipientUserId: string): Promise<number> {
    return this.notificationsRepository.countUnread(tenantId, recipientUserId);
  }

  async updateOwnNotification(input: UpdateNotificationInput): Promise<NotificationEntity> {
    const notification = await this.notificationsRepository.findById(
      input.tenantId,
      input.notificationId,
    );
    if (!notification || notification.recipientUserId !== input.actorUserId) {
      throw new NotFoundException("Notification not found");
    }

    const previousVersion = notification.version;
    if (input.version !== previousVersion) {
      throw new PreconditionFailedException({
        code: "PRECONDITION_FAILED",
        message: "Notification version is stale",
      });
    }

    const changed = notification.applyStateUpdate(previousVersion, {
      archived: input.archived,
      read: input.read,
    });
    if (!changed) {
      return notification;
    }

    const action =
      input.archived === true
        ? "notification.archived"
        : input.archived === false
          ? "notification.unarchived"
          : input.read === false
            ? "notification.unread"
            : "notification.read";

    try {
      return await this.notificationsRepository.updateWithAudit(notification, previousVersion, {
        action,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        ipAddress: input.ipAddress,
        metadata: {
          archived: notification.isArchived,
          eventType: notification.eventType,
          read: notification.isRead,
        },
        outcome: "SUCCESS",
        targetId: notification.id,
        targetType: "notification",
        tenantId: input.tenantId,
        userAgent: input.userAgent,
      });
    } catch {
      throw new PreconditionFailedException({
        code: "PRECONDITION_FAILED",
        message: "Notification version is stale",
      });
    }
  }

  async getPreferences(
    tenantId: string,
    targetUserId: string,
    actorUserId: string,
  ): Promise<{ userId: string; preferences: PreferenceView[] }> {
    await this.assertPreferenceAccess(tenantId, targetUserId, actorUserId, "read");

    const stored = await this.notificationsRepository.listPreferences(tenantId, targetUserId);
    const byKey = new Map(
      stored.map((item) => [`${item.eventType}:${item.channel}`, item] as const),
    );

    const preferences = ALL_NOTIFICATION_EVENT_TYPES.map((eventType) => {
      const channel = DEFAULT_NOTIFICATION_CHANNEL;
      const record = byKey.get(`${eventType}:${channel}`) ?? null;
      return this.toPreferenceView(eventType, channel, record);
    });

    return { preferences, userId: targetUserId };
  }

  async updatePreferences(input: {
    tenantId: string;
    targetUserId: string;
    actorUserId: string;
    preferences: Array<{
      eventType: NotificationEventType;
      channel: NotificationChannel;
      enabled: boolean;
      version?: number;
    }>;
    correlationId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ userId: string; preferences: PreferenceView[] }> {
    await this.assertPreferenceAccess(
      input.tenantId,
      input.targetUserId,
      input.actorUserId,
      "update",
    );

    for (const preference of input.preferences) {
      if (!preference.enabled && isMandatoryNotificationEvent(preference.eventType)) {
        throw new BadRequestException({
          code: "VALIDATION_FAILED",
          message: `Mandatory notification event ${preference.eventType} cannot be disabled`,
        });
      }

      try {
        await this.notificationsRepository.upsertPreference(
          {
            channel: preference.channel,
            enabled: preference.enabled,
            eventType: preference.eventType,
            expectedVersion: preference.version,
            tenantId: input.tenantId,
            userId: input.targetUserId,
          },
          {
            action: "notification.preference.updated",
            actorUserId: input.actorUserId,
            correlationId: input.correlationId,
            ipAddress: input.ipAddress,
            metadata: {
              channel: preference.channel,
              enabled: preference.enabled,
              eventType: preference.eventType,
              targetUserId: input.targetUserId,
            },
            outcome: "SUCCESS",
            targetId: input.targetUserId,
            targetType: "notification_preference",
            tenantId: input.tenantId,
            userAgent: input.userAgent,
          },
        );
      } catch {
        throw new PreconditionFailedException({
          code: "PRECONDITION_FAILED",
          message: "Notification preference version is stale",
        });
      }
    }

    return this.getPreferences(input.tenantId, input.targetUserId, input.actorUserId);
  }

  private toPreferenceView(
    eventType: NotificationEventType,
    channel: NotificationChannel,
    record: NotificationPreferenceRecord | null,
  ): PreferenceView {
    return {
      channel,
      enabled: record ? record.enabled : true,
      eventType,
      id: record?.id ?? null,
      mandatory: isMandatoryNotificationEvent(eventType),
      version: record?.version ?? 1,
    };
  }

  private async assertPreferenceAccess(
    tenantId: string,
    targetUserId: string,
    actorUserId: string,
    mode: "read" | "update",
  ): Promise<void> {
    if (targetUserId === actorUserId) {
      return;
    }

    const permissionKey =
      mode === "read" ? "notification.preference.read" : "notification.preference.update";
    const allowed = await this.rbacService.can({
      permissionKey,
      tenantId,
      userId: actorUserId,
    });
    if (!allowed) {
      throw new ForbiddenException(`Lacks required ${permissionKey} permission`);
    }
  }
}
