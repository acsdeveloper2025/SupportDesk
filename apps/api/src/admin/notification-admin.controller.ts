import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { Request } from "express";

import { AuthAccessTokenGuard } from "../auth/guards/auth-access-token.guard";
import { getAuthenticatedRequestContext } from "../auth/guards/auth-context";
import { RbacService } from "../rbac/rbac.service";
import { AdminService } from "./admin.service";

@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
@Controller("api/v1/admin/notifications")
export class NotificationAdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly rbacService: RbacService,
  ) {}

  private requireAuth(req: Request): { userId: string; tenantId: string } {
    const context = getAuthenticatedRequestContext(req);
    if (!context) {
      throw new UnauthorizedException("Authentication required");
    }
    return { userId: context.userId, tenantId: context.tenantId };
  }

  private async requirePermission(tenantId: string, userId: string, permissionKey: string) {
    const allowed = await this.rbacService.can({ permissionKey, tenantId, userId });
    if (!allowed) {
      throw new ForbiddenException(`Permission ${permissionKey} denied`);
    }
  }

  @Get("monitoring")
  async getNotificationMonitoring(@Req() req: Request) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.notification.manage");
    return this.adminService.getNotificationMonitoring(user.tenantId);
  }

  @Post("retry-failed")
  async retryFailedNotificationIntents(@Req() req: Request) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.notification.manage");
    return this.adminService.retryFailedNotificationIntents(user.userId, user.tenantId);
  }
}
