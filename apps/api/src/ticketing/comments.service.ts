import { randomUUID } from "node:crypto";

import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CommentVisibility, NotificationEventType } from "@prisma/client";

import { NotificationsService } from "../notifications/notifications.service";
import { RbacService } from "../rbac/rbac.service";
import { SlaEngineService } from "../sla/sla-engine.service";
import {
  type CommentFilters,
  CommentsRepository,
  type FindCommentsParams,
} from "./comments.repository";
import { CommentEntity } from "./domain/comment.entity";
import type { CreateCommentRequestDto } from "./dto/create-comment.dto";
import type { UpdateCommentRequestDto } from "./dto/update-comment.dto";
import { TicketsRepository } from "./tickets.repository";

export interface ListCommentsMeta {
  totalRecords: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ListCommentsResult {
  items: CommentEntity[];
  meta: ListCommentsMeta;
}

@Injectable()
export class CommentsService {
  constructor(
    @Inject(CommentsRepository) private readonly commentsRepository: CommentsRepository,
    @Inject(TicketsRepository) private readonly ticketsRepository: TicketsRepository,
    @Inject(RbacService) private readonly rbacService: RbacService,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
    @Inject(SlaEngineService) private readonly slaEngine: SlaEngineService,
  ) {}

  async createComment(
    tenantId: string,
    ticketId: string,
    dto: CreateCommentRequestDto,
    actorUserId: string,
  ): Promise<CommentEntity> {
    const ticket = await this.ticketsRepository.findById(tenantId, ticketId);
    if (!ticket) {
      throw new NotFoundException("Ticket not found");
    }

    const visibility = dto.visibility ?? CommentVisibility.PUBLIC;

    const permissionKey =
      visibility === CommentVisibility.INTERNAL
        ? "ticket.comment.internal.create"
        : "ticket.comment.public.create";

    const canCreate = await this.rbacService.can({
      userId: actorUserId,
      tenantId,
      permissionKey,
      resource: {
        assigneeUserId: ticket.assigneeUserId,
        groupId: ticket.assignedGroupId,
        ownerUserId: ticket.requesterUserId,
      },
    });

    if (!canCreate) {
      throw new ForbiddenException(`You do not have permission to create ${visibility} comments`);
    }

    const commentId = randomUUID();
    const entity = new CommentEntity({
      id: commentId,
      tenantId,
      ticketId,
      authorUserId: actorUserId,
      body: dto.body,
      visibility,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const created = await this.commentsRepository.createWithAudit(entity, {
      action: "ticket.comment.created",
      actorUserId,
      metadata: {
        ticketId,
        visibility,
      },
      targetId: commentId,
      targetType: "Comment",
      outcome: "SUCCESS",
      tenantId,
    });

    const recipients = new Set<string>();
    if (visibility === CommentVisibility.PUBLIC) {
      recipients.add(ticket.requesterUserId);
    }
    if (ticket.assigneeUserId) {
      recipients.add(ticket.assigneeUserId);
    }

    const eventType =
      visibility === CommentVisibility.INTERNAL
        ? NotificationEventType.COMMENT_CREATED_INTERNAL
        : NotificationEventType.COMMENT_CREATED_PUBLIC;

    await this.notificationsService.createManySafe(
      [...recipients].map((recipientUserId) => ({
        actorUserId,
        body: `New ${visibility.toLowerCase()} comment on ticket ${ticket.publicRef}.`,
        eventType,
        payload: {
          commentId: created.id,
          publicRef: ticket.publicRef,
          visibility,
        },
        recipientUserId,
        resourceId: ticket.id,
        resourceType: "ticket",
        tenantId,
        title: `New comment on ${ticket.publicRef}`,
      })),
    );

    if (visibility === CommentVisibility.PUBLIC) {
      await this.slaEngine.onPublicAgentComment(
        {
          assigneeUserId: ticket.assigneeUserId,
          channel: ticket.channel,
          id: ticket.id,
          priority: ticket.priority,
          publicRef: ticket.publicRef,
          requesterUserId: ticket.requesterUserId,
          status: ticket.status,
          tenantId: ticket.tenantId,
          type: ticket.type,
        },
        actorUserId,
        actorUserId,
      );
    }

    return created;
  }

  async getComment(
    tenantId: string,
    commentId: string,
    actorUserId: string,
  ): Promise<CommentEntity> {
    const comment = await this.commentsRepository.findById(tenantId, commentId);
    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    const canRead = await this.rbacService.can({
      userId: actorUserId,
      tenantId,
      permissionKey: "ticket.comment.read",
    });
    if (!canRead) {
      throw new ForbiddenException("Missing ticket.comment.read permission");
    }

    if (comment.visibility === CommentVisibility.INTERNAL) {
      const canReadInternal = await this.rbacService.can({
        userId: actorUserId,
        tenantId,
        permissionKey: "ticket.comment.internal.read",
      });
      if (!canReadInternal) {
        throw new NotFoundException("Comment not found"); // Hide existence of internal comments
      }
    }

    return comment;
  }

  async listComments(
    tenantId: string,
    ticketId: string,
    actorUserId: string,
    params: {
      page: number;
      pageSize: number;
      filters?: CommentFilters;
      sort: { field: string; direction: "asc" | "desc" };
    },
  ): Promise<ListCommentsResult> {
    const ticket = await this.ticketsRepository.findById(tenantId, ticketId);
    if (!ticket) {
      throw new NotFoundException("Ticket not found");
    }

    const canRead = await this.rbacService.can({
      userId: actorUserId,
      tenantId,
      permissionKey: "ticket.comment.read",
    });
    if (!canRead) {
      throw new ForbiddenException("Missing ticket.comment.read permission");
    }

    const canReadInternal = await this.rbacService.can({
      userId: actorUserId,
      tenantId,
      permissionKey: "ticket.comment.internal.read",
    });

    const effectiveFilters = { ...params.filters };

    if (!canReadInternal) {
      effectiveFilters.visibility = [CommentVisibility.PUBLIC];
    } else if (params.filters?.visibility) {
      effectiveFilters.visibility = params.filters.visibility;
    }

    const skip = (params.page - 1) * params.pageSize;
    const take = params.pageSize;

    const findParams: FindCommentsParams = {
      filters: effectiveFilters,
      sort: params.sort,
      skip,
      take,
    };

    const [items, totalRecords] = await Promise.all([
      this.commentsRepository.findMany(tenantId, ticketId, findParams),
      this.commentsRepository.count(tenantId, ticketId, effectiveFilters),
    ]);

    const totalPages = Math.ceil(totalRecords / params.pageSize);

    return {
      items,
      meta: {
        totalRecords,
        totalPages,
        currentPage: params.page,
        pageSize: params.pageSize,
        hasNextPage: params.page < totalPages,
        hasPreviousPage: params.page > 1,
      },
    };
  }

  async updateComment(
    tenantId: string,
    commentId: string,
    dto: UpdateCommentRequestDto,
    actorUserId: string,
  ): Promise<CommentEntity> {
    const comment = await this.commentsRepository.findById(tenantId, commentId);
    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    const canUpdate = await this.rbacService.can({
      userId: actorUserId,
      tenantId,
      permissionKey: "ticket.comment.update",
    });
    if (!canUpdate) {
      throw new ForbiddenException("Missing ticket.comment.update permission");
    }

    if (comment.authorUserId !== actorUserId) {
      throw new ForbiddenException("Only the author can update a comment");
    }

    comment.updateBody(dto.body, dto.expectedVersion);
    return this.commentsRepository.updateWithAudit(comment, dto.expectedVersion, {
      action: "ticket.comment.updated",
      actorUserId,
      metadata: {
        ticketId: comment.ticketId,
      },
      targetId: commentId,
      targetType: "Comment",
      outcome: "SUCCESS",
      tenantId,
    });
  }

  async softDeleteComment(
    tenantId: string,
    commentId: string,
    expectedVersion: number,
    reason: string,
    actorUserId: string,
  ): Promise<void> {
    const comment = await this.commentsRepository.findById(tenantId, commentId);
    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    const canDelete = await this.rbacService.can({
      userId: actorUserId,
      tenantId,
      permissionKey: "ticket.comment.delete",
    });
    if (!canDelete) {
      throw new ForbiddenException("Missing ticket.comment.delete permission");
    }

    if (comment.authorUserId !== actorUserId) {
      throw new ForbiddenException("Only the author can delete a comment");
    }

    comment.softDelete(expectedVersion);
    await this.commentsRepository.updateWithAudit(comment, expectedVersion, {
      action: "ticket.comment.deleted",
      actorUserId,
      metadata: {
        ticketId: comment.ticketId,
        reason,
      },
      targetId: commentId,
      targetType: "Comment",
      outcome: "SUCCESS",
      tenantId,
    });
  }
}
