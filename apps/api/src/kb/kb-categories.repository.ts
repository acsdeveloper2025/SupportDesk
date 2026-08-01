import { Inject, Injectable } from "@nestjs/common";
import { type KbCategory, Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { CreateKbCategoryDto, UpdateKbCategoryDto } from "./dto/category-dtos";

export type KbCategoryWithChildren = KbCategory & {
  children?: KbCategoryWithChildren[];
  _count?: { articles: number };
};

@Injectable()
export class KbCategoriesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateKbCategoryDto, slug: string): Promise<KbCategory> {
    return this.prisma.kbCategory.create({
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

  async findById(tenantId: string, id: string): Promise<KbCategoryWithChildren | null> {
    return this.prisma.kbCategory.findFirst({
      where: { tenantId, id },
      include: {
        children: {
          orderBy: { displayOrder: "asc" },
        },
        _count: {
          select: { articles: true },
        },
      },
    });
  }

  async findBySlug(tenantId: string, slug: string): Promise<KbCategoryWithChildren | null> {
    return this.prisma.kbCategory.findFirst({
      where: { tenantId, slug },
      include: {
        children: {
          orderBy: { displayOrder: "asc" },
        },
        _count: {
          select: { articles: true },
        },
      },
    });
  }

  async listRootCategories(tenantId: string): Promise<KbCategoryWithChildren[]> {
    return this.prisma.kbCategory.findMany({
      where: { tenantId, parentId: null },
      orderBy: { displayOrder: "asc" },
      include: {
        children: {
          orderBy: { displayOrder: "asc" },
          include: {
            _count: { select: { articles: true } },
          },
        },
        _count: { select: { articles: true } },
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateKbCategoryDto,
    newSlug?: string,
  ): Promise<KbCategory> {
    const data: Prisma.KbCategoryUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name.trim();
    if (newSlug !== undefined) data.slug = newSlug;
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.icon !== undefined) data.icon = dto.icon?.trim() || null;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;
    if (dto.parentId !== undefined) {
      data.parent = dto.parentId ? { connect: { id: dto.parentId } } : { disconnect: true };
    }

    return this.prisma.kbCategory.update({
      where: { id },
      data,
    });
  }

  async delete(tenantId: string, id: string): Promise<KbCategory> {
    return this.prisma.kbCategory.delete({
      where: { id },
    });
  }
}
