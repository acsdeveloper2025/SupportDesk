import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { OutboxState } from "@prisma/client";
import type { Request } from "express";

import { AuthAccessTokenGuard } from "../auth/guards/auth-access-token.guard";
import { getAuthenticatedRequestContext } from "../auth/guards/auth-context";
import { RbacService } from "../rbac/rbac.service";
import { OutboxRepository } from "./outbox.repository";

@ApiTags("admin-outbox")
@Controller("api/v1/admin/outbox")
@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
export class AdminOutboxController {
  constructor(
    @Inject(OutboxRepository) private readonly outboxRepository: OutboxRepository,
    @Inject(RbacService) private readonly rbacService: RbacService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List outbox events backlog and history for tenant" })
  async listOutboxEvents(
    @Req() request: Request,
    @Query("state") state?: OutboxState,
    @Query("aggregateType") aggregateType?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const context = this.requireAuth(request);
    await this.requirePermission(context.tenantId, context.userId, "admin:outbox:read");

    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    const result = await this.outboxRepository.listOutboxEvents(context.tenantId, {
      state,
      aggregateType,
      limit: limitNum,
      offset: offsetNum,
    });

    return {
      data: result.data,
      limit: limitNum,
      offset: offsetNum,
      total: result.total,
    };
  }

  @Post(":id/replay")
  @ApiOperation({ summary: "Replay a dead-lettered or failed outbox event" })
  async replayOutboxEvent(@Req() request: Request, @Param("id", new ParseUUIDPipe()) id: string) {
    const context = this.requireAuth(request);
    await this.requirePermission(context.tenantId, context.userId, "admin:outbox:replay");

    const replayed = await this.outboxRepository.replayOutboxEvent(id, context.tenantId);
    return {
      event: replayed,
      message: "Outbox event replayed and reset to PENDING",
    };
  }

  private requireAuth(request: Request) {
    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException("Authentication required");
    }
    return context;
  }

  private async requirePermission(tenantId: string, userId: string, permissionKey: string) {
    const allowed = await this.rbacService.can({ permissionKey, tenantId, userId });
    if (!allowed) {
      throw new ForbiddenException(`Missing permission ${permissionKey}`);
    }
  }
}
