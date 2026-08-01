import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request } from "express";

import { AuthAccessTokenGuard } from "../auth/guards/auth-access-token.guard";
import { getAuthenticatedRequestContext } from "../auth/guards/auth-context";
import { AuthRateLimit } from "../auth/rate-limit/auth-rate-limit.guard";
import { getCorrelationId } from "../common/logging/correlation-id";
import { RbacService } from "../rbac/rbac.service";
import { AssignTicketRequestDto, validateAssignTicketPayload } from "./dto/assign-ticket.dto";
import { type CountTicketsQueryDto, validateCountTicketsQuery } from "./dto/count-tickets.dto";
import { CreateTicketRequestDto, validateCreateTicketPayload } from "./dto/create-ticket.dto";
import {
  type ListTicketsQueryDto,
  TicketListResponseDto,
  validateListTicketsQuery,
} from "./dto/list-tickets.dto";
import { SearchTicketsQueryApiDto, validateSearchTicketsQuery } from "./dto/search-tickets.dto";
import { TicketResponseDto } from "./dto/ticket-response.dto";
import {
  TransitionTicketStatusDto,
  validateTransitionStatusPayload,
} from "./dto/transition-ticket-status.dto";
import { UnassignTicketRequestDto, validateUnassignTicketPayload } from "./dto/unassign-ticket.dto";
import { UpdateTicketRequestDto, validateUpdateTicketPayload } from "./dto/update-ticket.dto";
import type { TicketFilters } from "./tickets.repository";
import { TicketsService } from "./tickets.service";

/**
 * Maps a validated Zod list/count query DTO to the typed TicketFilters
 * interface consumed by the service layer.
 * This replaces the previous `dto as any` cast that required eslint-disable suppressions.
 */
function toTicketFilters(dto: ListTicketsQueryDto | CountTicketsQueryDto): TicketFilters {
  return {
    assignedGroupId: dto.assignedGroupId,
    assigneeUserId: dto.assigneeUserId,
    channel: dto.channel,
    createdAfter: dto.createdAfter,
    createdBefore: dto.createdBefore,
    dueAfter: dto.dueAfter,
    dueBefore: dto.dueBefore,
    priority: dto.priority,
    requesterUserId: dto.requesterUserId,
    status: dto.status,
    type: dto.type,
    updatedAfter: dto.updatedAfter,
    updatedBefore: dto.updatedBefore,
  };
}

@ApiTags("tickets")
@Controller("api/v1/tickets")
@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
export class TicketsController {
  constructor(
    @Inject(TicketsService) private readonly ticketsService: TicketsService,
    @Inject(RbacService) private readonly rbacService: RbacService,
  ) {}

