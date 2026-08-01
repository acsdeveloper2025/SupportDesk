import { Inject, Injectable } from "@nestjs/common";
import { Prisma, type ServiceCategory } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { CreateServiceCategoryDto, UpdateServiceCategoryDto } from "./dto/category-dtos";

export type ServiceCategoryWithCount = ServiceCategory & {
  children?: ServiceCategoryWithCount[];
  _count?: { children: number; serviceItems: number };
};

export interface ListCategoriesOptions {
  page: number;
  pageSize: number;
  parentId?: string | null;
}

@Injectable()
export class CatalogCategoriesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    dto: CreateServiceCategoryDto,
    slug: string,
  ): Promise<ServiceCategory> {
    return this.prisma.serviceCategory.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim() || null,
        icon: dto.icon?.trim() || null,
        displayOrder: dto.displayOrder ?? 0,
        parentId: dto.parentId || null,
      },
    });
  }

  async findById(tenantId: string, id: string): Promise<ServiceCategoryWithCount | null> {
    return this.prisma.serviceCategory.findFirst({
      where: { tenantId, id, deletedAt: null },
      include: {
        children: {
          where: { deletedAt: null },
          orderBy: { displayOrder: "asc" },
        },
        _count: {
          select: { children: true, serviceItems: true },
        },
      },
    });
  }

  async findBySlug(tenantId: string, slug: string): Promise<ServiceCategory | null> {
    return this.prisma.serviceCategory.findFirst({
      where: { tenantId, slug, deletedAt: null },
    });
  }

  async listRootCategories(tenantId: string): Promise<ServiceCategoryWithCount[]> {
    return this.prisma.serviceCategory.findMany({
      where: { tenantId, parentId: null, deletedAt: null },
      include: {
        children: {
          where: { deletedAt: null },
          orderBy: { displayOrder: "asc" },
        },
        _count: {
          select: { children: true, serviceItems: true },
        },
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
  }

  async list(tenantId: string, options: ListCategoriesOptions) {
    const where: Prisma.ServiceCategoryWhereInput = {
      tenantId,
      deletedAt: null,
      parentId: options.parentId ?? null,
    };
    const [items, totalRecords] = await this.prisma.$transaction([
      this.prisma.serviceCategory.findMany({
        where,
        include: {
          children: {
            where: { deletedAt: null },
            orderBy: { displayOrder: "asc" },
          },
          _count: {
            select: { children: true, serviceItems: true },
          },
        },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
      }),
      this.prisma.serviceCategory.count({ where }),
    ]);
    return { items, totalRecords };
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateServiceCategoryDto,
    slug?: string,
  ): Promise<ServiceCategory | null> {
    const [updated] = await this.prisma.serviceCategory.updateManyAndReturn({
      where: { tenantId, id, deletedAt: null },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon?.trim() || null } : {}),
        ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId || null } : {}),
      },
    });
    return updated ?? null;
  }

  async softDelete(tenantId: string, id: string): Promise<ServiceCategory | null> {
    const [deleted] = await this.prisma.serviceCategory.updateManyAndReturn({
      where: { tenantId, id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return deleted ?? null;
  }

  async countServiceItems(tenantId: string, categoryId: string): Promise<number> {
    return this.prisma.serviceItem.count({
      where: { tenantId, categoryId, deletedAt: null },
    });
  }

  /** All descendant IDs under a category (breadth-first, used for cycle prevention). */
  async listDescendantIds(tenantId: string, parentId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        WITH RECURSIVE tree AS (
          SELECT "id" FROM "service_categories" WHERE "id" = ${parentId}::uuid AND "tenant_id" = ${tenantId}::uuid
          UNION ALL
          SELECT c."id" FROM "service_categories" c
          JOIN tree t ON c."parent_id" = t."id"
          WHERE c."tenant_id" = ${tenantId}::uuid AND c."deleted_at" IS NULL
        )
        SELECT "id" FROM tree
      `,
    );
    return rows.map((row) => row.id);
  }

  /** True when a category with the same tenant+slug exists (excluding the given id). */
  async slugExists(tenantId: string, slug: string, excludeId?: string): Promise<boolean> {
    const count = await this.prisma.serviceCategory.count({
      where: { tenantId, slug, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    return count > 0;
  }
}
