import { Inject, Injectable } from "@nestjs/common";
import type { AssetType } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { CreateAssetTypeDto, UpdateAssetTypeDto } from "./dto/asset-dtos";

export type AssetTypeWithKbLinks = AssetType & {
  kbLinks?: Array<{ articleId: string }>;
};

export interface ListAssetTypesOptions {
  page: number;
  pageSize: number;
  includeSystem: boolean;
  customOnly: boolean;
}

@Injectable()
export class AssetTypesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateAssetTypeDto): Promise<AssetType> {
    return this.prisma.assetType.create({
      data: {
        tenantId,
        key: dto.key.trim(),
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        customFieldsSchema: (dto.customFieldsSchema ?? []) as never,
        isSystem: false,
      },
    });
  }

  async findById(tenantId: string, id: string): Promise<AssetType | null> {
    return this.prisma.assetType.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [{ tenantId }, { tenantId: null }],
      },
    });
  }

  async findByKey(tenantId: string, key: string): Promise<AssetType | null> {
    return this.prisma.assetType.findFirst({
      where: {
        key,
        deletedAt: null,
        OR: [{ tenantId }, { tenantId: null }],
      },
    });
  }

  async list(
    tenantId: string,
    options: ListAssetTypesOptions,
  ): Promise<{ items: AssetType[]; totalRecords: number }> {
    const where = {
      deletedAt: null,
      OR: [{ tenantId }, { tenantId: null }],
      ...(options.customOnly ? { tenantId, isSystem: false } : {}),
      ...(options.includeSystem ? {} : { tenantId }),
    };

    const [items, totalRecords] = await this.prisma.$transaction([
      this.prisma.assetType.findMany({
        where,
        orderBy: [{ isSystem: "desc" }, { name: "asc" }],
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
      }),
      this.prisma.assetType.count({ where }),
    ]);
    return { items, totalRecords };
  }

  async listAllForTenant(tenantId: string): Promise<AssetType[]> {
    return this.prisma.assetType.findMany({
      where: {
        deletedAt: null,
        OR: [{ tenantId }, { tenantId: null }],
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
  }

  async update(tenantId: string, id: string, dto: UpdateAssetTypeDto): Promise<AssetType | null> {
    const [updated] = await this.prisma.assetType.updateManyAndReturn({
      where: { tenantId, id, isSystem: false, deletedAt: null },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.customFieldsSchema !== undefined
          ? { customFieldsSchema: dto.customFieldsSchema as never }
          : {}),
      },
    });
    return updated ?? null;
  }

  async softDelete(tenantId: string, id: string): Promise<AssetType | null> {
    const [deleted] = await this.prisma.assetType.updateManyAndReturn({
      where: { tenantId, id, isSystem: false, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return deleted ?? null;
  }

  async countAssetsUsing(tenantId: string, assetTypeId: string): Promise<number> {
    return this.prisma.asset.count({
      where: { tenantId, assetTypeId, deletedAt: null },
    });
  }
}
