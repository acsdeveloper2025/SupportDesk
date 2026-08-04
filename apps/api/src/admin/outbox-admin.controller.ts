import {
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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";

import { AuthAccessTokenGuard } from "../auth/guards/auth-access-token.guard";
import { getAuthenticatedRequestContext } from "../auth/guards/auth-context";
import { RbacService } from "../rbac/rbac.service";
import { AdminService } from "./admin.service";

@ApiTags("Administration - Transactional Outbox")
@ApiBearerAuth()
@Controller("api/v1/admin/outbox")
@UseGuards(AuthAccessTokenGuard)
export class OutboxAdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly rbacService: RbacService,
  ) {}

  private requireAuth(req: Request): { tenantId: string; userId: string } {
    const context = getAuthenticatedRequestContext(req);
    if (!context) {
      throw new UnauthorizedException("User context missing from request");
    }
    return { tenantId: context.tenantId, userId: context.userId };
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

  @Get("stats")
  @ApiOperation({ summary: "Get transactional outbox queue statistics" })
  async getOutboxStats(@Req() req: Request) {
    const { tenantId, userId } = this.requireAuth(req);
    await this.checkPermission(tenantId, userId, "admin.outbox.manage");
    return this.adminService.getOutboxStats(tenantId);
  }

  @Get("events")
  @ApiOperation({ summary: "List outbox events with optional status filter" })
  async listOutboxEvents(
    @Req() req: Request,
    @Query("status") status?: string,
    @Query("take") take?: string,
  ) {
    const { tenantId, userId } = this.requireAuth(req);
    await this.checkPermission(tenantId, userId, "admin.outbox.manage");
    return this.adminService.listOutboxEvents(tenantId, status, take ? parseInt(take, 10) : 50);
  }

  @Post("events/:id/replay")
  @ApiOperation({ summary: "Replay single outbox event" })
  async replayOutboxEvent(@Req() req: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(req);
    await this.checkPermission(tenantId, userId, "admin.outbox.replay");
    return this.adminService.replayOutboxEvent(userId, tenantId, id);
  }

  @Post("events/retry-failed")
  @ApiOperation({ summary: "Batch retry all failed outbox events" })
  async retryFailedOutboxEvents(@Req() req: Request) {
    const { tenantId, userId } = this.requireAuth(req);
    await this.checkPermission(tenantId, userId, "admin.outbox.replay");
    return this.adminService.retryFailedOutboxEvents(userId, tenantId);
  }
}
