import { Controller, Get, Post, Req, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";

import { AdminService } from "./admin.service";

interface AuthUser {
  userId: string;
  tenantId: string;
}

function getUserContext(req: Request): AuthUser {
  const user = (req as unknown as { user?: { userId?: string; tenantId?: string } }).user;
  if (!user || !user.userId || !user.tenantId) {
    throw new UnauthorizedException("Authentication required");
  }
  return { userId: user.userId, tenantId: user.tenantId };
}

@Controller("api/v1/admin/notifications")
export class NotificationAdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("monitoring")
  async getNotificationMonitoring(@Req() req: Request) {
    const user = getUserContext(req);
    return this.adminService.getNotificationMonitoring(user.tenantId);
  }

  @Post("retry-failed")
  async retryFailedNotificationIntents(@Req() req: Request) {
    const user = getUserContext(req);
    return this.adminService.retryFailedNotificationIntents(user.userId, user.tenantId);
  }
}
