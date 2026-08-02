import { Body, Controller, Get, Post, Req, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";

import { AdminService } from "./admin.service";
import { FeatureFlagDto, GlobalSettingDto, MaintenanceWindowDto } from "./admin.types";

interface AuthUser {
  userId: string;
  tenantId?: string;
}

function getUserContext(req: Request): AuthUser {
  const user = (req as unknown as { user?: AuthUser }).user;
  if (!user) throw new UnauthorizedException("Authentication required");
  return user;
}

@Controller("api/v1/admin")
export class GlobalAdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("settings")
  async getGlobalSettings(@Req() req: Request) {
    getUserContext(req);
    return this.adminService.getGlobalSettings();
  }

  @Post("settings")
  async updateGlobalSetting(@Req() req: Request, @Body() dto: GlobalSettingDto) {
    const user = getUserContext(req);
    return this.adminService.updateGlobalSetting(user.userId, dto);
  }

  @Get("feature-flags")
  async getFeatureFlags(@Req() req: Request) {
    const user = getUserContext(req);
    return this.adminService.getFeatureFlags(user.tenantId);
  }

  @Post("feature-flags")
  async setFeatureFlag(@Req() req: Request, @Body() dto: FeatureFlagDto) {
    const user = getUserContext(req);
    return this.adminService.setFeatureFlag(user.userId, dto);
  }

  @Get("maintenance-windows")
  async getMaintenanceWindows(@Req() req: Request) {
    getUserContext(req);
    return this.adminService.getMaintenanceWindows();
  }

  @Post("maintenance-windows")
  async createMaintenanceWindow(@Req() req: Request, @Body() dto: MaintenanceWindowDto) {
    const user = getUserContext(req);
    return this.adminService.createMaintenanceWindow(user.userId, dto);
  }
}
