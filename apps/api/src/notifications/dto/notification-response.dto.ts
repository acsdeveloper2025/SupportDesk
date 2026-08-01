import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { NotificationChannel, NotificationEventType } from "@prisma/client";

import type { NotificationEntity } from "../domain/notification.entity";
import type { NotificationPreferenceRecord } from "../notifications.repository";

export class NotificationResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String, format: "uuid" })
  tenantId!: string;

  @ApiProperty({ type: String, format: "uuid" })
  recipientUserId!: string;

  @ApiProperty({ enum: NotificationEventType })
  eventType!: NotificationEventType;

  @ApiProperty({ type: String })
  title!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  body!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  resourceType!: string | null;

  @ApiPropertyOptional({ format: "uuid", nullable: true, type: String })
  resourceId!: string | null;

  @ApiPropertyOptional({ format: "uuid", nullable: true, type: String })
  actorUserId!: string | null;

  @ApiPropertyOptional({
    additionalProperties: true,
    nullable: true,
    type: "object",
  })
  payload!: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  readAt!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  archivedAt!: string | null;

  @ApiProperty({ type: Boolean })
  isRead!: boolean;

  @ApiProperty({ type: Boolean })
  isArchived!: boolean;

  @ApiProperty({ type: Number })
  version!: number;

  @ApiProperty({ type: String })
  createdAt!: string;

  @ApiProperty({ type: String })
  updatedAt!: string;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: () => [NotificationResponseDto] })
  data!: NotificationResponseDto[];

  @ApiProperty({ type: Number })
  totalRecords!: number;

  @ApiProperty({ type: Number })
  totalPages!: number;

  @ApiProperty({ type: Number })
  currentPage!: number;

  @ApiProperty({ type: Number })
  pageSize!: number;

  @ApiProperty({ type: Boolean })
  hasNextPage!: boolean;

  @ApiProperty({ type: Boolean })
  hasPreviousPage!: boolean;
}

export class NotificationCountResponseDto {
  @ApiProperty({
    description: "Unread, non-archived notification count for the current user.",
    type: Number,
  })
  unreadCount!: number;
}

export class NotificationPreferenceItemDto {
  @ApiPropertyOptional({ format: "uuid", nullable: true, type: String })
  id!: string | null;

  @ApiProperty({ enum: NotificationEventType })
  eventType!: NotificationEventType;

  @ApiProperty({ enum: NotificationChannel })
  channel!: NotificationChannel;

  @ApiProperty({ type: Boolean })
  enabled!: boolean;

  @ApiProperty({ type: Boolean })
  mandatory!: boolean;

  @ApiProperty({ type: Number })
  version!: number;
}

export class NotificationPreferencesResponseDto {
  @ApiProperty({ format: "uuid", type: String })
  userId!: string;

  @ApiProperty({ type: () => [NotificationPreferenceItemDto] })
  preferences!: NotificationPreferenceItemDto[];
}

export function toNotificationResponseDto(entity: NotificationEntity): NotificationResponseDto {
  return {
    actorUserId: entity.actorUserId ?? null,
    archivedAt: entity.archivedAt ? entity.archivedAt.toISOString() : null,
    body: entity.body ?? null,
    createdAt: entity.createdAt.toISOString(),
    eventType: entity.eventType,
    id: entity.id,
    isArchived: entity.isArchived,
    isRead: entity.isRead,
    payload: entity.payload ?? null,
    readAt: entity.readAt ? entity.readAt.toISOString() : null,
    recipientUserId: entity.recipientUserId,
    resourceId: entity.resourceId ?? null,
    resourceType: entity.resourceType ?? null,
    tenantId: entity.tenantId,
    title: entity.title,
    updatedAt: entity.updatedAt.toISOString(),
    version: entity.version,
  };
}

export function toPreferenceItemDto(
  record: NotificationPreferenceRecord | null,
  eventType: NotificationEventType,
  channel: NotificationChannel,
  mandatory: boolean,
): NotificationPreferenceItemDto {
  return {
    channel,
    enabled: record ? record.enabled : true,
    eventType,
    id: record?.id ?? null,
    mandatory,
    version: record?.version ?? 1,
  };
}
