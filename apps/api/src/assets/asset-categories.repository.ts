import { Inject, Injectable } from "@nestjs/common";
import type { AssetCategory } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { CreateAssetCategoryDto, UpdateAssetCategoryDto } from "./dto/asset-dtos";

export interface ListAssetCategoriesOptions {
  page: number;
  pageSize: number;
}

@Injectable()
export class AssetCategoriesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private slugify(name: string, fallback: string): string {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 200);
    return slug || fallback;
  }

  private async uniqueSlug(tenantId: string, base: string): Promise<string> {
    let candidate = base;
    let index = 2;
    while (
      await this.prisma.assetCategory.findUnique({
        where: { tenantId_slug: { tenantId, slug: candidate } },
      })
    ) {
      candidate = `${base}-${index}`;
      index += 1;
    }
    return candidate;
  }

  async create(tenantId: string, dto: CreateAssetCategoryDto): Promise<AssetCategory> {
    const rawSlug = dto.slug?.trim() || this.slugify(dto.name, "category");
    const slug = await this.uniqueSlug(tenantId, rawSlug);
    return this.prisma.assetCategory.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        slug,
        parentId: dto.parentId || null,
        description: dto.description?.trim() || null,
        icon: dto.icon || null,
        displayOrder: dto.displayOrder ?? 0,
      },
    });
  }

  async findById(tenantId: string, id: string): Promise<AssetCategory | null> {
    return this.prisma.assetCategory.findFirst({
      where: { tenantId, id, deletedAt: null },
    });
  }

  async findBySlug(tenantId: string, slug: string): Promise<AssetCategory | null> {
    return this.prisma.assetCategory.findFirst({
      where: { tenantId, slug, deletedAt: null },
    });
  }

  async list(
    tenantId: string,
    options: ListAssetCategoriesOptions,
  ): Promise<{ items: AssetCategory[]; totalRecords: number }> {
    const where = { tenantId, deletedAt: null };
    const [items, totalRecords] = await this.prisma.$transaction([
      this.prisma.assetCategory.findMany({
        where,
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
      }),
      this.prisma.assetCategory.count({ where }),
    ]);
    return { items, totalRecords };
  }

  async listAllForTenant(tenantId: string): Promise<AssetCategory[]> {
    return this.prisma.assetCategory.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateAssetCategoryDto,
  ): Promise<AssetCategory | null> {
    const [updated] = await this.prisma.assetCategory.updateManyAndReturn({
      where: { tenantId, id, deletedAt: null },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.slug !== undefined ? { slug: dto.slug.trim() } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId || null } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon || null } : {}),
        ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
      },
    });
    return updated ?? null;
  }

  async softDelete(tenantId: string, id: string): Promise<AssetCategory | null> {
    const [deleted] = await this.prisma.assetCategory.updateManyAndReturn({
      where: { tenantId, id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return deleted ?? null;
  }

  async countAssetsUsing(tenantId: string, categoryId: string): Promise<number> {
    return this.prisma.asset.count({ where: { tenantId, categoryId, deletedAt: null } });
  }

  async countChildren(tenantId: string, parentId: string): Promise<number> {
    return this.prisma.assetCategory.count({
      where: { tenantId, parentId, deletedAt: null },
    });
  }
}
