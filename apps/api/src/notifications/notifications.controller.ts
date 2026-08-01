import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPreconditionFailedResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request } from "express";

import { AuthAccessTokenGuard } from "../auth/guards/auth-access-token.guard";
import { getAuthenticatedRequestContext } from "../auth/guards/auth-context";
import { getCorrelationId } from "../common/logging/correlation-id";
import {
  ListNotificationsQueryDto,
  parseListNotificationsQuery,
} from "./dto/list-notifications.dto";
import {
  NotificationCountResponseDto,
  NotificationListResponseDto,
  NotificationPreferencesResponseDto,
  NotificationResponseDto,
  toNotificationResponseDto,
} from "./dto/notification-response.dto";
import {
  parseUpdateNotificationRequest,
  UpdateNotificationRequestDto,
} from "./dto/update-notification.dto";
import {
  parseUpdateNotificationPreferencesRequest,
  UpdateNotificationPreferencesRequestDto,
} from "./dto/update-preferences.dto";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@Controller("api/v1")
@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
  ) {}

  @Get("notifications")
  @ApiOperation({
    description: "List in-app notifications for the authenticated user within the active tenant.",
    summary: "List own notifications",
  })
  @ApiOkResponse({ description: "Paged notification list.", type: NotificationListResponseDto })
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  @ApiBadRequestResponse({ description: "Invalid query." })
  async listNotifications(
    @Query() query: ListNotificationsQueryDto,
    @Req() request: Request,
  ): Promise<NotificationListResponseDto> {
    const context = this.requireAuth(request);
    const parsed = parseListNotificationsQuery(query as unknown as Record<string, unknown>);

    const result = await this.notificationsService.listForUser({
      filters: {
        archived: parsed.archived,
        eventTypes: parsed.eventType,
        unreadOnly: parsed.unreadOnly,
      },
      page: parsed.page,
      pageSize: parsed.pageSize,
      recipientUserId: context.userId,
      sort: { direction: parsed.sortDir, field: parsed.sortBy },
      tenantId: context.tenantId,
    });

    return {
      currentPage: result.currentPage,
      data: result.items.map(toNotificationResponseDto),
      hasNextPage: result.hasNextPage,
      hasPreviousPage: result.hasPreviousPage,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      totalRecords: result.totalRecords,
    };
  }

  @Get("notifications/count")
  @ApiOperation({
    description: "Return unread in-app notification count for the authenticated user.",
    summary: "Count unread notifications",
  })
  @ApiOkResponse({ description: "Unread count.", type: NotificationCountResponseDto })
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  async countUnread(@Req() request: Request): Promise<NotificationCountResponseDto> {
    const context = this.requireAuth(request);
    const unreadCount = await this.notificationsService.countUnread(
      context.tenantId,
      context.userId,
    );
    return { unreadCount };
  }

  @Patch("notifications/:notificationId")
  @ApiOperation({
    description: "Mark an own in-app notification as read/unread and/or archived.",
    summary: "Update own notification",
  })
  @ApiOkResponse({ description: "Updated notification.", type: NotificationResponseDto })
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  @ApiNotFoundResponse({ description: "Notification not found." })
  @ApiBadRequestResponse({ description: "Invalid body." })
  @ApiPreconditionFailedResponse({ description: "Stale version." })
  async updateNotification(
    @Param("notificationId") notificationId: string,
    @Body() body: UpdateNotificationRequestDto,
    @Req() request: Request,
  ): Promise<NotificationResponseDto> {
    const context = this.requireAuth(request);
    const parsed = parseUpdateNotificationRequest(body);
    const updated = await this.notificationsService.updateOwnNotification({
      actorUserId: context.userId,
      archived: parsed.archived,
      correlationId: getCorrelationId(request),
      ipAddress: request.ip,
      notificationId,
      read: parsed.read,
      tenantId: context.tenantId,
      userAgent: request.headers["user-agent"],
      version: parsed.version,
    });
    return toNotificationResponseDto(updated);
  }

  @Get("notification-preferences")
  @ApiOperation({
    description:
      "Get notification preferences for the authenticated user (defaults enabled when unset).",
    summary: "Get own notification preferences",
  })
  @ApiOkResponse({
    description: "Preference list.",
    type: NotificationPreferencesResponseDto,
  })
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  @ApiForbiddenResponse({ description: "Missing preference read permission for other users." })
  async getPreferences(@Req() request: Request): Promise<NotificationPreferencesResponseDto> {
    const context = this.requireAuth(request);
    const result = await this.notificationsService.getPreferences(
      context.tenantId,
      context.userId,
      context.userId,
    );
    return result;
  }

  @Patch("notification-preferences")
  @ApiOperation({
    description:
      "Update own notification preferences. Mandatory security notices cannot be disabled.",
    summary: "Update own notification preferences",
  })
  @ApiOkResponse({
    description: "Updated preferences.",
    type: NotificationPreferencesResponseDto,
  })
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  @ApiBadRequestResponse({ description: "Invalid body or mandatory event disabled." })
  @ApiForbiddenResponse({ description: "Missing preference update permission for other users." })
  @ApiPreconditionFailedResponse({ description: "Stale preference version." })
  async updatePreferences(
    @Body() body: UpdateNotificationPreferencesRequestDto,
    @Req() request: Request,
  ): Promise<NotificationPreferencesResponseDto> {
    const context = this.requireAuth(request);
    const parsed = parseUpdateNotificationPreferencesRequest(body);
    return this.notificationsService.updatePreferences({
      actorUserId: context.userId,
      correlationId: getCorrelationId(request),
      ipAddress: request.ip,
      preferences: parsed.preferences.map((item) => ({
        channel: item.channel,
        enabled: item.enabled,
        eventType: item.eventType,
        version: item.version,
      })),
      targetUserId: context.userId,
      tenantId: context.tenantId,
      userAgent: request.headers["user-agent"],
    });
  }

  private requireAuth(request: Request) {
    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException("Authentication required");
    }
    return context;
  }
}
