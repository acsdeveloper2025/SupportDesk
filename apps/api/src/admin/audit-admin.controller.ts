import { Controller, Get, Query, Req, UnauthorizedException } from "@nestjs/common";
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

@Controller("api/v1/admin/audit")
export class AuditAdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("security-dashboard")
  async getSecurityDashboard(@Req() req: Request) {
    const user = getUserContext(req);
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
    const user = getUserContext(req);
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const takeNum = take ? parseInt(take, 10) : 50;

    return this.adminService.listAuditLogs(user.tenantId, action, actorUserId, skipNum, takeNum);
  }
}
