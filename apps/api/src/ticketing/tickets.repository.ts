import { Inject, Injectable } from "@nestjs/common";
import {
  Prisma,
  type Ticket as PrismaTicket,
  TicketChannel,
  TicketPriority,
  TicketStatus,
  TicketType,
} from "@prisma/client";

import { type AuditEventInput, buildAuditEventData } from "../audit/audit-event";
import { PrismaService } from "../database/prisma.service";
import {
  TicketAggregate,
  TicketConcurrencyException,
  type TicketProps,
} from "./domain/ticket.aggregate";

export interface TicketFilters {
  status?: TicketStatus[];
  priority?: TicketPriority[];
  type?: TicketType[];
  channel?: TicketChannel[];
  assigneeUserId?: string[];
  requesterUserId?: string[];
  assignedGroupId?: string[];
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  dueAfter?: string;
  dueBefore?: string;
}

export interface TicketSort {
  field: string;
  direction: "asc" | "desc";
}

export interface FindTicketsParams {
  filters?: TicketFilters;
  sort?: TicketSort;
  skip?: number;
  take?: number;
}

@Injectable()
export class TicketsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(aggregate: TicketAggregate): Promise<TicketAggregate> {
    const props = aggregate.toProps();
    const created = await this.prisma.ticket.create({
      data: {
        assignedGroupId: props.assignedGroupId,
        assigneeUserId: props.assigneeUserId,
        channel: props.channel,
        closedAt: props.closedAt,
        description: props.description,
        dueDate: props.dueDate,
        id: props.id,
        priority: props.priority,
        publicRef: props.publicRef,
        requesterUserId: props.requesterUserId,
        solvedAt: props.solvedAt,
        status: props.status,
        tenantId: props.tenantId,
        title: props.title,
        type: props.type,
        version: props.version,
      },
    });

    return this.toDomain(created);
  }

  async findById(tenantId: string, id: string): Promise<TicketAggregate | null> {
    const record = await this.prisma.ticket.findFirst({
      where: {
        deletedAt: null,
        id,
        tenantId,
      },
    });

    return record ? this.toDomain(record) : null;
  }

  async findByPublicRef(tenantId: string, publicRef: string): Promise<TicketAggregate | null> {
    const record = await this.prisma.ticket.findFirst({
      where: {
        deletedAt: null,
        publicRef,
        tenantId,
      },
    });

    return record ? this.toDomain(record) : null;
  }

  async update(aggregate: TicketAggregate, expectedVersion: number): Promise<TicketAggregate> {
    const props = aggregate.toProps();

    const updated = await this.prisma.ticket.updateMany({
      data: {
        assignedGroupId: props.assignedGroupId,
        assigneeUserId: props.assigneeUserId,
        channel: props.channel,
        closedAt: props.closedAt,
        description: props.description,
        dueDate: props.dueDate,
        priority: props.priority,
        solvedAt: props.solvedAt,
        status: props.status,
        title: props.title,
        type: props.type,
        version: props.version,
      },
      where: {
        id: props.id,
        tenantId: props.tenantId,
        version: expectedVersion,
      },
    });

    if (updated.count === 0) {
      const current = await this.findById(props.tenantId, props.id);
      const currentVersion = current ? current.version : props.version;
      throw new TicketConcurrencyException(expectedVersion, currentVersion, props.id);
    }

    const reloaded = await this.findById(props.tenantId, props.id);
    if (!reloaded) {
      throw new Error(`Failed to reload updated ticket ${props.id}`);
    }

    return reloaded;
  }

  async getNextPublicRefSequence(tenantId: string): Promise<string> {
    const count = await this.prisma.ticket.count({
      where: {
        tenantId,
      },
    });

    const nextSeq = count + 1001;
    return `TKT-${nextSeq}`;
  }

  async recordAuditEvent(input: AuditEventInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: buildAuditEventData(input),
    });
  }

  async findMany(tenantId: string, params: FindTicketsParams): Promise<TicketAggregate[]> {
    const { filters, sort, skip, take } = params;

    const where = this.buildWhereClause(tenantId, filters);
    const orderBy: Prisma.TicketOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { createdAt: "desc" };

    const records = await this.prisma.ticket.findMany({
      where,
      orderBy,
      skip,
      take,
    });

    return records.map((record) => this.toDomain(record));
  }

  async count(tenantId: string, filters?: TicketFilters): Promise<number> {
    const where = this.buildWhereClause(tenantId, filters);
    return this.prisma.ticket.count({ where });
  }

  private buildWhereClause(tenantId: string, filters?: TicketFilters): Prisma.TicketWhereInput {
    const where: Prisma.TicketWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (!filters) return where;

    if (filters.status?.length) where.status = { in: filters.status };
    if (filters.priority?.length) where.priority = { in: filters.priority };
    if (filters.type?.length) where.type = { in: filters.type };
    if (filters.channel?.length) where.channel = { in: filters.channel };
    if (filters.assigneeUserId?.length) where.assigneeUserId = { in: filters.assigneeUserId };
    if (filters.requesterUserId?.length) where.requesterUserId = { in: filters.requesterUserId };
    if (filters.assignedGroupId?.length) where.assignedGroupId = { in: filters.assignedGroupId };

    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) where.createdAt.gte = filters.createdAfter;
      if (filters.createdBefore) where.createdAt.lte = filters.createdBefore;
    }

    if (filters.updatedAfter || filters.updatedBefore) {
      where.updatedAt = {};
      if (filters.updatedAfter) where.updatedAt.gte = filters.updatedAfter;
      if (filters.updatedBefore) where.updatedAt.lte = filters.updatedBefore;
    }

    if (filters.dueAfter || filters.dueBefore) {
      where.dueDate = {};
      if (filters.dueAfter) where.dueDate.gte = filters.dueAfter;
      if (filters.dueBefore) where.dueDate.lte = filters.dueBefore;
    }

    return where;
  }

  /**
   * Validates that a user exists, is ACTIVE, and has an active role in the
   * given tenant.  Returns a minimal record if found, or `null` otherwise.
   *
   * Used by the assignment service to prevent cross-tenant or inactive
   * user assignments.
   */
  async findActiveUserInTenant(tenantId: string, userId: string): Promise<{ id: string } | null> {
    const user = await this.prisma.user.findFirst({
      select: { id: true },
      where: {
        deletedAt: null,
        id: userId,
        roles: {
          some: {
            revokedAt: null,
            role: { deletedAt: null },
            tenantId,
          },
        },
        state: "ACTIVE",
      },
    });

    return user ?? null;
  }

  private toDomain(record: PrismaTicket): TicketAggregate {
    const props: TicketProps = {
      assignedGroupId: record.assignedGroupId,
      assigneeUserId: record.assigneeUserId,
      channel: record.channel,
      closedAt: record.closedAt,
      createdAt: record.createdAt,
      deletedAt: record.deletedAt,
      description: record.description,
      dueDate: record.dueDate,
      id: record.id,
      priority: record.priority,
      publicRef: record.publicRef,
      requesterUserId: record.requesterUserId,
      solvedAt: record.solvedAt,
      status: record.status,
      tenantId: record.tenantId,
      title: record.title,
      type: record.type,
      updatedAt: record.updatedAt,
      version: record.version,
    };

    return new TicketAggregate(props);
  }
}
