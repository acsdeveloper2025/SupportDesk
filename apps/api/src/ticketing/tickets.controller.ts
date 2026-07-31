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
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request } from "express";

import { AuthAccessTokenGuard } from "../auth/guards/auth-access-token.guard";
import { getAuthenticatedRequestContext } from "../auth/guards/auth-context";
import { AuthRateLimit } from "../auth/rate-limit/auth-rate-limit.guard";
import { getCorrelationId } from "../common/logging/correlation-id";
import { RbacService } from "../rbac/rbac.service";
import { CreateTicketRequestDto, validateCreateTicketPayload } from "./dto/create-ticket.dto";
import { TicketResponseDto } from "./dto/ticket-response.dto";
import {
  TransitionTicketStatusDto,
  validateTransitionStatusPayload,
} from "./dto/transition-ticket-status.dto";
import { UpdateTicketRequestDto, validateUpdateTicketPayload } from "./dto/update-ticket.dto";
import { TicketsService } from "./tickets.service";

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
    description: "User lacks the ticket.status_change permission in the current tenant.",
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
      permissionKey: "ticket.status_change",
      tenantId: context.tenantId,
      userId: context.userId,
    });

    if (!canTransition) {
      throw new ForbiddenException("Lacks required ticket.status_change permission");
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
    description: "User lacks the ticket.status_change permission in the current tenant.",
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
      permissionKey: "ticket.status_change",
      tenantId: context.tenantId,
      userId: context.userId,
    });

    if (!canTransition) {
      throw new ForbiddenException("Lacks required ticket.status_change permission");
    }

    const existing = await this.ticketsService.getTicketByPublicRef(context.tenantId, publicRef);

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
}
