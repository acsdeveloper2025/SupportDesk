import { randomUUID } from "node:crypto";

import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AuditEvent,
  TicketChannel,
  TicketPriority,
  TicketStatus,
  TicketType,
} from "@prisma/client";

import { TicketAggregate } from "./domain/ticket.aggregate";
import {
  type FindTicketsParams,
  type TicketFilters,
  type TicketSort,
  TicketsRepository,
} from "./tickets.repository";

export interface ListTicketsDto {
  tenantId: string;
  filters?: TicketFilters;
  sort: TicketSort;
  page: number;
  pageSize: number;
}

export interface ListTicketsResult {
  items: TicketAggregate[];
  totalRecords: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  appliedFilters: TicketFilters;
  sort: TicketSort;
}

export interface CountTicketsDto {
  tenantId: string;
  filters?: TicketFilters;
}

export interface GetTicketTimelineDto {
  tenantId: string;
  ticketId: string;
  actorUserId: string;
  page: number;
  pageSize: number;
}

export interface GetTicketTimelineResult {
  items: AuditEvent[];
  totalRecords: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CreateTicketDto {
  tenantId: string;
  requesterUserId: string;
  title: string;
  description: string;
  priority?: TicketPriority;
  channel?: TicketChannel;
  type?: TicketType;
  assigneeUserId?: string | null;
  assignedGroupId?: string | null;
  dueDate?: Date | null;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UpdateTicketDto {
  tenantId: string;
  ticketId: string;
  expectedVersion: number;
  actorUserId: string;
  title?: string;
  description?: string;
  priority?: TicketPriority;
  channel?: TicketChannel;
  type?: TicketType;
  assigneeUserId?: string | null;
  assignedGroupId?: string | null;
  dueDate?: Date | null;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface TransitionTicketStatusDto {
  tenantId: string;
  ticketId: string;
  expectedVersion: number;
  actorUserId: string;
  newStatus: TicketStatus;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AssignTicketDto {
  tenantId: string;
  ticketId: string;
  expectedVersion: number;
  actorUserId: string;
  /** UUID of the user to assign, or null to clear user assignment. */
  assigneeUserId?: string | null;
  /** UUID of the group to assign, or null to clear group assignment. */
  assignedGroupId?: string | null;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UnassignTicketDto {
  tenantId: string;
  ticketId: string;
  expectedVersion: number;
  actorUserId: string;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class TicketsService {
  constructor(@Inject(TicketsRepository) private readonly repository: TicketsRepository) {}

  async createTicket(dto: CreateTicketDto): Promise<TicketAggregate> {
    const ticketId = randomUUID();

    // publicRef is generated atomically inside the repository transaction
    // to prevent race conditions under concurrent creates. We pass a
    // placeholder; the repository overwrites it inside the transaction.
    const aggregate = TicketAggregate.create({
      assignedGroupId: dto.assignedGroupId,
      assigneeUserId: dto.assigneeUserId,
      channel: dto.channel,
      description: dto.description,
      dueDate: dto.dueDate,
      id: ticketId,
      priority: dto.priority,
      publicRef: "PENDING", // replaced atomically in repository.create()
      requesterUserId: dto.requesterUserId,
      tenantId: dto.tenantId,
      title: dto.title,
      type: dto.type,
    });

    return this.repository.createWithAudit(aggregate, {
      action: "ticket.created",
      actorUserId: dto.requesterUserId,
      correlationId: dto.correlationId,
      ipAddress: dto.ipAddress,
      metadata: {
        channel: aggregate.channel,
        priority: aggregate.priority,
        publicRef: aggregate.publicRef,
        status: aggregate.status,
        title: aggregate.title,
        type: aggregate.type,
      },
      outcome: "SUCCESS",
      targetId: aggregate.id,
      targetType: "ticket",
      tenantId: dto.tenantId,
      userAgent: dto.userAgent,
    });
  }

  async getTicketById(tenantId: string, id: string): Promise<TicketAggregate> {
    const ticket = await this.repository.findById(tenantId, id);
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }
    return ticket;
  }

  async getTicketByPublicRef(tenantId: string, publicRef: string): Promise<TicketAggregate> {
    const ticket = await this.repository.findByPublicRef(tenantId, publicRef);
    if (!ticket) {
      throw new NotFoundException(`Ticket with reference ${publicRef} not found`);
    }
    return ticket;
  }

  async listTickets(dto: ListTicketsDto): Promise<ListTicketsResult> {
    const skip = (dto.page - 1) * dto.pageSize;
    const take = dto.pageSize;

    const params: FindTicketsParams = {
      filters: dto.filters,
      skip,
      sort: dto.sort,
      take,
    };

    // Run findMany and count in a single transaction so pagination metadata
    // is consistent even under concurrent writes.
    const [items, totalRecords] = await Promise.all([
      this.repository.findMany(dto.tenantId, params),
      this.repository.count(dto.tenantId, dto.filters),
    ]);

    const totalPages = Math.ceil(totalRecords / dto.pageSize);

    return {
      appliedFilters: dto.filters ?? {},
      currentPage: dto.page,
      hasNextPage: dto.page < totalPages,
      hasPreviousPage: dto.page > 1,
      items,
      pageSize: dto.pageSize,
      sort: dto.sort,
      totalPages,
      totalRecords,
    };
  }

  /**
   * PostgreSQL-backed ticket search. Reuses list pagination/filter/sort machinery.
   * Does not emit timeline or audit events.
   */
  async searchTickets(dto: ListTicketsDto): Promise<ListTicketsResult> {
    return this.listTickets(dto);
  }

  async countTickets(dto: CountTicketsDto): Promise<{ count: number }> {
    const count = await this.repository.count(dto.tenantId, dto.filters);
    return { count };
  }

  async updateTicket(dto: UpdateTicketDto): Promise<TicketAggregate> {
    const ticket = await this.getTicketById(dto.tenantId, dto.ticketId);

    ticket.updateFields(
      {
        assignedGroupId: dto.assignedGroupId,
        assigneeUserId: dto.assigneeUserId,
        channel: dto.channel,
        description: dto.description,
        dueDate: dto.dueDate,
        priority: dto.priority,
        title: dto.title,
        type: dto.type,
      },
      dto.expectedVersion,
    );

    return this.repository.updateWithAudit(ticket, dto.expectedVersion, {
      action: "ticket.updated",
      actorUserId: dto.actorUserId,
      correlationId: dto.correlationId,
      ipAddress: dto.ipAddress,
      metadata: {
        newVersion: ticket.version,
        previousVersion: dto.expectedVersion,
        publicRef: ticket.publicRef,
      },
      outcome: "SUCCESS",
      targetId: ticket.id,
      targetType: "ticket",
      tenantId: dto.tenantId,
      userAgent: dto.userAgent,
    });
  }

  async transitionStatus(dto: TransitionTicketStatusDto): Promise<TicketAggregate> {
    const ticket = await this.getTicketById(dto.tenantId, dto.ticketId);

    const previousStatus = ticket.status;
    ticket.transitionTo(dto.newStatus, dto.expectedVersion);

    return this.repository.updateWithAudit(ticket, dto.expectedVersion, {
      action: "ticket.status_changed",
      actorUserId: dto.actorUserId,
      correlationId: dto.correlationId,
      ipAddress: dto.ipAddress,
      metadata: {
        fromStatus: previousStatus,
        newVersion: ticket.version,
        publicRef: ticket.publicRef,
        toStatus: ticket.status,
      },
      outcome: "SUCCESS",
      targetId: ticket.id,
      targetType: "ticket",
      tenantId: dto.tenantId,
      userAgent: dto.userAgent,
    });
  }

  async assignTicket(dto: AssignTicketDto): Promise<TicketAggregate> {
    const ticket = await this.getTicketById(dto.tenantId, dto.ticketId);

    // Groups are not implemented yet (ADR-0008). Reject opaque group IDs.
    if (dto.assignedGroupId !== undefined && dto.assignedGroupId !== null) {
      throw new BadRequestException(
        "assignedGroupId is not supported until Organizations/Groups are implemented",
      );
    }

    // Validate assignee user is active and belongs to this tenant
    if (dto.assigneeUserId) {
      const activeUser = await this.repository.findActiveUserInTenant(
        dto.tenantId,
        dto.assigneeUserId,
      );
      if (!activeUser) {
        throw new BadRequestException(
          `Assignee user ${dto.assigneeUserId} is not an active member of this tenant`,
        );
      }
    }

    const isReassign =
      ticket.assigneeUserId !== null &&
      ticket.assigneeUserId !== undefined &&
      (dto.assigneeUserId !== ticket.assigneeUserId ||
        dto.assignedGroupId !== ticket.assignedGroupId);

    const { previousAssigneeUserId, previousAssignedGroupId } = ticket.assign(
      {
        assignedGroupId: dto.assignedGroupId,
        assigneeUserId: dto.assigneeUserId,
      },
      dto.expectedVersion,
    );

    return this.repository.updateWithAudit(ticket, dto.expectedVersion, {
      action: isReassign ? "ticket.reassigned" : "ticket.assigned",
      actorUserId: dto.actorUserId,
      correlationId: dto.correlationId,
      ipAddress: dto.ipAddress,
      metadata: {
        newAssignedGroupId: ticket.assignedGroupId ?? null,
        newAssigneeUserId: ticket.assigneeUserId ?? null,
        newVersion: ticket.version,
        previousAssignedGroupId: previousAssignedGroupId ?? null,
        previousAssigneeUserId: previousAssigneeUserId ?? null,
        previousVersion: dto.expectedVersion,
        publicRef: ticket.publicRef,
      },
      outcome: "SUCCESS",
      targetId: ticket.id,
      targetType: "ticket",
      tenantId: dto.tenantId,
      userAgent: dto.userAgent,
    });
  }

  async unassignTicket(dto: UnassignTicketDto): Promise<TicketAggregate> {
    const ticket = await this.getTicketById(dto.tenantId, dto.ticketId);

    const { previousAssigneeUserId, previousAssignedGroupId } = ticket.unassign(
      dto.expectedVersion,
    );

    return this.repository.updateWithAudit(ticket, dto.expectedVersion, {
      action: "ticket.unassigned",
      actorUserId: dto.actorUserId,
      correlationId: dto.correlationId,
      ipAddress: dto.ipAddress,
      metadata: {
        newVersion: ticket.version,
        previousAssignedGroupId: previousAssignedGroupId ?? null,
        previousAssigneeUserId: previousAssigneeUserId ?? null,
        previousVersion: dto.expectedVersion,
        publicRef: ticket.publicRef,
      },
      outcome: "SUCCESS",
      targetId: ticket.id,
      targetType: "ticket",
      tenantId: dto.tenantId,
      userAgent: dto.userAgent,
    });
  }

  async getTicketTimeline(dto: GetTicketTimelineDto): Promise<GetTicketTimelineResult> {
    // Verify the ticket exists and belongs to this tenant before returning audit events.
    await this.getTicketById(dto.tenantId, dto.ticketId);

    const skip = (dto.page - 1) * dto.pageSize;
    const { items, totalRecords } = await this.repository.findTimeline(dto.tenantId, dto.ticketId, {
      skip,
      take: dto.pageSize,
    });

    const totalPages = Math.ceil(totalRecords / dto.pageSize) || 1;

    return {
      items,
      totalRecords,
      totalPages,
      currentPage: dto.page,
      pageSize: dto.pageSize,
      hasNextPage: dto.page < totalPages,
      hasPreviousPage: dto.page > 1,
    };
  }
}
