import { Inject, Injectable } from "@nestjs/common";
import {
  type AuditEvent as PrismaAuditEvent,
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
import { buildTicketSearchOrClause } from "./ticket-search.builder";

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
  /** Case-insensitive partial match across publicRef/title/description/requester. */
  q?: string;
  /** When set, require at least one (or zero) non-deleted attachment. */
  hasAttachments?: boolean;
  /** When set, require at least one (or zero) non-deleted comment. */
  hasComments?: boolean;
  /** OR filter used by OWN-scoped list/search access. */
  requesterOrAssigneeUserId?: string;
  /** GROUP-scoped list/search access (empty array matches nothing). */
  assignedGroupIds?: string[];
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

    /**
     * Wrap the publicRef sequence read and the ticket insert in a
     * SERIALIZABLE transaction so concurrent creates cannot duplicate publicRef.
     */
    const created = await this.prisma.$transaction(
      async (tx) => {
        const count = await tx.ticket.count({ where: { tenantId: props.tenantId } });
        const publicRef = `TKT-${count + 1001}`;

        return tx.ticket.create({
          data: this.toCreateData({ ...props, publicRef }),
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.toDomain(created);
  }

  /**
   * Atomically persists ticket state and its audit event.
   * Prepared so a transactional outbox insert can join the same transaction later.
   */
  async createWithAudit(
    aggregate: TicketAggregate,
    audit: AuditEventInput,
  ): Promise<TicketAggregate> {
    const props = aggregate.toProps();

    const created = await this.prisma.$transaction(
      async (tx) => {
        const count = await tx.ticket.count({ where: { tenantId: props.tenantId } });
        const publicRef = `TKT-${count + 1001}`;

        const ticket = await tx.ticket.create({
          data: this.toCreateData({ ...props, publicRef }),
        });
        await tx.auditEvent.create({
          data: buildAuditEventData({
            ...audit,
            metadata: {
              ...audit.metadata,
              publicRef,
            },
          }),
        });
        return ticket;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

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
    return this.updateWithClient(this.prisma, aggregate, expectedVersion);
  }

  /**
   * Atomically persists a ticket mutation and its audit event.
   * Prepared so a transactional outbox insert can join the same transaction later.
   */
  async updateWithAudit(
    aggregate: TicketAggregate,
    expectedVersion: number,
    audit: AuditEventInput,
  ): Promise<TicketAggregate> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await this.updateWithClient(tx, aggregate, expectedVersion);
      await tx.auditEvent.create({
        data: buildAuditEventData(audit),
      });
      // Future: await tx.outboxMessage.create({ ... }) in the same transaction.
      return updated;
    });
  }

  /**
   * Generates the next public reference for a ticket in a tenant.
   *
   * @deprecated Use the transactional create() method instead – the sequence
   * is now computed atomically inside the transaction. This method is kept
   * only for backward-compatibility with existing service code that passes
   * the publicRef from outside; it will be removed in a future clean-up.
   */
  async getNextPublicRefSequence(tenantId: string): Promise<string> {
    const count = await this.prisma.ticket.count({
      where: { tenantId },
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

  /**
   * Returns paginated audit events for a ticket, ordered newest-first.
   * Only events where targetType = 'ticket' and targetId = ticketId are
   * returned. tenantId is enforced to prevent cross-tenant leakage.
   */
  async findTimeline(
    tenantId: string,
    ticketId: string,
    params: { skip?: number; take?: number },
  ): Promise<{ items: PrismaAuditEvent[]; totalRecords: number }> {
    const where: Prisma.AuditEventWhereInput = {
      tenantId,
      targetType: "ticket",
      targetId: ticketId,
    };

    const [items, totalRecords] = await this.prisma.$transaction([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.auditEvent.count({ where }),
    ]);

    return { items, totalRecords };
  }

  buildWhereClause(tenantId: string, filters?: TicketFilters): Prisma.TicketWhereInput {
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

    const andConditions: Prisma.TicketWhereInput[] = [];

    const scopeOr = this.buildScopeOrClause(filters);
    if (scopeOr === "none") {
      // GROUP-only scope with no memberships → no visible rows.
      where.id = { in: [] };
    } else if (scopeOr) {
      andConditions.push({ OR: scopeOr });
    }

    if (filters.q?.trim()) {
      const searchOr = buildTicketSearchOrClause(filters.q);
      if (searchOr.length > 0) {
        andConditions.push({ OR: searchOr });
      }
    }

    if (filters.hasAttachments === true) {
      andConditions.push({ attachments: { some: { deletedAt: null } } });
    } else if (filters.hasAttachments === false) {
      andConditions.push({ attachments: { none: { deletedAt: null } } });
    }

    if (filters.hasComments === true) {
      andConditions.push({ comments: { some: { deletedAt: null } } });
    } else if (filters.hasComments === false) {
      andConditions.push({ comments: { none: { deletedAt: null } } });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

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

  private buildScopeOrClause(
    filters: TicketFilters,
  ): Prisma.TicketWhereInput[] | "none" | undefined {
    const hasOwnScope = Boolean(filters.requesterOrAssigneeUserId);
    const hasGroupScope = filters.assignedGroupIds !== undefined;

    if (!hasOwnScope && !hasGroupScope) {
      return undefined;
    }

    const scopeOr: Prisma.TicketWhereInput[] = [];

    if (filters.requesterOrAssigneeUserId) {
      scopeOr.push(
        { requesterUserId: filters.requesterOrAssigneeUserId },
        { assigneeUserId: filters.requesterOrAssigneeUserId },
      );
    }

    if (filters.assignedGroupIds && filters.assignedGroupIds.length > 0) {
      scopeOr.push({ assignedGroupId: { in: filters.assignedGroupIds } });
    }

    if (scopeOr.length === 0) {
      return "none";
    }

    return scopeOr;
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

  private async updateWithClient(
    client: Prisma.TransactionClient | PrismaService,
    aggregate: TicketAggregate,
    expectedVersion: number,
  ): Promise<TicketAggregate> {
    const props = aggregate.toProps();

    const updated = await client.ticket.updateMany({
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
      const current = await client.ticket.findFirst({
        where: {
          deletedAt: null,
          id: props.id,
          tenantId: props.tenantId,
        },
      });
      const currentVersion = current ? current.version : props.version;
      throw new TicketConcurrencyException(expectedVersion, currentVersion, props.id);
    }

    const reloaded = await client.ticket.findFirst({
      where: {
        deletedAt: null,
        id: props.id,
        tenantId: props.tenantId,
      },
    });
    if (!reloaded) {
      throw new Error(`Failed to reload updated ticket ${props.id}`);
    }

    return this.toDomain(reloaded);
  }

  private toCreateData(props: TicketProps) {
    return {
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
    };
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
