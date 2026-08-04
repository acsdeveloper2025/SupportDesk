import { randomUUID } from "node:crypto";

import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  type KbArticle,
  KbArticleStatus,
  type KbArticleVersion,
  KbArticleVisibility,
} from "@prisma/client";

import { buildAuditEventData } from "../audit/audit-event";
import { PrismaService } from "../database/prisma.service";
import type {
  CreateKbArticleDto,
  KbFeedbackDto,
  LinkKbTicketDto,
  ListKbArticlesQueryDto,
  SearchKbArticlesQueryDto,
  UpdateKbArticleDto,
} from "./dto/article-dtos";
import { KbArticlesRepository, type KbArticleWithRelations } from "./kb-articles.repository";
import { KbCategoriesRepository } from "./kb-categories.repository";
import { slugify } from "./kb-categories.service";

@Injectable()
export class KbArticlesService {
  constructor(
    @Inject(KbArticlesRepository) private readonly repository: KbArticlesRepository,
    @Inject(KbCategoriesRepository) private readonly categoriesRepository: KbCategoriesRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async createArticle(
    tenantId: string,
    authorId: string,
    dto: CreateKbArticleDto,
    correlationId?: string,
  ): Promise<KbArticleWithRelations> {
    const category = await this.categoriesRepository.findById(tenantId, dto.categoryId);
    if (!category) {
      throw new NotFoundException(`Category '${dto.categoryId}' not found`);
    }

    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.title);
    if (!slug) {
      throw new BadRequestException("Invalid article title or slug");
    }

    const existing = await this.repository.findBySlug(tenantId, slug);
    if (existing) {
      throw new BadRequestException(`Article with slug '${slug}' already exists`);
    }

    const article = await this.repository.create(tenantId, authorId, dto, slug);

    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: "kb.article.created",
        actorUserId: authorId,
        correlationId,
        outcome: "SUCCESS",
        targetId: article.id,
        targetType: "kb_article",
        tenantId,
        metadata: {
          title: article.title,
          slug: article.slug,
          categoryId: article.categoryId,
          visibility: article.visibility,
        },
      }),
    });

    return article;
  }

  async getArticle(
    tenantId: string,
    idOrSlug: string,
    canReadInternal = false,
  ): Promise<KbArticleWithRelations> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrSlug);
    const article = isUuid
      ? await this.repository.findById(tenantId, idOrSlug)
      : await this.repository.findBySlug(tenantId, idOrSlug);

    if (!article) {
      throw new NotFoundException(`Article '${idOrSlug}' not found`);
    }

    if (article.visibility === KbArticleVisibility.INTERNAL && !canReadInternal) {
      throw new NotFoundException(`Article '${idOrSlug}' not found`);
    }

    if (article.status !== KbArticleStatus.PUBLISHED && !canReadInternal) {
      throw new NotFoundException(`Article '${idOrSlug}' not found`);
    }

    // Async increment view count
    await this.repository.incrementViews(article.id);

    return article;
  }

  async listArticles(
    tenantId: string,
    query: ListKbArticlesQueryDto,
    canReadInternal = false,
  ): Promise<{ items: KbArticleWithRelations[]; total: number }> {
    return this.repository.list(tenantId, query, canReadInternal);
  }

  async searchArticles(
    tenantId: string,
    query: SearchKbArticlesQueryDto,
    canReadInternal = false,
  ): Promise<{ items: KbArticleWithRelations[]; total: number }> {
    if (!query.q || !query.q.trim()) {
      return { items: [], total: 0 };
    }
    return this.repository.search(
      tenantId,
      query.q.trim(),
      query.categoryId,
      canReadInternal,
      query.limit,
      query.offset,
    );
  }

  async updateArticle(
    tenantId: string,
    id: string,
    dto: UpdateKbArticleDto,
    actorUserId: string,
    correlationId?: string,
  ): Promise<KbArticleWithRelations> {
    const existing = await this.repository.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundException(`Article '${id}' not found`);
    }

    if (dto.categoryId) {
      const category = await this.categoriesRepository.findById(tenantId, dto.categoryId);
      if (!category) {
        throw new NotFoundException(`Category '${dto.categoryId}' not found`);
      }
    }

    let newSlug: string | undefined;
    if (dto.slug !== undefined) {
      newSlug = slugify(dto.slug);
    } else if (dto.title !== undefined && dto.title.trim() !== existing.title) {
      newSlug = slugify(dto.title);
    }

    if (newSlug && newSlug !== existing.slug) {
      const slugConflict = await this.repository.findBySlug(tenantId, newSlug);
      if (slugConflict && slugConflict.id !== id) {
        throw new BadRequestException(`Article with slug '${newSlug}' already exists`);
      }
    }

    const updated = await this.repository.update(tenantId, id, dto, newSlug);

    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: "kb.article.updated",
        actorUserId,
        correlationId,
        outcome: "SUCCESS",
        targetId: updated.id,
        targetType: "kb_article",
        tenantId,
        metadata: {
          title: updated.title,
          slug: updated.slug,
          categoryId: updated.categoryId,
        },
      }),
    });

    return updated;
  }

  async publishArticle(
    tenantId: string,
    id: string,
    publisherUserId: string,
    correlationId?: string,
  ): Promise<KbArticleWithRelations> {
    const existing = await this.repository.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundException(`Article '${id}' not found`);
    }

    const published = await this.repository.publish(tenantId, id, publisherUserId);

    const eventCorrelationId = correlationId ?? randomUUID();
    // Emit Transactional Outbox Event for Workflow / Integration
    await this.prisma.outboxEvent.create({
      data: {
        tenantId,
        eventType: "kb.article.published",
        aggregateType: "kb_article",
        aggregateId: published.id,
        correlationId: eventCorrelationId,
        dedupeKey: `evt:${tenantId}:kb.article.published:${published.id}:${eventCorrelationId}`,
        payload: {
          articleId: published.id,
          title: published.title,
          slug: published.slug,
          categoryId: published.categoryId,
          versionNumber: published.versionNumber,
          publishedAt: published.publishedAt,
          authorId: published.authorId,
        },
      },
    });

    // Record Audit Event
    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: "kb.article.published",
        actorUserId: publisherUserId,
        correlationId,
        outcome: "SUCCESS",
        targetId: published.id,
        targetType: "kb_article",
        tenantId,
        metadata: {
          title: published.title,
          slug: published.slug,
          versionNumber: published.versionNumber,
        },
      }),
    });

    return published;
  }

  async archiveArticle(
    tenantId: string,
    id: string,
    actorUserId: string,
    correlationId?: string,
  ): Promise<KbArticleWithRelations> {
    const existing = await this.repository.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundException(`Article '${id}' not found`);
    }

    const archived = await this.repository.archive(tenantId, id);

    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: "kb.article.archived",
        actorUserId,
        correlationId,
        outcome: "SUCCESS",
        targetId: archived.id,
        targetType: "kb_article",
        tenantId,
        metadata: { title: archived.title, slug: archived.slug },
      }),
    });

    return archived;
  }

  async deleteArticle(
    tenantId: string,
    id: string,
    actorUserId: string,
    correlationId?: string,
  ): Promise<KbArticle> {
    const existing = await this.repository.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundException(`Article '${id}' not found`);
    }

    const deleted = await this.repository.delete(tenantId, id);

    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: "kb.article.deleted",
        actorUserId,
        correlationId,
        outcome: "SUCCESS",
        targetId: id,
        targetType: "kb_article",
        tenantId,
        metadata: { title: existing.title, slug: existing.slug },
      }),
    });

    return deleted;
  }

  async recordFeedback(tenantId: string, id: string, dto: KbFeedbackDto): Promise<void> {
    const existing = await this.repository.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundException(`Article '${id}' not found`);
    }
    await this.repository.recordFeedback(id, dto.helpful);
  }

  async getVersions(tenantId: string, articleId: string): Promise<KbArticleVersion[]> {
    const existing = await this.repository.findById(tenantId, articleId);
    if (!existing) {
      throw new NotFoundException(`Article '${articleId}' not found`);
    }
    return this.repository.getVersions(tenantId, articleId);
  }

  async getVersion(
    tenantId: string,
    articleId: string,
    versionNumber: number,
  ): Promise<KbArticleVersion> {
    const version = await this.repository.getVersion(tenantId, articleId, versionNumber);
    if (!version) {
      throw new NotFoundException(`Version ${versionNumber} for article '${articleId}' not found`);
    }
    return version;
  }

  async linkTicket(
    tenantId: string,
    articleId: string,
    dto: LinkKbTicketDto,
    actorUserId: string,
    correlationId?: string,
  ) {
    const article = await this.repository.findById(tenantId, articleId);
    if (!article) {
      throw new NotFoundException(`Article '${articleId}' not found`);
    }

    const ticket = await this.prisma.ticket.findFirst({
      where: { tenantId, id: dto.ticketId },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket '${dto.ticketId}' not found`);
    }

    const link = await this.repository.linkTicket(tenantId, articleId, dto.ticketId, actorUserId);

    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: "kb.article.ticket_linked",
        actorUserId,
        correlationId,
        outcome: "SUCCESS",
        targetId: articleId,
        targetType: "kb_article",
        tenantId,
        metadata: { ticketId: dto.ticketId },
      }),
    });

    return link;
  }

  async unlinkTicket(
    tenantId: string,
    articleId: string,
    ticketId: string,
    actorUserId: string,
    correlationId?: string,
  ): Promise<void> {
    await this.repository.unlinkTicket(tenantId, articleId, ticketId);

    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: "kb.article.ticket_unlinked",
        actorUserId,
        correlationId,
        outcome: "SUCCESS",
        targetId: articleId,
        targetType: "kb_article",
        tenantId,
        metadata: { ticketId },
      }),
    });
  }
}
