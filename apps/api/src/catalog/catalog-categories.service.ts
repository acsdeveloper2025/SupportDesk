import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ServiceCategory } from "@prisma/client";

import { buildAuditEventData } from "../audit/audit-event";
import { PrismaService } from "../database/prisma.service";
import {
  CatalogCategoriesRepository,
  type ServiceCategoryWithCount,
} from "./catalog-categories.repository";
import type { CreateServiceCategoryDto, UpdateServiceCategoryDto } from "./dto/category-dtos";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

@Injectable()
export class CatalogCategoriesService {
  constructor(
    @Inject(CatalogCategoriesRepository) private readonly repository: CatalogCategoriesRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async createCategory(
    tenantId: string,
    dto: CreateServiceCategoryDto,
    actorUserId: string,
    correlationId?: string,
  ): Promise<ServiceCategory> {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    if (!slug) {
      throw new BadRequestException("Invalid category name or slug");
    }

    if (await this.repository.slugExists(tenantId, slug)) {
      throw new BadRequestException(`Category with slug '${slug}' already exists`);
    }

    if (dto.parentId) {
      const parent = await this.repository.findById(tenantId, dto.parentId);
      if (!parent) {
        throw new NotFoundException(`Parent category '${dto.parentId}' not found`);
      }
    }

    const category = await this.repository.create(tenantId, dto, slug);

    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: "catalog.category.created",
        actorUserId,
        correlationId,
        outcome: "SUCCESS",
        targetId: category.id,
        targetType: "service_category",
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

  async getCategory(tenantId: string, idOrSlug: string): Promise<ServiceCategoryWithCount> {
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

  async listCategories(
    tenantId: string,
    parentId?: string | null,
  ): Promise<ServiceCategoryWithCount[]> {
    if (parentId === undefined || parentId === null) {
      return this.repository.listRootCategories(tenantId);
    }
    const parent = await this.repository.findById(tenantId, parentId);
    if (!parent) {
      throw new NotFoundException(`Category '${parentId}' not found`);
    }
    return this.repository
      .list(tenantId, { page: 1, pageSize: 100, parentId })
      .then((r) => r.items);
  }

  async updateCategory(
    tenantId: string,
    id: string,
    dto: UpdateServiceCategoryDto,
    actorUserId: string,
    correlationId?: string,
  ): Promise<ServiceCategory> {
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
      if (await this.repository.slugExists(tenantId, newSlug, id)) {
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
      const descendants = await this.repository.listDescendantIds(tenantId, id);
      if (descendants.includes(dto.parentId)) {
        throw new BadRequestException("Category cannot be moved under one of its descendants");
      }
    }

    const updated = await this.repository.update(tenantId, id, dto, newSlug);
    if (!updated) {
      throw new NotFoundException(`Category '${id}' not found`);
    }

    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: "catalog.category.updated",
        actorUserId,
        correlationId,
        outcome: "SUCCESS",
        targetId: updated.id,
        targetType: "service_category",
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
  ): Promise<ServiceCategory> {
    const category = await this.repository.findById(tenantId, id);
    if (!category) {
      throw new NotFoundException(`Category '${id}' not found`);
    }

    if (category.children && category.children.length > 0) {
      throw new BadRequestException("Cannot delete category with subcategories");
    }

    if ((category._count?.serviceItems ?? 0) > 0) {
      throw new BadRequestException("Cannot delete category containing services");
    }

    const deleted = await this.repository.softDelete(tenantId, id);
    if (!deleted) {
      throw new NotFoundException(`Category '${id}' not found`);
    }

    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: "catalog.category.deleted",
        actorUserId,
        correlationId,
        outcome: "SUCCESS",
        targetId: id,
        targetType: "service_category",
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
