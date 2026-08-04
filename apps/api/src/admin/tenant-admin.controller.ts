import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { TenantState } from "@prisma/client";
import { Request } from "express";

import { AuthAccessTokenGuard } from "../auth/guards/auth-access-token.guard";
import { getAuthenticatedRequestContext } from "../auth/guards/auth-context";
import { RbacService } from "../rbac/rbac.service";
import { AdminService } from "./admin.service";
import { CreateTenantDto, TenantQuotaDto, UpdateTenantDto } from "./admin.types";

@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
@Controller("api/v1/admin/tenants")
export class TenantAdminController {
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
  async listTenants(
    @Req() req: Request,
    @Query("search") search?: string,
    @Query("skip") skip?: string,
    @Query("take") take?: string,
  ) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.tenant.read");
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const takeNum = take ? parseInt(take, 10) : 50;

    return this.adminService.listTenants(search, skipNum, takeNum, user);
  }

  @Get(":id")
  async getTenantDetails(@Req() req: Request, @Param("id") id: string) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.tenant.read");
    return this.adminService.getTenantDetails(id, user);
  }

  @Post()
  async createTenant(@Req() req: Request, @Body() dto: CreateTenantDto) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.tenant.create");
    return this.adminService.createTenant(user.userId, dto);
  }

  @Put(":id")
  async updateTenant(@Req() req: Request, @Param("id") id: string, @Body() dto: UpdateTenantDto) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.tenant.update");
    return this.adminService.updateTenant(user.userId, id, dto, user);
  }

  @Put(":id/quotas")
  async updateTenantQuota(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: TenantQuotaDto,
  ) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.tenant.update");
    return this.adminService.updateTenantQuota(user.userId, id, dto, user);
  }

  @Post(":id/activate")
  async activateTenant(@Req() req: Request, @Param("id") id: string) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.tenant.lifecycle");
    return this.adminService.transitionTenantState(user.userId, id, TenantState.ACTIVE, user);
  }

  @Post(":id/suspend")
  async suspendTenant(@Req() req: Request, @Param("id") id: string) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.tenant.lifecycle");
    return this.adminService.transitionTenantState(user.userId, id, TenantState.SUSPENDED, user);
  }

  @Post(":id/deactivate")
  async deactivateTenant(@Req() req: Request, @Param("id") id: string) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.tenant.lifecycle");
    return this.adminService.transitionTenantState(user.userId, id, TenantState.DELETED, user);
  }

  @Get(":id/audit")
  async getTenantAuditHistory(@Req() req: Request, @Param("id") id: string) {
    const user = this.requireAuth(req);
    await this.requirePermission(user.tenantId, user.userId, "admin.audit.read");
    return this.adminService.getTenantAuditHistory(id, user);
  }
}
