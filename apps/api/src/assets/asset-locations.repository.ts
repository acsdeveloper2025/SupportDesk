import { Inject, Injectable } from "@nestjs/common";
import type { AssetLocation } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { CreateAssetLocationDto, UpdateAssetLocationDto } from "./dto/asset-dtos";

export interface ListAssetLocationsOptions {
  page: number;
  pageSize: number;
}

@Injectable()
export class AssetLocationsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateAssetLocationDto): Promise<AssetLocation> {
    return this.prisma.assetLocation.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        address: dto.address?.trim() || null,
      },
    });
  }

  async findById(tenantId: string, id: string): Promise<AssetLocation | null> {
    return this.prisma.assetLocation.findFirst({ where: { tenantId, id } });
  }

  async list(
    tenantId: string,
    options: ListAssetLocationsOptions,
  ): Promise<{ items: AssetLocation[]; totalRecords: number }> {
    const where = { tenantId };
    const [items, totalRecords] = await this.prisma.$transaction([
      this.prisma.assetLocation.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
      }),
      this.prisma.assetLocation.count({ where }),
    ]);
    return { items, totalRecords };
  }

  async listAllForTenant(tenantId: string): Promise<AssetLocation[]> {
    return this.prisma.assetLocation.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateAssetLocationDto,
  ): Promise<AssetLocation | null> {
    const [updated] = await this.prisma.assetLocation.updateManyAndReturn({
      where: { tenantId, id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
      },
    });
    return updated ?? null;
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    const result = await this.prisma.assetLocation.deleteMany({ where: { tenantId, id } });
    return result.count > 0;
  }

  async countAssetsAt(tenantId: string, locationId: string): Promise<number> {
    return this.prisma.asset.count({ where: { tenantId, locationId, deletedAt: null } });
  }
}
