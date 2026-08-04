import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
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
import { InviteUserDto } from "./admin.types";

@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
@Controller("api/v1/admin/users")
export class UserAdminController {
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

  @Get()
  async listUsers(
    @Req() req: Request,
    @Query("search") search?: string,
    @Query("skip") skip?: string,
    @Query("take") take?: string,
  ) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.user.read");
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const takeNum = take ? parseInt(take, 10) : 50;

    return this.adminService.listUsers(search, user.tenantId, skipNum, takeNum);
  }

  @Post("invite")
  async inviteUser(@Req() req: Request, @Body() dto: InviteUserDto) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.user.invite");
    return this.adminService.inviteUser(user.userId, user.tenantId, dto);
  }

  @Post(":id/activate")
  async activateUser(@Req() req: Request, @Param("id") id: string) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.user.update");
    return this.adminService.setUserActiveStatus(user.userId, user.tenantId, id, true);
  }

  @Post(":id/suspend")
  async suspendUser(@Req() req: Request, @Param("id") id: string) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.user.update");
    return this.adminService.setUserActiveStatus(user.userId, user.tenantId, id, false);
  }

  @Post(":id/lock")
  async lockUser(@Req() req: Request, @Param("id") id: string) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.user.lockout");
    return this.adminService.setUserLockout(user.userId, user.tenantId, id, true);
  }

  @Post(":id/unlock")
  async unlockUser(@Req() req: Request, @Param("id") id: string) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.user.lockout");
    return this.adminService.setUserLockout(user.userId, user.tenantId, id, false);
  }

  @Post(":id/reset-password")
  async adminResetPassword(@Req() req: Request, @Param("id") id: string) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.user.update");
    return this.adminService.adminResetPassword(user.userId, user.tenantId, id);
  }

  @Get(":id/login-history")
  async getUserLoginHistory(@Req() req: Request, @Param("id") id: string) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.user.read");
    return this.adminService.getUserLoginHistory(user.tenantId, id);
  }

  @Post(":id/force-logout")
  async forceLogoutUser(@Req() req: Request, @Param("id") id: string) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.user.session");
    return this.adminService.forceLogoutUser(user.userId, user.tenantId, id);
  }
}
