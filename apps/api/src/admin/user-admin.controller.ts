import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";

import { AdminService } from "./admin.service";
import { InviteUserDto } from "./admin.types";

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

@Controller("api/v1/admin/users")
export class UserAdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async listUsers(
    @Req() req: Request,
    @Query("search") search?: string,
    @Query("skip") skip?: string,
    @Query("take") take?: string,
  ) {
    const user = getUserContext(req);
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const takeNum = take ? parseInt(take, 10) : 50;

    return this.adminService.listUsers(search, user.tenantId, skipNum, takeNum);
  }

  @Post("invite")
  async inviteUser(@Req() req: Request, @Body() dto: InviteUserDto) {
    const user = getUserContext(req);
    return this.adminService.inviteUser(user.userId, user.tenantId, dto);
  }

  @Post(":id/activate")
  async activateUser(@Req() req: Request, @Param("id") id: string) {
    const user = getUserContext(req);
    return this.adminService.setUserActiveStatus(user.userId, id, true);
  }

  @Post(":id/suspend")
  async suspendUser(@Req() req: Request, @Param("id") id: string) {
    const user = getUserContext(req);
    return this.adminService.setUserActiveStatus(user.userId, id, false);
  }

  @Post(":id/lock")
  async lockUser(@Req() req: Request, @Param("id") id: string) {
    const user = getUserContext(req);
    return this.adminService.setUserLockout(user.userId, id, true);
  }

  @Post(":id/unlock")
  async unlockUser(@Req() req: Request, @Param("id") id: string) {
    const user = getUserContext(req);
    return this.adminService.setUserLockout(user.userId, id, false);
  }

  @Post(":id/reset-password")
  async adminResetPassword(@Req() req: Request, @Param("id") id: string) {
    const user = getUserContext(req);
    return this.adminService.adminResetPassword(user.userId, id);
  }

  @Get(":id/login-history")
  async getUserLoginHistory(@Req() req: Request, @Param("id") id: string) {
    getUserContext(req);
    return this.adminService.getUserLoginHistory(id);
  }

  @Post(":id/force-logout")
  async forceLogoutUser(@Req() req: Request, @Param("id") id: string) {
    const user = getUserContext(req);
    return this.adminService.forceLogoutUser(user.userId, id);
  }
}
