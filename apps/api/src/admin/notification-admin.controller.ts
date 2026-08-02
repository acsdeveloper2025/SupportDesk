import { Controller, Get, Post, Req, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";

import { AdminService } from "./admin.service";

interface AuthUser {
  userId: string;
  tenantId?: string;
}

function getUserContext(req: Request): AuthUser {
  const user = (req as unknown as { user?: AuthUser }).user;
  if (!user) throw new UnauthorizedException("Authentication required");
  return user;
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
