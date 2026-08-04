import {
  Body,
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
import { FeatureFlagDto, GlobalSettingDto, MaintenanceWindowDto } from "./admin.types";

@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
@Controller("api/v1/admin")
export class GlobalAdminController {
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

  @Get("settings")
  async getGlobalSettings(@Req() req: Request) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.global.read");
    return this.adminService.getGlobalSettings();
  }

  @Post("settings")
  async updateGlobalSetting(@Req() req: Request, @Body() dto: GlobalSettingDto) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.global.update");
    return this.adminService.updateGlobalSetting(user.userId, dto);
  }

  @Get("feature-flags")
  async getFeatureFlags(@Req() req: Request) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.global.read");
    return this.adminService.getFeatureFlags(user.tenantId);
  }

  @Post("feature-flags")
  async setFeatureFlag(@Req() req: Request, @Body() dto: FeatureFlagDto) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.feature_flag.manage");
    return this.adminService.setFeatureFlag(user.userId, dto);
  }

  @Get("maintenance-windows")
  async getMaintenanceWindows(@Req() req: Request) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.global.read");
    return this.adminService.getMaintenanceWindows();
  }

  @Post("maintenance-windows")
  async createMaintenanceWindow(@Req() req: Request, @Body() dto: MaintenanceWindowDto) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.global.update");
    return this.adminService.createMaintenanceWindow(user.userId, dto);
  }
}
