import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { SlaTargetState } from "@prisma/client";
import type { Request } from "express";

import { AuthAccessTokenGuard } from "../auth/guards/auth-access-token.guard";
import { getAuthenticatedRequestContext } from "../auth/guards/auth-context";
import { RbacService } from "../rbac/rbac.service";
import { TicketsService } from "../ticketing/tickets.service";
import { ListSlaTimersQueryDto, parsePage, parsePageSize, SlaMetricsQueryDto } from "./dto/sla.dto";
import { SlaEngineService } from "./sla-engine.service";

const TIMER_STATE_MAP: Record<string, SlaTargetState> = {
  paused: SlaTargetState.PAUSED,
  running: SlaTargetState.RUNNING,
};

@ApiTags("sla")
@Controller("api/v1")
@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
export class SlaQueryController {
  constructor(
    @Inject(SlaEngineService) private readonly slaEngine: SlaEngineService,
    @Inject(TicketsService) private readonly ticketsService: TicketsService,
    @Inject(RbacService) private readonly rbacService: RbacService,
  ) {}

  @Get("tickets/:ticketId/sla")
  @ApiOperation({ summary: "Get SLA status for a ticket" })
  @ApiOkResponse({ description: "Ticket SLA targets." })
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  async ticketSla(@Param("ticketId") ticketId: string, @Req() request: Request) {
    const context = this.requireAuth(request);
    await this.requireRead(context.tenantId, context.userId);

    const ticket = await this.ticketsService.getTicketById(context.tenantId, ticketId);
    const canReadTicket = await this.rbacService.can({
      permissionKey: "ticket.read",
      resource: {
        assigneeUserId: ticket.assigneeUserId,
        groupId: ticket.assignedGroupId,
        ownerUserId: ticket.requesterUserId,
      },
      tenantId: context.tenantId,
      userId: context.userId,
    });
    if (!canReadTicket) {
      throw new ForbiddenException("Missing permission ticket.read for this ticket");
    }

    const targets = await this.slaEngine.getTicketSlaStatus(context.tenantId, ticketId);
    if (!targets) {
      throw new NotFoundException("Ticket not found");
    }
    return { data: targets, ticketId };
  }

  @Get("sla/timers")
  @ApiOperation({ summary: "List active SLA timers" })
  @ApiOkResponse({ description: "Active SLA timers." })
  async timers(@Query() query: ListSlaTimersQueryDto, @Req() request: Request) {
    const context = this.requireAuth(request);
    await this.requireRead(context.tenantId, context.userId);

    const page = parsePage(query.page);
    const pageSize = parsePageSize(query.pageSize);
    const dueBefore = query.dueBefore ? new Date(query.dueBefore) : undefined;
    if (dueBefore && Number.isNaN(dueBefore.getTime())) {
      throw new BadRequestException("Invalid dueBefore");
    }

    let states: SlaTargetState[] | undefined;
    if (query.state) {
      states = query.state.split(",").map((value) => {
        const mapped = TIMER_STATE_MAP[value.trim().toLowerCase()];
        if (!mapped) {
          throw new BadRequestException(`Invalid timer state: ${value}`);
        }
        return mapped;
      });
    }

    return this.slaEngine.listActiveTimers(context.tenantId, {
      dueBefore,
      page,
      pageSize,
      states,
    });
  }

  @Get("sla/metrics")
  @ApiOperation({ summary: "Basic SLA metrics" })
  @ApiOkResponse({ description: "Basic SLA counts." })
  async metrics(@Query() query: SlaMetricsQueryDto, @Req() request: Request) {
    const context = this.requireAuth(request);
    await this.requireRead(context.tenantId, context.userId);

    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      throw new BadRequestException("Invalid from/to range");
    }

    const maxRangeMs = 90 * 24 * 60 * 60 * 1000;
    if (to.getTime() - from.getTime() > maxRangeMs) {
      throw new BadRequestException("Metrics range must be 90 days or less");
    }

    const counts = await this.slaEngine.getMetrics(context.tenantId, from, to);
    return { from: from.toISOString(), to: to.toISOString(), ...counts };
  }

  private async requireRead(tenantId: string, userId: string) {
    const allowed = await this.rbacService.can({
      permissionKey: "sla.read",
      tenantId,
      userId,
    });
    if (!allowed) {
      throw new ForbiddenException("Missing permission sla.read");
    }
  }

  private requireAuth(request: Request) {
    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException("Authentication required");
    }
    return context;
  }
}
