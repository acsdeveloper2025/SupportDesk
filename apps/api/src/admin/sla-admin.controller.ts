import { Controller, Get, Req, UnauthorizedException } from "@nestjs/common";
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

@Controller("api/v1/admin/sla")
export class SlaAdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("health")
  async getSlaEngineHealth(@Req() req: Request) {
    const user = getUserContext(req);
    return this.adminService.getSlaEngineHealth(user.tenantId);
  }
}
