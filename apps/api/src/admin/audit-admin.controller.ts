import {
  Controller,
  ForbiddenException,
  Get,
  Query,
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
@Controller("api/v1/admin/audit")
export class AuditAdminController {
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

  @Get("security-dashboard")
  async getSecurityDashboard(@Req() req: Request) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.audit.read");
    return this.adminService.getSecurityDashboard(user.tenantId);
  }

  @Get("logs")
  async listAuditLogs(
    @Req() req: Request,
    @Query("action") action?: string,
    @Query("actorUserId") actorUserId?: string,
    @Query("skip") skip?: string,
    @Query("take") take?: string,
  ) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.audit.read");
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const takeNum = take ? parseInt(take, 10) : 50;

    return this.adminService.listAuditLogs(user.tenantId, action, actorUserId, skipNum, takeNum);
  }
}
