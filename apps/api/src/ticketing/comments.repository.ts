import { Inject, Injectable } from "@nestjs/common";
import { type Comment as PrismaComment, CommentVisibility, Prisma } from "@prisma/client";

import { type AuditEventInput, buildAuditEventData } from "../audit/audit-event";
import { PrismaService } from "../database/prisma.service";
import { CommentConcurrencyException, CommentEntity } from "./domain/comment.entity";

export interface CommentFilters {
  visibility?: CommentVisibility[];
  authorUserId?: string[];
  createdAfter?: string;
  createdBefore?: string;
}

export interface FindCommentsParams {
  filters?: CommentFilters;
  sort?: {
    field: string;
    direction: "asc" | "desc";
  };
  skip?: number;
  take?: number;
}

@Injectable()
export class CommentsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async recordAuditEvent(input: AuditEventInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: buildAuditEventData(input),
    });
  }

  async create(entity: CommentEntity): Promise<CommentEntity> {
    const created = await this.prisma.comment.create({
      data: {
        id: entity.id,
        tenantId: entity.tenantId,
        ticketId: entity.ticketId,
        authorUserId: entity.authorUserId,
        body: entity.body,
        visibility: entity.visibility,
        version: entity.version,
      },
    });

    return this.mapToDomain(created);
  }

  /**
   * Atomically persists comment state and its audit event.
   * Prepared so a transactional outbox insert can join the same transaction later.
   */
  async createWithAudit(entity: CommentEntity, audit: AuditEventInput): Promise<CommentEntity> {
    const created = await this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          id: entity.id,
          tenantId: entity.tenantId,
          ticketId: entity.ticketId,
          authorUserId: entity.authorUserId,
          body: entity.body,
          visibility: entity.visibility,
          version: entity.version,
        },
      });
      await tx.auditEvent.create({
        data: buildAuditEventData(audit),
      });
      // Future: await tx.outboxMessage.create({ ... }) in the same transaction.
      return comment;
    });

    return this.mapToDomain(created);
  }

  async findById(tenantId: string, id: string): Promise<CommentEntity | null> {
    const record = await this.prisma.comment.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    return record ? this.mapToDomain(record) : null;
  }

  async findMany(
    tenantId: string,
    ticketId: string,
    params: FindCommentsParams,
  ): Promise<CommentEntity[]> {
    const records = await this.prisma.comment.findMany({
      where: this.buildWhereClause(tenantId, ticketId, params.filters),
      orderBy: params.sort ? { [params.sort.field]: params.sort.direction } : { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
    });

    return records.map((record) => this.mapToDomain(record));
  }

  async count(tenantId: string, ticketId: string, filters?: CommentFilters): Promise<number> {
    return this.prisma.comment.count({
      where: this.buildWhereClause(tenantId, ticketId, filters),
    });
  }

  async update(entity: CommentEntity, expectedVersion: number): Promise<CommentEntity> {
    return this.updateWithClient(this.prisma, entity, expectedVersion);
  }

  /**
   * Atomically persists a comment mutation and its audit event.
   * Prepared so a transactional outbox insert can join the same transaction later.
   */
  async updateWithAudit(
    entity: CommentEntity,
    expectedVersion: number,
    audit: AuditEventInput,
  ): Promise<CommentEntity> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await this.updateWithClient(tx, entity, expectedVersion);
      await tx.auditEvent.create({
        data: buildAuditEventData(audit),
      });
      // Future: await tx.outboxMessage.create({ ... }) in the same transaction.
      return updated;
    });
  }

  private async updateWithClient(
    client: Prisma.TransactionClient | PrismaService,
    entity: CommentEntity,
    expectedVersion: number,
  ): Promise<CommentEntity> {
    const { count } = await client.comment.updateMany({
      where: {
        id: entity.id,
        tenantId: entity.tenantId,
        version: expectedVersion,
        deletedAt: null,
      },
      data: {
        body: entity.body,
        version: entity.version,
        updatedAt: entity.updatedAt,
        deletedAt: entity.deletedAt,
      },
    });

    if (count === 0) {
      const existing = await client.comment.findUnique({ where: { id: entity.id } });
      if (!existing || existing.tenantId !== entity.tenantId || existing.deletedAt) {
        throw new Error("Comment not found or deleted");
      }
      if (existing.version !== expectedVersion) {
        throw new CommentConcurrencyException(expectedVersion, existing.version, entity.id);
      }
      throw new Error("Comment update failed");
    }

    return entity;
  }

  private buildWhereClause(
    tenantId: string,
    ticketId: string,
    filters?: CommentFilters,
  ): Prisma.CommentWhereInput {
    const where: Prisma.CommentWhereInput = {
      tenantId,
      ticketId,
      deletedAt: null,
    };

    if (filters) {
      if (filters.visibility && filters.visibility.length > 0) {
        where.visibility = { in: filters.visibility };
      }
      if (filters.authorUserId && filters.authorUserId.length > 0) {
        where.authorUserId = { in: filters.authorUserId };
      }
      if (filters.createdAfter || filters.createdBefore) {
        where.createdAt = {};
        if (filters.createdAfter) {
          where.createdAt.gte = new Date(filters.createdAfter);
        }
        if (filters.createdBefore) {
          where.createdAt.lte = new Date(filters.createdBefore);
        }
      }
    }

    return where;
  }

  private mapToDomain(record: PrismaComment): CommentEntity {
    return new CommentEntity({
      id: record.id,
      tenantId: record.tenantId,
      ticketId: record.ticketId,
      authorUserId: record.authorUserId,
      body: record.body,
      visibility: record.visibility,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }
}
