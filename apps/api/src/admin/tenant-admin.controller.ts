import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { TenantState } from "@prisma/client";
import { Request } from "express";

import { AdminService } from "./admin.service";
import { CreateTenantDto, TenantQuotaDto, UpdateTenantDto } from "./admin.types";

interface AuthUser {
  userId: string;
  tenantId?: string;
}

function getUserContext(req: Request): AuthUser {
  const user = (req as unknown as { user?: AuthUser }).user;
  if (!user) throw new UnauthorizedException("Authentication required");
  return user;
}

@Controller("api/v1/admin/tenants")
export class TenantAdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async listTenants(
    @Req() req: Request,
    @Query("search") search?: string,
    @Query("skip") skip?: string,
    @Query("take") take?: string,
  ) {
    getUserContext(req);
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const takeNum = take ? parseInt(take, 10) : 50;

    return this.adminService.listTenants(search, skipNum, takeNum);
  }

  @Get(":id")
  async getTenantDetails(@Req() req: Request, @Param("id") id: string) {
    getUserContext(req);
    return this.adminService.getTenantDetails(id);
  }

  @Post()
  async createTenant(@Req() req: Request, @Body() dto: CreateTenantDto) {
    const user = getUserContext(req);
    return this.adminService.createTenant(user.userId, dto);
  }

  @Put(":id")
  async updateTenant(@Req() req: Request, @Param("id") id: string, @Body() dto: UpdateTenantDto) {
    const user = getUserContext(req);
    return this.adminService.updateTenant(user.userId, id, dto);
  }

  @Put(":id/quotas")
  async updateTenantQuota(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: TenantQuotaDto,
  ) {
    const user = getUserContext(req);
    return this.adminService.updateTenantQuota(user.userId, id, dto);
  }

  @Post(":id/activate")
  async activateTenant(@Req() req: Request, @Param("id") id: string) {
    const user = getUserContext(req);
    return this.adminService.transitionTenantState(user.userId, id, TenantState.ACTIVE);
  }

  @Post(":id/suspend")
  async suspendTenant(@Req() req: Request, @Param("id") id: string) {
    const user = getUserContext(req);
    return this.adminService.transitionTenantState(user.userId, id, TenantState.SUSPENDED);
  }

  @Post(":id/deactivate")
  async deactivateTenant(@Req() req: Request, @Param("id") id: string) {
    const user = getUserContext(req);
    return this.adminService.transitionTenantState(user.userId, id, TenantState.DELETED);
  }

  @Get(":id/audit")
  async getTenantAuditHistory(@Req() req: Request, @Param("id") id: string) {
    getUserContext(req);
    return this.adminService.getTenantAuditHistory(id);
  }
}