  @Post()
  @AuthRateLimit("ticket-create")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    description: "Create a new support ticket within the authenticated tenant context.",
    summary: "Create a ticket",
  })
  @ApiCreatedResponse({
    description: "Ticket successfully created.",
    type: TicketResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid request payload or missing required fields.",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication token missing, invalid, or expired.",
  })
  @ApiForbiddenResponse({
    description: "User lacks the ticket.create permission in the current tenant.",
  })
  async createTicket(@Body() body: CreateTicketRequestDto, @Req() request: Request) {
    validateCreateTicketPayload(body);

    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }

    const canCreate = await this.rbacService.can({
      permissionKey: "ticket.create",
      tenantId: context.tenantId,
      userId: context.userId,
    });

    if (!canCreate) {
      throw new ForbiddenException("Lacks required ticket.create permission");
    }

    const created = await this.ticketsService.createTicket({
      assignedGroupId: body.assignedGroupId,
      assigneeUserId: body.assigneeUserId,
      channel: body.channel,
      correlationId: getCorrelationId(request),
      description: body.description,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      ipAddress: request.ip,
      priority: body.priority,
      requesterUserId: context.userId,
      tenantId: context.tenantId,
      title: body.title,
      type: body.type,
      userAgent: request.header ? request.header("user-agent") : request.headers?.["user-agent"],
    });

    return TicketResponseDto.fromDomain(created);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description:
      "List tickets within the authenticated tenant context with pagination and filters.",
    summary: "List tickets",
  })
  @ApiOkResponse({
    description: "Tickets listed successfully.",
    type: TicketListResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Authentication token missing, invalid, or expired.",
  })
  @ApiForbiddenResponse({
    description: "User lacks the ticket.read permission in the current tenant.",
  })
  async getTickets(@Query() query: unknown, @Req() request: Request) {
    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }

    const canRead = await this.rbacService.can({
      permissionKey: "ticket.read",
      tenantId: context.tenantId,
      userId: context.userId,
    });

    if (!canRead) {
      throw new ForbiddenException("Lacks required ticket.read permission");
    }

    const dto = validateListTicketsQuery(query);

    const result = await this.ticketsService.listTickets({
      tenantId: context.tenantId,
      filters: toTicketFilters(dto),
      page: dto.page,
      pageSize: dto.pageSize,
      sort: { field: dto.sortBy, direction: dto.sortDir },
    });

    return {
      ...result,
      items: result.items.map((t) => TicketResponseDto.fromDomain(t)),
    };
  }

  @Get("count")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description: "Count tickets matching the provided filters.",
    summary: "Count tickets",
  })
  @ApiOkResponse({
    description: "Ticket count retrieved successfully.",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication token missing, invalid, or expired.",
  })
  @ApiForbiddenResponse({
    description: "User lacks the ticket.read permission in the current tenant.",
  })
  async countTickets(@Query() query: unknown, @Req() request: Request) {
    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }

    const canRead = await this.rbacService.can({
      permissionKey: "ticket.read",
      tenantId: context.tenantId,
      userId: context.userId,
    });

    if (!canRead) {
      throw new ForbiddenException("Lacks required ticket.read permission");
    }

    const dto = validateCountTicketsQuery(query);

    return this.ticketsService.countTickets({
      tenantId: context.tenantId,
      filters: toTicketFilters(dto),
    });
  }

  @Get("search")
  @AuthRateLimit("ticket-search")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description:
      "Search and filter tickets within the authenticated tenant using PostgreSQL. " +
      "Supports case-insensitive partial matching on public reference, title, description, " +
      "and requester name/email, combined with the same filters/sort/pagination as list. " +
      "Does not create timeline or audit events.",
    summary: "Search tickets",
  })
  @ApiQuery({
    description:
      "Case-insensitive partial match across publicRef, title, description, requester name/email",
    name: "q",
    required: false,
    type: String,
  })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "pageSize", required: false, type: Number, example: 20 })
  @ApiQuery({
    enum: ["createdAt", "updatedAt", "priority", "dueDate", "status", "publicRef"],
    name: "sortBy",
    required: false,
  })
  @ApiQuery({ enum: ["asc", "desc"], name: "sortDir", required: false })
  @ApiQuery({ description: "CSV of statuses", name: "status", required: false, type: String })
  @ApiQuery({ description: "CSV of priorities", name: "priority", required: false, type: String })
  @ApiQuery({ description: "CSV of types", name: "type", required: false, type: String })
  @ApiQuery({ description: "CSV of channels", name: "channel", required: false, type: String })
  @ApiQuery({
    description: "CSV of assignee user UUIDs",
    name: "assigneeUserId",
    required: false,
    type: String,
  })
  @ApiQuery({
    description: "CSV of assignment group UUIDs",
    name: "assignedGroupId",
    required: false,
    type: String,
  })
  @ApiQuery({ name: "createdAfter", required: false, type: String })
  @ApiQuery({ name: "createdBefore", required: false, type: String })
  @ApiQuery({ name: "updatedAfter", required: false, type: String })
  @ApiQuery({ name: "updatedBefore", required: false, type: String })
  @ApiQuery({ name: "dueAfter", required: false, type: String })
  @ApiQuery({ name: "dueBefore", required: false, type: String })
  @ApiQuery({ name: "hasAttachments", required: false, type: Boolean })
  @ApiQuery({ name: "hasComments", required: false, type: Boolean })
  @ApiOkResponse({
    description: "Search results returned successfully.",
    type: TicketListResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid query parameters (search text, sort, page, filters, or dates).",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication token missing, invalid, or expired.",
  })
  @ApiForbiddenResponse({
    description: "User lacks the ticket.read permission in the current tenant.",
  })
  async searchTickets(@Query() query: SearchTicketsQueryApiDto, @Req() request: Request) {
    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }

    const scopeFilter = await this.rbacService.resolveListScopeFilter({
      permissionKey: "ticket.read",
      tenantId: context.tenantId,
      userId: context.userId,
    });

    if (scopeFilter === false) {
      throw new ForbiddenException("Lacks required ticket.read permission");
    }

    const dto = validateSearchTicketsQuery(query);

    const filters: TicketFilters = {
      assignedGroupId: dto.assignedGroupId,
      assigneeUserId: dto.assigneeUserId,
      channel: dto.channel,
      createdAfter: dto.createdAfter,
      createdBefore: dto.createdBefore,
      dueAfter: dto.dueAfter,
      dueBefore: dto.dueBefore,
      hasAttachments: dto.hasAttachments,
      hasComments: dto.hasComments,
      priority: dto.priority,
      q: dto.q,
      requesterUserId: dto.requesterUserId,
      status: dto.status,
      type: dto.type,
      updatedAfter: dto.updatedAfter,
      updatedBefore: dto.updatedBefore,
    };

    if (scopeFilter) {
      if (scopeFilter.requesterOrAssigneeUserId) {
        filters.requesterOrAssigneeUserId = scopeFilter.requesterOrAssigneeUserId;
      }
      if (scopeFilter.assignedGroupIds !== undefined) {
        filters.assignedGroupIds = scopeFilter.assignedGroupIds;
      }
    }

    const result = await this.ticketsService.searchTickets({
      filters,
      page: dto.page,
      pageSize: dto.pageSize,
      sort: { direction: dto.sortDir, field: dto.sortBy },
      tenantId: context.tenantId,
    });

    return {
      ...result,
      items: result.items.map((t) => TicketResponseDto.fromDomain(t)),
    };
  }

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description: "Retrieve a support ticket by its system UUID within the authenticated tenant.",
    summary: "Get ticket by ID",
  })
  @ApiOkResponse({
    description: "Ticket retrieved successfully.",
    type: TicketResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Authentication token missing, invalid, or expired.",
  })
  @ApiForbiddenResponse({
    description: "User lacks the ticket.read permission in the current tenant.",
  })
  @ApiNotFoundResponse({
    description: "Ticket not found within the authenticated tenant.",
  })
  async getTicketById(@Param("id") id: string, @Req() request: Request) {
    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }

    const canRead = await this.rbacService.can({
      permissionKey: "ticket.read",
      tenantId: context.tenantId,
      userId: context.userId,
    });

    if (!canRead) {
      throw new ForbiddenException("Lacks required ticket.read permission");
    }

    const ticket = await this.ticketsService.getTicketById(context.tenantId, id);
    const canReadScoped = await this.rbacService.can({
      permissionKey: "ticket.read",
      resource: ticketResource(ticket),
      tenantId: context.tenantId,
      userId: context.userId,
    });
    if (!canReadScoped) {
      throw new ForbiddenException("Lacks required ticket.read permission for this ticket");
    }

    return TicketResponseDto.fromDomain(ticket);
  }

  @Get("reference/:publicRef")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description: "Retrieve a support ticket by public reference code (e.g. TKT-1001).",
    summary: "Get ticket by public reference",
  })
  @ApiOkResponse({
    description: "Ticket retrieved successfully.",
    type: TicketResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Authentication token missing, invalid, or expired.",
  })
  @ApiForbiddenResponse({
    description: "User lacks the ticket.read permission in the current tenant.",
  })
  @ApiNotFoundResponse({
    description: "Ticket not found within the authenticated tenant.",
  })
  async getTicketByPublicRef(@Param("publicRef") publicRef: string, @Req() request: Request) {
    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }

    const canRead = await this.rbacService.can({
      permissionKey: "ticket.read",
      tenantId: context.tenantId,
      userId: context.userId,
    });

    if (!canRead) {
      throw new ForbiddenException("Lacks required ticket.read permission");
    }

    const ticket = await this.ticketsService.getTicketByPublicRef(context.tenantId, publicRef);
    const canReadScoped = await this.rbacService.can({
      permissionKey: "ticket.read",
      resource: ticketResource(ticket),
      tenantId: context.tenantId,
      userId: context.userId,
    });
    if (!canReadScoped) {
      throw new ForbiddenException("Lacks required ticket.read permission for this ticket");
    }

    return TicketResponseDto.fromDomain(ticket);
  }

  @Patch(":id")
  @AuthRateLimit("ticket-update")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description: "Update ticket editable fields with optimistic concurrency version check.",
    summary: "Update ticket by ID",
  })
  @ApiOkResponse({
    description: "Ticket successfully updated.",
    type: TicketResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid payload, missing version, or attempted immutable field modification.",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication token missing, invalid, or expired.",
  })
  @ApiForbiddenResponse({
    description: "User lacks the ticket.update permission in the current tenant.",
  })
  @ApiNotFoundResponse({
    description: "Ticket not found within the authenticated tenant.",
  })
  @ApiConflictResponse({
    description: "Optimistic concurrency conflict (version mismatch).",
  })
  async updateTicketById(
    @Param("id") id: string,
    @Body() body: UpdateTicketRequestDto,
    @Req() request: Request,
  ) {
    validateUpdateTicketPayload(body as unknown as Record<string, unknown>);

    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }

    const canUpdate = await this.rbacService.can({
      permissionKey: "ticket.update",
      tenantId: context.tenantId,
      userId: context.userId,
    });

    if (!canUpdate) {
      throw new ForbiddenException("Lacks required ticket.update permission");
    }

    const existing = await this.ticketsService.getTicketById(context.tenantId, id);
    const canUpdateScoped = await this.rbacService.can({
      permissionKey: "ticket.update",
      resource: ticketResource(existing),
      tenantId: context.tenantId,
      userId: context.userId,
    });
    if (!canUpdateScoped) {
      throw new ForbiddenException("Lacks required ticket.update permission for this ticket");
    }

    const updated = await this.ticketsService.updateTicket({
      actorUserId: context.userId,
      assignedGroupId: body.assignedGroupId,
      assigneeUserId: body.assigneeUserId,
      channel: body.channel,
      correlationId: getCorrelationId(request),
      description: body.description,
      dueDate: body.dueDate ? new Date(body.dueDate) : body.dueDate === null ? null : undefined,
      expectedVersion: body.version,
      ipAddress: request.ip,
      priority: body.priority,
      tenantId: context.tenantId,
      ticketId: id,
      title: body.title,
      type: body.type,
      userAgent: request.header ? request.header("user-agent") : request.headers?.["user-agent"],
    });

    return TicketResponseDto.fromDomain(updated);
  }

  @Patch("reference/:publicRef")
  @AuthRateLimit("ticket-update")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description: "Update ticket editable fields by public reference code.",
    summary: "Update ticket by public reference",
  })
  @ApiOkResponse({
    description: "Ticket successfully updated.",
    type: TicketResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid payload, missing version, or attempted immutable field modification.",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication token missing, invalid, or expired.",
  })
  @ApiForbiddenResponse({
    description: "User lacks the ticket.update permission in the current tenant.",
  })
  @ApiNotFoundResponse({
    description: "Ticket not found within the authenticated tenant.",
  })
  @ApiConflictResponse({
    description: "Optimistic concurrency conflict (version mismatch).",
  })
  async updateTicketByPublicRef(
    @Param("publicRef") publicRef: string,
    @Body() body: UpdateTicketRequestDto,
    @Req() request: Request,
  ) {
    validateUpdateTicketPayload(body as unknown as Record<string, unknown>);

    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }

    const canUpdate = await this.rbacService.can({
      permissionKey: "ticket.update",
      tenantId: context.tenantId,
      userId: context.userId,
    });

    if (!canUpdate) {
      throw new ForbiddenException("Lacks required ticket.update permission");
    }

    const existing = await this.ticketsService.getTicketByPublicRef(context.tenantId, publicRef);
    const canUpdateScoped = await this.rbacService.can({
      permissionKey: "ticket.update",
      resource: ticketResource(existing),
      tenantId: context.tenantId,
      userId: context.userId,
    });
    if (!canUpdateScoped) {
      throw new ForbiddenException("Lacks required ticket.update permission for this ticket");
    }

    const updated = await this.ticketsService.updateTicket({
      actorUserId: context.userId,
      assignedGroupId: body.assignedGroupId,
      assigneeUserId: body.assigneeUserId,
      channel: body.channel,
      correlationId: getCorrelationId(request),
      description: body.description,
      dueDate: body.dueDate ? new Date(body.dueDate) : body.dueDate === null ? null : undefined,
      expectedVersion: body.version,
      ipAddress: request.ip,
      priority: body.priority,
      tenantId: context.tenantId,
      ticketId: existing.id,
      title: body.title,
      type: body.type,
      userAgent: request.header ? request.header("user-agent") : request.headers?.["user-agent"],
    });

    return TicketResponseDto.fromDomain(updated);
  }

  // ── Issue #19: Ticket Lifecycle & Activity Timeline ──────────────────────

  @Post(":id/status")
  @AuthRateLimit("ticket-status")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description:
      "Transition a ticket's lifecycle status by its system UUID. " +
      "Allowed transitions are enforced by the domain state machine. " +
      "Requires optimistic concurrency version check.",
    summary: "Transition ticket status by ID",
  })
  @ApiOkResponse({
    description: "Ticket status transitioned successfully.",
    type: TicketResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid payload, missing version, or illegal status transition.",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication token missing, invalid, or expired.",
  })
  @ApiForbiddenResponse({
    description: "User lacks the ticket.transition permission in the current tenant.",
  })
  @ApiNotFoundResponse({
    description: "Ticket not found within the authenticated tenant.",
  })
  @ApiConflictResponse({
    description: "Optimistic concurrency conflict (version mismatch).",
  })
  async transitionTicketStatusById(
    @Param("id") id: string,
    @Body() body: TransitionTicketStatusDto,
    @Req() request: Request,
  ) {
    validateTransitionStatusPayload(body as unknown as Record<string, unknown>);

    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }

    const canTransition = await this.rbacService.can({
      permissionKey: "ticket.transition",
      tenantId: context.tenantId,
      userId: context.userId,
    });

    if (!canTransition) {
      throw new ForbiddenException("Lacks required ticket.transition permission");
    }

    const existing = await this.ticketsService.getTicketById(context.tenantId, id);
    const canTransitionScoped = await this.rbacService.can({
      permissionKey: "ticket.transition",
      resource: ticketResource(existing),
      tenantId: context.tenantId,
      userId: context.userId,
    });
    if (!canTransitionScoped) {
      throw new ForbiddenException("Lacks required ticket.transition permission for this ticket");
    }

    const updated = await this.ticketsService.transitionStatus({
      actorUserId: context.userId,
      correlationId: getCorrelationId(request),
      expectedVersion: body.version,
      ipAddress: request.ip,
      newStatus: body.status,
      tenantId: context.tenantId,
      ticketId: id,
      userAgent: request.header ? request.header("user-agent") : request.headers?.["user-agent"],
    });

    return TicketResponseDto.fromDomain(updated);
  }

  @Post("reference/:publicRef/status")
  @AuthRateLimit("ticket-status")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description:
      "Transition a ticket's lifecycle status by its public reference code (e.g. TKT-1001). " +
      "Allowed transitions are enforced by the domain state machine. " +
      "Requires optimistic concurrency version check.",
    summary: "Transition ticket status by public reference",
  })
  @ApiOkResponse({
    description: "Ticket status transitioned successfully.",
    type: TicketResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid payload, missing version, or illegal status transition.",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication token missing, invalid, or expired.",
  })
  @ApiForbiddenResponse({
    description: "User lacks the ticket.transition permission in the current tenant.",
  })
  @ApiNotFoundResponse({
    description: "Ticket not found within the authenticated tenant.",
  })
  @ApiConflictResponse({
    description: "Optimistic concurrency conflict (version mismatch).",
  })
  async transitionTicketStatusByPublicRef(
    @Param("publicRef") publicRef: string,
    @Body() body: TransitionTicketStatusDto,
    @Req() request: Request,
  ) {
    validateTransitionStatusPayload(body as unknown as Record<string, unknown>);

    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }

    const canTransition = await this.rbacService.can({
      permissionKey: "ticket.transition",
      tenantId: context.tenantId,
      userId: context.userId,
    });

    if (!canTransition) {
      throw new ForbiddenException("Lacks required ticket.transition permission");
    }

    const existing = await this.ticketsService.getTicketByPublicRef(context.tenantId, publicRef);
    const canTransitionScoped = await this.rbacService.can({
      permissionKey: "ticket.transition",
      resource: ticketResource(existing),
      tenantId: context.tenantId,
      userId: context.userId,
    });
    if (!canTransitionScoped) {
      throw new ForbiddenException("Lacks required ticket.transition permission for this ticket");
    }

    const updated = await this.ticketsService.transitionStatus({
      actorUserId: context.userId,
      correlationId: getCorrelationId(request),
      expectedVersion: body.version,
      ipAddress: request.ip,
      newStatus: body.status,
      tenantId: context.tenantId,
      ticketId: existing.id,
      userAgent: request.header ? request.header("user-agent") : request.headers?.["user-agent"],
    });

    return TicketResponseDto.fromDomain(updated);
  }

  // ── Issue #20: Ticket Assignment ────────────────────────────────────

  @Post(":id/assign")
  @AuthRateLimit("ticket-assign")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description:
      "Assign or reassign a ticket to a user and/or group by its system UUID. " +
      "Closed tickets cannot be assigned. Optimistic concurrency version required.",
    summary: "Assign ticket by ID",
  })
  @ApiOkResponse({
    description: "Ticket successfully assigned.",
    type: TicketResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid payload, invalid UUID, inactive assignee, or closed ticket.",
  })
  @ApiUnauthorizedResponse({ description: "Authentication token missing, invalid, or expired." })
  @ApiForbiddenResponse({ description: "User lacks the ticket.assign permission." })
  @ApiNotFoundResponse({ description: "Ticket not found within the authenticated tenant." })
  @ApiConflictResponse({ description: "Optimistic concurrency conflict (version mismatch)." })
  async assignTicketById(
    @Param("id") id: string,
    @Body() body: AssignTicketRequestDto,
    @Req() request: Request,
  ) {
    validateAssignTicketPayload(body as unknown as Record<string, unknown>);

    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }

    const canAssign = await this.rbacService.can({
      permissionKey: "ticket.assign",
      tenantId: context.tenantId,
      userId: context.userId,
    });
    if (!canAssign) {
      throw new ForbiddenException("Lacks required ticket.assign permission");
    }

    const existing = await this.ticketsService.getTicketById(context.tenantId, id);
    const canAssignScoped = await this.rbacService.can({
      permissionKey: "ticket.assign",
      resource: ticketResource(existing),
      tenantId: context.tenantId,
      userId: context.userId,
    });
    if (!canAssignScoped) {
      throw new ForbiddenException("Lacks required ticket.assign permission for this ticket");
    }

    const updated = await this.ticketsService.assignTicket({
      actorUserId: context.userId,
      assignedGroupId: body.assignedGroupId,
      assigneeUserId: body.assigneeUserId,
      correlationId: getCorrelationId(request),
      expectedVersion: body.version,
      ipAddress: request.ip,
      tenantId: context.tenantId,
      ticketId: id,
      userAgent: request.header ? request.header("user-agent") : request.headers?.["user-agent"],
    });

    return TicketResponseDto.fromDomain(updated);
  }

  @Post("reference/:publicRef/assign")
  @AuthRateLimit("ticket-assign")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description:
      "Assign or reassign a ticket to a user and/or group by its public reference code. " +
      "Closed tickets cannot be assigned. Optimistic concurrency version required.",
    summary: "Assign ticket by public reference",
  })
  @ApiOkResponse({
    description: "Ticket successfully assigned.",
    type: TicketResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid payload, invalid UUID, inactive assignee, or closed ticket.",
  })
  @ApiUnauthorizedResponse({ description: "Authentication token missing, invalid, or expired." })
  @ApiForbiddenResponse({ description: "User lacks the ticket.assign permission." })
  @ApiNotFoundResponse({ description: "Ticket not found within the authenticated tenant." })
  @ApiConflictResponse({ description: "Optimistic concurrency conflict (version mismatch)." })
  async assignTicketByPublicRef(
    @Param("publicRef") publicRef: string,
    @Body() body: AssignTicketRequestDto,
    @Req() request: Request,
  ) {
    validateAssignTicketPayload(body as unknown as Record<string, unknown>);

    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }

    const canAssign = await this.rbacService.can({
      permissionKey: "ticket.assign",
      tenantId: context.tenantId,
      userId: context.userId,
    });
    if (!canAssign) {
      throw new ForbiddenException("Lacks required ticket.assign permission");
    }

    const existing = await this.ticketsService.getTicketByPublicRef(context.tenantId, publicRef);
    const canAssignScoped = await this.rbacService.can({
      permissionKey: "ticket.assign",
      resource: ticketResource(existing),
      tenantId: context.tenantId,
      userId: context.userId,
    });
    if (!canAssignScoped) {
      throw new ForbiddenException("Lacks required ticket.assign permission for this ticket");
    }

    const updated = await this.ticketsService.assignTicket({
      actorUserId: context.userId,
      assignedGroupId: body.assignedGroupId,
      assigneeUserId: body.assigneeUserId,
      correlationId: getCorrelationId(request),
      expectedVersion: body.version,
      ipAddress: request.ip,
      tenantId: context.tenantId,
      ticketId: existing.id,
      userAgent: request.header ? request.header("user-agent") : request.headers?.["user-agent"],
    });

    return TicketResponseDto.fromDomain(updated);
  }

  @Post(":id/unassign")
  @AuthRateLimit("ticket-assign")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description:
      "Remove the assignee user and group from a ticket by its system UUID. " +
      "Closed tickets cannot be unassigned. Optimistic concurrency version required.",
    summary: "Unassign ticket by ID",
  })
  @ApiOkResponse({
    description: "Ticket successfully unassigned.",
    type: TicketResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid payload, missing version, or closed ticket." })
  @ApiUnauthorizedResponse({ description: "Authentication token missing, invalid, or expired." })
  @ApiForbiddenResponse({ description: "User lacks the ticket.assign permission." })
  @ApiNotFoundResponse({ description: "Ticket not found within the authenticated tenant." })
  @ApiConflictResponse({ description: "Optimistic concurrency conflict (version mismatch)." })
  async unassignTicketById(
    @Param("id") id: string,
    @Body() body: UnassignTicketRequestDto,
    @Req() request: Request,
  ) {
    validateUnassignTicketPayload(body as unknown as Record<string, unknown>);

    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }

    const canAssign = await this.rbacService.can({
      permissionKey: "ticket.assign",
      tenantId: context.tenantId,
      userId: context.userId,
    });
    if (!canAssign) {
      throw new ForbiddenException("Lacks required ticket.assign permission");
    }

    const existing = await this.ticketsService.getTicketById(context.tenantId, id);
    const canAssignScoped = await this.rbacService.can({
      permissionKey: "ticket.assign",
      resource: ticketResource(existing),
      tenantId: context.tenantId,
      userId: context.userId,
    });
    if (!canAssignScoped) {
      throw new ForbiddenException("Lacks required ticket.assign permission for this ticket");
    }

    const updated = await this.ticketsService.unassignTicket({
      actorUserId: context.userId,
      correlationId: getCorrelationId(request),
      expectedVersion: body.version,
      ipAddress: request.ip,
      tenantId: context.tenantId,
      ticketId: id,
      userAgent: request.header ? request.header("user-agent") : request.headers?.["user-agent"],
    });

    return TicketResponseDto.fromDomain(updated);
  }

  // ── Issue #28: Ticket Activity Timeline ──────────────────────────────────

  @Get(":id/timeline")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description:
      "Retrieve the activity timeline (audit events) for a ticket by its system UUID. " +
      "Events are ordered newest-first. Requires ticket.read permission.",
    summary: "Get ticket timeline by ID",
  })
  @ApiOkResponse({
    description: "Timeline retrieved successfully.",
  })
  @ApiUnauthorizedResponse({ description: "Authentication token missing, invalid, or expired." })
  @ApiForbiddenResponse({ description: "User lacks the ticket.read permission." })
  @ApiNotFoundResponse({ description: "Ticket not found within the authenticated tenant." })
  async getTicketTimelineById(
    @Param("id") id: string,
    @Query("page") page: unknown,
    @Query("pageSize") pageSize: unknown,
    @Req() request: Request,
  ) {
    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }

    const canRead = await this.rbacService.can({
      permissionKey: "ticket.read",
      tenantId: context.tenantId,
      userId: context.userId,
    });
    if (!canRead) {
      throw new ForbiddenException("Lacks required ticket.read permission");
    }

    const parsedPage = Math.max(1, Number(page) || 1);
    const parsedPageSize = Math.min(100, Math.max(1, Number(pageSize) || 50));

    const result = await this.ticketsService.getTicketTimeline({
      actorUserId: context.userId,
      page: parsedPage,
      pageSize: parsedPageSize,
      tenantId: context.tenantId,
      ticketId: id,
    });

    return result;
  }
}

function ticketResource(ticket: {
  assignedGroupId?: string | null;
  assigneeUserId?: string | null;
  requesterUserId: string;
}) {
  return {
    assigneeUserId: ticket.assigneeUserId,
    groupId: ticket.assignedGroupId,
    ownerUserId: ticket.requesterUserId,
  };
}
