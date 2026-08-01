import { Inject, Injectable } from "@nestjs/common";
import {
  type KbArticle,
  KbArticleStatus,
  type KbArticleVersion,
  KbArticleVisibility,
  type KbTicketLink,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type {
  CreateKbArticleDto,
  ListKbArticlesQueryDto,
  UpdateKbArticleDto,
} from "./dto/article-dtos";
import { buildKbArticleSearchOrClause } from "./kb-search.builder";

export type KbArticleWithRelations = KbArticle & {
  category?: { id: string; name: string; slug: string };
  author?: { id: string; email: string; profile?: { displayName: string | null } | null };
  articleTags?: { tag: { id: string; name: string; slug: string } }[];
  _count?: { versions: number; ticketLinks: number };
};

@Injectable()
export class KbArticlesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    authorId: string,
    dto: CreateKbArticleDto,
    slug: string,
  ): Promise<KbArticleWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const article = await tx.kbArticle.create({
        data: {
          tenantId,
          categoryId: dto.categoryId,
          authorId,
          title: dto.title.trim(),
          slug,
          summary: dto.summary?.trim() || null,
          content: dto.content,
          visibility: dto.visibility ?? KbArticleVisibility.PUBLIC,
          status: KbArticleStatus.DRAFT,
          pinned: dto.pinned ?? false,
          versionNumber: 1,
        },
      });

      if (dto.tags && dto.tags.length > 0) {
        for (const rawTag of dto.tags) {
          const tagName = rawTag.trim();
          if (!tagName) continue;
          const tagSlug = tagName.toLowerCase().replace(/[^\w-]/g, "");

          const tag = await tx.kbTag.upsert({
            where: { tenantId_slug: { tenantId, slug: tagSlug } },
            create: { tenantId, name: tagName, slug: tagSlug },
            update: {},
          });

          await tx.kbArticleTag.create({
            data: { articleId: article.id, tagId: tag.id },
          });
        }
      }

      return tx.kbArticle.findUniqueOrThrow({
        where: { id: article.id },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          author: {
            select: {
              id: true,
              email: true,
              profile: { select: { displayName: true } },
            },
          },
          articleTags: { include: { tag: true } },
          _count: { select: { versions: true, ticketLinks: true } },
        },
      });
    });
  }

  async findById(tenantId: string, id: string): Promise<KbArticleWithRelations | null> {
    return this.prisma.kbArticle.findFirst({
      where: { tenantId, id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        author: {
          select: {
            id: true,
            email: true,
            profile: { select: { displayName: true } },
          },
        },
        articleTags: { include: { tag: true } },
        _count: { select: { versions: true, ticketLinks: true } },
      },
    });
  }

  async findBySlug(tenantId: string, slug: string): Promise<KbArticleWithRelations | null> {
    return this.prisma.kbArticle.findFirst({
      where: { tenantId, slug },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        author: {
          select: {
            id: true,
            email: true,
            profile: { select: { displayName: true } },
          },
        },
        articleTags: { include: { tag: true } },
        _count: { select: { versions: true, ticketLinks: true } },
      },
    });
  }

  async list(
    tenantId: string,
    query: ListKbArticlesQueryDto,
    canReadInternal: boolean,
  ): Promise<{ items: KbArticleWithRelations[]; total: number }> {
    const where: Prisma.KbArticleWhereInput = { tenantId };

    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.status) where.status = query.status;
    if (query.authorId) where.authorId = query.authorId;

    if (!canReadInternal) {
      where.visibility = KbArticleVisibility.PUBLIC;
    } else if (query.visibility) {
      where.visibility = query.visibility;
    }

    if (query.tag) {
      where.articleTags = {
        some: { tag: { slug: query.tag.toLowerCase() } },
      };
    }

    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const [items, total] = await Promise.all([
      this.prisma.kbArticle.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        include: {
          category: { select: { id: true, name: true, slug: true } },
          author: {
            select: {
              id: true,
              email: true,
              profile: { select: { displayName: true } },
            },
          },
          articleTags: { include: { tag: true } },
          _count: { select: { versions: true, ticketLinks: true } },
        },
      }),
      this.prisma.kbArticle.count({ where }),
    ]);

    return { items, total };
  }

  async search(
    tenantId: string,
    q: string,
    categoryId?: string,
    canReadInternal = false,
    limit = 20,
    offset = 0,
  ): Promise<{ items: KbArticleWithRelations[]; total: number }> {
    const orClause = buildKbArticleSearchOrClause(q);
    const where: Prisma.KbArticleWhereInput = {
      tenantId,
      status: KbArticleStatus.PUBLISHED,
      OR: orClause.length > 0 ? orClause : undefined,
    };

    if (categoryId) where.categoryId = categoryId;
    if (!canReadInternal) where.visibility = KbArticleVisibility.PUBLIC;

    const [items, total] = await Promise.all([
      this.prisma.kbArticle.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { viewsCount: "desc" },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          author: {
            select: {
              id: true,
              email: true,
              profile: { select: { displayName: true } },
            },
          },
          articleTags: { include: { tag: true } },
          _count: { select: { versions: true, ticketLinks: true } },
        },
      }),
      this.prisma.kbArticle.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Suggestion search for the Service Catalog: published articles matched by tag
   * name or title keywords, tenant-scoped with visibility guards.
   */
  async searchForSuggestions(
    tenantId: string,
    tags: string[],
    keywords: string[],
    canReadInternal: boolean,
    limit = 5,
  ): Promise<KbArticleWithRelations[]> {
    const where: Prisma.KbArticleWhereInput = {
      tenantId,
      status: KbArticleStatus.PUBLISHED,
      ...(canReadInternal ? {} : { visibility: KbArticleVisibility.PUBLIC }),
    };

    const OR: Prisma.KbArticleWhereInput[] = [];
    const normalizedTags = tags
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0);
    const normalizedKeywords = keywords
      .map((word) => word.trim())
      .filter((word) => word.length > 0);

    if (normalizedTags.length > 0) {
      OR.push({
        articleTags: {
          some: { tag: { name: { in: normalizedTags, mode: "insensitive" } } },
        },
      });
    }
    if (normalizedKeywords.length > 0) {
      OR.push({
        OR: normalizedKeywords.map((keyword) => ({
          OR: [
            { title: { contains: keyword, mode: "insensitive" } },
            { summary: { contains: keyword, mode: "insensitive" } },
            { content: { contains: keyword, mode: "insensitive" } },
          ],
        })),
      });
    }
    if (OR.length > 0) {
      where.OR = OR;
    }

    return this.prisma.kbArticle.findMany({
      where,
      take: limit,
      orderBy: [{ viewsCount: "desc" }, { publishedAt: "desc" }],
      include: {
        category: { select: { id: true, name: true, slug: true } },
        articleTags: { include: { tag: true } },
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateKbArticleDto,
    newSlug?: string,
  ): Promise<KbArticleWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.KbArticleUpdateInput = {};

      if (dto.categoryId !== undefined) data.category = { connect: { id: dto.categoryId } };
      if (dto.title !== undefined) data.title = dto.title.trim();
      if (newSlug !== undefined) data.slug = newSlug;
      if (dto.summary !== undefined) data.summary = dto.summary?.trim() || null;
      if (dto.content !== undefined) data.content = dto.content;
      if (dto.visibility !== undefined) data.visibility = dto.visibility;
      if (dto.pinned !== undefined) data.pinned = dto.pinned;

      await tx.kbArticle.update({ where: { id }, data });

      if (dto.tags !== undefined) {
        await tx.kbArticleTag.deleteMany({ where: { articleId: id } });
        for (const rawTag of dto.tags) {
          const tagName = rawTag.trim();
          if (!tagName) continue;
          const tagSlug = tagName.toLowerCase().replace(/[^\w-]/g, "");

          const tag = await tx.kbTag.upsert({
            where: { tenantId_slug: { tenantId, slug: tagSlug } },
            create: { tenantId, name: tagName, slug: tagSlug },
            update: {},
          });

          await tx.kbArticleTag.create({
            data: { articleId: id, tagId: tag.id },
          });
        }
      }

      return tx.kbArticle.findUniqueOrThrow({
        where: { id },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          author: {
            select: {
              id: true,
              email: true,
              profile: { select: { displayName: true } },
            },
          },
          articleTags: { include: { tag: true } },
          _count: { select: { versions: true, ticketLinks: true } },
        },
      });
    });
  }

  async publish(
    tenantId: string,
    id: string,
    publisherUserId: string,
  ): Promise<KbArticleWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const article = await tx.kbArticle.findUniqueOrThrow({ where: { id } });

      const newVersionNumber =
        article.status === KbArticleStatus.PUBLISHED
          ? article.versionNumber + 1
          : article.versionNumber;

      // Save version snapshot
      await tx.kbArticleVersion.create({
        data: {
          tenantId,
          articleId: id,
          versionNumber: newVersionNumber,
          title: article.title,
          summary: article.summary,
          content: article.content,
          createdById: publisherUserId,
        },
      });

      const updated = await tx.kbArticle.update({
        where: { id },
        data: {
          status: KbArticleStatus.PUBLISHED,
          versionNumber: newVersionNumber,
          publishedAt: article.publishedAt ?? new Date(),
        },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          author: {
            select: {
              id: true,
              email: true,
              profile: { select: { displayName: true } },
            },
          },
          articleTags: { include: { tag: true } },
          _count: { select: { versions: true, ticketLinks: true } },
        },
      });

      return updated;
    });
  }

  async archive(tenantId: string, id: string): Promise<KbArticleWithRelations> {
    return this.prisma.kbArticle.update({
      where: { id },
      data: { status: KbArticleStatus.ARCHIVED },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        author: {
          select: {
            id: true,
            email: true,
            profile: { select: { displayName: true } },
          },
        },
        articleTags: { include: { tag: true } },
        _count: { select: { versions: true, ticketLinks: true } },
      },
    });
  }

  async delete(tenantId: string, id: string): Promise<KbArticle> {
    return this.prisma.kbArticle.delete({ where: { id } });
  }

  async incrementViews(id: string): Promise<void> {
    await this.prisma.kbArticle.update({
      where: { id },
      data: { viewsCount: { increment: 1 } },
    });
  }

  async recordFeedback(id: string, helpful: boolean): Promise<void> {
    await this.prisma.kbArticle.update({
      where: { id },
      data: helpful ? { helpfulCount: { increment: 1 } } : { unhelpfulCount: { increment: 1 } },
    });
  }

  async getVersions(tenantId: string, articleId: string): Promise<KbArticleVersion[]> {
    return this.prisma.kbArticleVersion.findMany({
      where: { tenantId, articleId },
      orderBy: { versionNumber: "desc" },
    });
  }

  async getVersion(
    tenantId: string,
    articleId: string,
    versionNumber: number,
  ): Promise<KbArticleVersion | null> {
    return this.prisma.kbArticleVersion.findFirst({
      where: { tenantId, articleId, versionNumber },
    });
  }

  async linkTicket(
    tenantId: string,
    articleId: string,
    ticketId: string,
    userId: string,
  ): Promise<KbTicketLink> {
    return this.prisma.kbTicketLink.create({
      data: {
        tenantId,
        articleId,
        ticketId,
        createdById: userId,
      },
    });
  }

  async unlinkTicket(tenantId: string, articleId: string, ticketId: string): Promise<void> {
    await this.prisma.kbTicketLink.deleteMany({
      where: { tenantId, articleId, ticketId },
    });
  }
}
