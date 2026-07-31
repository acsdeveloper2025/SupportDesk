import { randomUUID } from "node:crypto";

import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { TicketChannel, TicketPriority, TicketStatus, TicketType } from "@prisma/client";

import { TicketAggregate } from "./domain/ticket.aggregate";
import { TicketsRepository } from "./tickets.repository";

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

@Injectable()
export class TicketsService {
  constructor(@Inject(TicketsRepository) private readonly repository: TicketsRepository) {}

  async createTicket(dto: CreateTicketDto): Promise<TicketAggregate> {
    const ticketId = randomUUID();
    const publicRef = await this.repository.getNextPublicRefSequence(dto.tenantId);

    const aggregate = TicketAggregate.create({
      assignedGroupId: dto.assignedGroupId,
      assigneeUserId: dto.assigneeUserId,
      channel: dto.channel,
      description: dto.description,
      dueDate: dto.dueDate,
      id: ticketId,
      priority: dto.priority,
      publicRef,
      requesterUserId: dto.requesterUserId,
      tenantId: dto.tenantId,
      title: dto.title,
      type: dto.type,
    });

    const created = await this.repository.create(aggregate);

    await this.repository.recordAuditEvent({
      action: "ticket.created",
      actorUserId: dto.requesterUserId,
      correlationId: dto.correlationId,
      ipAddress: dto.ipAddress,
      metadata: {
        channel: created.channel,
        priority: created.priority,
        publicRef: created.publicRef,
        status: created.status,
        title: created.title,
        type: created.type,
      },
      outcome: "SUCCESS",
      targetId: created.id,
      targetType: "ticket",
      tenantId: dto.tenantId,
      userAgent: dto.userAgent,
    });

    return created;
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

    const updated = await this.repository.update(ticket, dto.expectedVersion);

    await this.repository.recordAuditEvent({
      action: "ticket.updated",
      actorUserId: dto.actorUserId,
      correlationId: dto.correlationId,
      ipAddress: dto.ipAddress,
      metadata: {
        newVersion: updated.version,
        previousVersion: dto.expectedVersion,
        publicRef: updated.publicRef,
      },
      outcome: "SUCCESS",
      targetId: updated.id,
      targetType: "ticket",
      tenantId: dto.tenantId,
      userAgent: dto.userAgent,
    });

    return updated;
  }

  async transitionStatus(dto: TransitionTicketStatusDto): Promise<TicketAggregate> {
    const ticket = await this.getTicketById(dto.tenantId, dto.ticketId);

    const previousStatus = ticket.status;
    ticket.transitionTo(dto.newStatus, dto.expectedVersion);

    const updated = await this.repository.update(ticket, dto.expectedVersion);

    await this.repository.recordAuditEvent({
      action: "ticket.status_changed",
      actorUserId: dto.actorUserId,
      correlationId: dto.correlationId,
      ipAddress: dto.ipAddress,
      metadata: {
        fromStatus: previousStatus,
        newVersion: updated.version,
        publicRef: updated.publicRef,
        toStatus: updated.status,
      },
      outcome: "SUCCESS",
      targetId: updated.id,
      targetType: "ticket",
      tenantId: dto.tenantId,
      userAgent: dto.userAgent,
    });

    return updated;
  }
}
