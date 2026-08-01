import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { KbCategory } from "@prisma/client";

import { buildAuditEventData } from "../audit/audit-event";
import { PrismaService } from "../database/prisma.service";
import type { CreateKbCategoryDto, UpdateKbCategoryDto } from "./dto/category-dtos";
import { KbCategoriesRepository, type KbCategoryWithChildren } from "./kb-categories.repository";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

@Injectable()
export class KbCategoriesService {
  constructor(
    @Inject(KbCategoriesRepository) private readonly repository: KbCategoriesRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async createCategory(
    tenantId: string,
    dto: CreateKbCategoryDto,
    actorUserId: string,
    correlationId?: string,
  ): Promise<KbCategory> {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    if (!slug) {
      throw new BadRequestException("Invalid category name or slug");
    }

    const existing = await this.repository.findBySlug(tenantId, slug);
    if (existing) {
      throw new BadRequestException(`Category with slug '${slug}' already exists`);
    }

    if (dto.parentId) {
      const parent = await this.repository.findById(tenantId, dto.parentId);
      if (!parent) {
        throw new NotFoundException(`Parent category '${dto.parentId}' not found`);
      }
    }

    const category = await this.repository.create(tenantId, dto, slug);

    // Record audit event
    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: "kb.category.created",
        actorUserId,
        correlationId,
        outcome: "SUCCESS",
        targetId: category.id,
        targetType: "kb_category",
        tenantId,
        metadata: {
          name: category.name,
          slug: category.slug,
          parentId: category.parentId,
        },
      }),
    });

    return category;
  }

  async getCategory(tenantId: string, idOrSlug: string): Promise<KbCategoryWithChildren> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrSlug);
    const category = isUuid
      ? await this.repository.findById(tenantId, idOrSlug)
      : await this.repository.findBySlug(tenantId, idOrSlug);

    if (!category) {
      throw new NotFoundException(`Category '${idOrSlug}' not found`);
    }

    return category;
  }

  async listCategories(tenantId: string): Promise<KbCategoryWithChildren[]> {
    return this.repository.listRootCategories(tenantId);
  }

  async updateCategory(
    tenantId: string,
    id: string,
    dto: UpdateKbCategoryDto,
    actorUserId: string,
    correlationId?: string,
  ): Promise<KbCategory> {
    const existing = await this.repository.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundException(`Category '${id}' not found`);
    }

    let newSlug: string | undefined;
    if (dto.slug !== undefined) {
      newSlug = slugify(dto.slug);
    } else if (dto.name !== undefined && dto.name.trim() !== existing.name) {
      newSlug = slugify(dto.name);
    }

    if (newSlug && newSlug !== existing.slug) {
      const slugConflict = await this.repository.findBySlug(tenantId, newSlug);
      if (slugConflict && slugConflict.id !== id) {
        throw new BadRequestException(`Category with slug '${newSlug}' already exists`);
      }
    }

    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) {
        throw new BadRequestException("Category cannot be its own parent");
      }
      const parent = await this.repository.findById(tenantId, dto.parentId);
      if (!parent) {
        throw new NotFoundException(`Parent category '${dto.parentId}' not found`);
      }
    }

    const updated = await this.repository.update(tenantId, id, dto, newSlug);

    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: "kb.category.updated",
        actorUserId,
        correlationId,
        outcome: "SUCCESS",
        targetId: updated.id,
        targetType: "kb_category",
        tenantId,
        metadata: {
          name: updated.name,
          slug: updated.slug,
          parentId: updated.parentId,
        },
      }),
    });

    return updated;
  }

  async deleteCategory(
    tenantId: string,
    id: string,
    actorUserId: string,
    correlationId?: string,
  ): Promise<KbCategory> {
    const category = await this.repository.findById(tenantId, id);
    if (!category) {
      throw new NotFoundException(`Category '${id}' not found`);
    }

    if (category.children && category.children.length > 0) {
      throw new BadRequestException("Cannot delete category with subcategories");
    }

    if (category._count && category._count.articles > 0) {
      throw new BadRequestException("Cannot delete category containing articles");
    }

    const deleted = await this.repository.delete(tenantId, id);

    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: "kb.category.deleted",
        actorUserId,
        correlationId,
        outcome: "SUCCESS",
        targetId: id,
        targetType: "kb_category",
        tenantId,
        metadata: {
          name: category.name,
          slug: category.slug,
        },
      }),
    });

    return deleted;
  }
}
