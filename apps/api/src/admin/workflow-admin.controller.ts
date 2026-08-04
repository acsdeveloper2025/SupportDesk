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

@ApiTags("Administration - Workflows")
@ApiBearerAuth()
@Controller("api/v1/admin/workflows")
@UseGuards(AuthAccessTokenGuard)
export class WorkflowAdminController {
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

  @Get("monitoring")
  @ApiOperation({ summary: "Get workflow execution monitoring metrics" })
  async getWorkflowMonitoring(@Req() req: Request) {
    const { tenantId, userId } = this.requireAuth(req);
    await this.checkPermission(tenantId, userId, "admin.workflow.manage");
    return this.adminService.getWorkflowMonitoring(tenantId);
  }

  @Get("executions")
  @ApiOperation({ summary: "List workflow executions" })
  async listWorkflowExecutions(
    @Req() req: Request,
    @Query("status") status?: string,
    @Query("take") take?: string,
  ) {
    const { tenantId, userId } = this.requireAuth(req);
    await this.checkPermission(tenantId, userId, "admin.workflow.manage");
    return this.adminService.listWorkflowExecutions(
      tenantId,
      status,
      take ? parseInt(take, 10) : 50,
    );
  }

  @Post("executions/:id/retry")
  @ApiOperation({ summary: "Retry failed workflow execution" })
  async retryWorkflowExecution(@Req() req: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(req);
    await this.checkPermission(tenantId, userId, "admin.workflow.retry");
    return this.adminService.retryWorkflowExecution(userId, tenantId, id);
  }
}
