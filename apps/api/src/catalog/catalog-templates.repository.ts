import { Inject, Injectable } from "@nestjs/common";
import { Prisma, type RequestTemplate } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { CreateRequestTemplateDto, UpdateRequestTemplateDto } from "./dto/template-dtos";

export interface ListTemplatesOptions {
  page: number;
  pageSize: number;
  serviceId?: string | null;
  includeDeleted?: boolean;
}

@Injectable()
export class CatalogTemplatesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    dto: CreateRequestTemplateDto,
    createdById: string,
  ): Promise<RequestTemplate> {
    if (dto.isDefault) {
      await this.clearDefaults(tenantId, dto.serviceId ?? null);
    }
    return this.prisma.requestTemplate.create({
      data: {
        tenantId,
        serviceId: dto.serviceId || null,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        fieldValues: dto.fieldValues as Prisma.InputJsonValue,
        isDefault: dto.isDefault ?? false,
        createdById,
      },
    });
  }

  async findById(tenantId: string, id: string): Promise<RequestTemplate | null> {
    return this.prisma.requestTemplate.findFirst({
      where: { tenantId, id, deletedAt: null },
    });
  }

  async findDefaultForService(
    tenantId: string,
    serviceId: string | null,
  ): Promise<RequestTemplate | null> {
    return this.prisma.requestTemplate.findFirst({
      where: { tenantId, deletedAt: null, isDefault: true, serviceId: serviceId ?? null },
      orderBy: { updatedAt: "desc" },
    });
  }

  async list(tenantId: string, options: ListTemplatesOptions) {
    const where: Prisma.RequestTemplateWhereInput = {
      tenantId,
      ...(options.includeDeleted ? {} : { deletedAt: null }),
      ...(options.serviceId === undefined ? {} : { serviceId: options.serviceId ?? null }),
    };
    const [items, totalRecords] = await this.prisma.$transaction([
      this.prisma.requestTemplate.findMany({
        where,
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
      }),
      this.prisma.requestTemplate.count({ where }),
    ]);
    return { items, totalRecords };
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateRequestTemplateDto,
  ): Promise<RequestTemplate | null> {
    const existing = await this.findById(tenantId, id);
    if (!existing) {
      return null;
    }
    if (dto.isDefault) {
      await this.clearDefaults(
        tenantId,
        dto.serviceId !== undefined ? dto.serviceId : existing.serviceId,
      );
    }
    const [updated] = await this.prisma.requestTemplate.updateManyAndReturn({
      where: { tenantId, id, deletedAt: null },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.serviceId !== undefined ? { serviceId: dto.serviceId || null } : {}),
        ...(dto.fieldValues !== undefined
          ? { fieldValues: dto.fieldValues as Prisma.InputJsonValue }
          : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      },
    });
    return updated ?? null;
  }

  async softDelete(tenantId: string, id: string): Promise<RequestTemplate | null> {
    const [deleted] = await this.prisma.requestTemplate.updateManyAndReturn({
      where: { tenantId, id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return deleted ?? null;
  }

  private async clearDefaults(tenantId: string, serviceId: string | null): Promise<void> {
    await this.prisma.requestTemplate.updateMany({
      where: { tenantId, deletedAt: null, isDefault: true, serviceId },
      data: { isDefault: false },
    });
  }
}
