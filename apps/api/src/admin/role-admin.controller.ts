import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";

import { RbacService } from "../rbac/rbac.service";
import { AdminService } from "./admin.service";
import { RoleDto } from "./admin.types";

@ApiTags("Administration - Roles & Permission Matrix")
@ApiBearerAuth()
@Controller("api/v1/admin")
export class RoleAdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly rbacService: RbacService,
  ) {}

  private requireAuth(req: Request): { tenantId: string; userId: string } {
    const user = (req as unknown as { user?: { tenantId?: string; userId?: string } }).user;
    if (!user || !user.tenantId || !user.userId) {
      throw new UnauthorizedException("User context missing from request");
    }
    return { tenantId: user.tenantId, userId: user.userId };
  }

  private async checkPermission(
    tenantId: string,
    userId: string,
    permissionKey: string,
  ): Promise<void> {
    const allowed = await this.rbacService.can({ tenantId, userId, permissionKey });
    if (!allowed) {
      throw new ForbiddenException(`Permission ${permissionKey} denied`);
    }
  }

  @Get("roles")
  @ApiOperation({ summary: "List roles for tenant workspace" })
  async listRoles(@Req() req: Request) {
    const { tenantId, userId } = this.requireAuth(req);
    await this.checkPermission(tenantId, userId, "admin.role.manage");
    return this.adminService.listRoles(tenantId);
  }

  @Post("roles")
  @ApiOperation({ summary: "Create custom role" })
  async createCustomRole(@Req() req: Request, @Body() body: RoleDto) {
    const { tenantId, userId } = this.requireAuth(req);
    await this.checkPermission(tenantId, userId, "admin.role.manage");
    return this.adminService.createCustomRole(userId, tenantId, body);
  }

  @Get("permissions/matrix")
  @ApiOperation({ summary: "Get complete platform permission matrix" })
  async getPermissionMatrix(@Req() req: Request) {
    const { tenantId, userId } = this.requireAuth(req);
    await this.checkPermission(tenantId, userId, "admin.permission.read");
    return this.adminService.getPermissionMatrix(tenantId);
  }

  @Get("users/:id/effective-permissions")
  @ApiOperation({ summary: "Calculate effective permissions for user" })
  async getUserEffectivePermissions(@Req() req: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(req);
    await this.checkPermission(tenantId, userId, "admin.permission.read");
    return this.adminService.getUserEffectivePermissions(tenantId, id);
  }
}
