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
    const { count } = await this.prisma.comment.updateMany({
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
      // Find what went wrong
      const existing = await this.prisma.comment.findUnique({ where: { id: entity.id } });
      if (!existing || existing.tenantId !== entity.tenantId || existing.deletedAt) {
        throw new Error("Comment not found or deleted");
      }
      if (existing.version !== expectedVersion) {
        throw new CommentConcurrencyException(expectedVersion, existing.version, entity.id);
      }
      throw new Error("Comment update failed");
    }

    return entity; // assuming mutation holds the latest state, but typically we return mapped. For entity, returning entity is fine.
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
