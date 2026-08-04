import { Inject, Injectable } from "@nestjs/common";
import { type Prisma, type ServiceItem, type ServiceRequestForm } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { CreateServiceItemDto, UpdateServiceItemDto } from "./dto/service-dtos";

export type ServiceItemWithRelations = ServiceItem & {
  category?: { id: string; name: string; slug: string } | null;
  form?: ServiceRequestForm | null;
  _count?: { requests: number };
};

export interface ListServicesOptions {
  page: number;
  pageSize: number;
  kind?: "BUSINESS" | "TECHNICAL";
  categoryId?: string;
  state?: "DRAFT" | "PUBLISHED" | "RETIRED";
  includeRetired?: boolean;
}

const SERVICE_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  form: true,
  _count: { select: { requests: true } },
} satisfies Prisma.ServiceItemInclude;

@Injectable()
export class CatalogServicesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createWithForm(
    tenantId: string,
    dto: CreateServiceItemDto,
    slug: string,
    formSchema: { fields: Array<Record<string, unknown>> },
  ): Promise<ServiceItemWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const service = await tx.serviceItem.create({
        data: {
          tenantId,
          categoryId: dto.categoryId,
          name: dto.name.trim(),
          slug,
          description: dto.description?.trim() || null,
          kind: dto.kind ?? "BUSINESS",
          approvalMode: dto.approvalMode ?? "NONE",
          approvalSteps:
            (dto.approvalSteps as unknown as Prisma.InputJsonValue[]) ??
            ([] as Prisma.InputJsonValue[]),
          slaPolicyId: dto.slaPolicyId || null,
          defaultTicketType: dto.defaultTicketType ?? "FEATURE_REQUEST",
          defaultPriority: dto.defaultPriority ?? "MEDIUM",
          suggestedKbTags: dto.suggestedKbTags ?? [],
          generateTicketOnFulfillment: dto.generateTicketOnFulfillment ?? true,
        },
      });
      const form = await tx.serviceRequestForm.create({
        data: {
          tenantId,
          serviceId: service.id,
          formVersion: 1,
          schema: formSchema as Prisma.InputJsonValue,
        },
      });
      return { ...service, category: null, form, _count: { requests: 0 } };
    });
  }

  async findById(tenantId: string, id: string): Promise<ServiceItemWithRelations | null> {
    return this.prisma.serviceItem.findFirst({
      where: { tenantId, id, deletedAt: null },
      include: SERVICE_INCLUDE,
    });
  }

  async findBySlug(tenantId: string, slug: string): Promise<ServiceItemWithRelations | null> {
    return this.prisma.serviceItem.findFirst({
      where: { tenantId, slug, deletedAt: null },
      include: SERVICE_INCLUDE,
    });
  }

  async list(tenantId: string, options: ListServicesOptions) {
    const where: Prisma.ServiceItemWhereInput = {
      tenantId,
      deletedAt: null,
      ...(options.kind ? { kind: options.kind } : {}),
      ...(options.categoryId ? { categoryId: options.categoryId } : {}),
      ...(options.state
        ? { state: options.state }
        : options.includeRetired
          ? {}
          : { state: { not: "RETIRED" } }),
    };
    const [items, totalRecords] = await this.prisma.$transaction([
      this.prisma.serviceItem.findMany({
        where,
        include: SERVICE_INCLUDE,
        orderBy: [{ name: "asc" }],
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
      }),
      this.prisma.serviceItem.count({ where }),
    ]);
    return { items, totalRecords };
  }

  async listPublished(tenantId: string): Promise<ServiceItemWithRelations[]> {
    return this.prisma.serviceItem.findMany({
      where: { tenantId, state: "PUBLISHED", deletedAt: null },
      include: SERVICE_INCLUDE,
      orderBy: [{ name: "asc" }],
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateServiceItemDto,
    slug?: string,
  ): Promise<ServiceItem | null> {
    const [updated] = await this.prisma.serviceItem.updateManyAndReturn({
      where: { tenantId, id, deletedAt: null },
      data: {
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.approvalMode !== undefined ? { approvalMode: dto.approvalMode } : {}),
        ...(dto.approvalSteps !== undefined
          ? { approvalSteps: dto.approvalSteps as unknown as Prisma.InputJsonValue[] }
          : {}),
        ...(dto.slaPolicyId !== undefined ? { slaPolicyId: dto.slaPolicyId || null } : {}),
        ...(dto.defaultTicketType !== undefined
          ? { defaultTicketType: dto.defaultTicketType }
          : {}),
        ...(dto.defaultPriority !== undefined ? { defaultPriority: dto.defaultPriority } : {}),
        ...(dto.suggestedKbTags !== undefined ? { suggestedKbTags: dto.suggestedKbTags } : {}),
        ...(dto.generateTicketOnFulfillment !== undefined
          ? { generateTicketOnFulfillment: dto.generateTicketOnFulfillment }
          : {}),
      },
    });
    return updated ?? null;
  }

  async publish(
    tenantId: string,
    id: string,
    state: "PUBLISHED" | "RETIRED",
  ): Promise<ServiceItem | null> {
    const [updated] = await this.prisma.serviceItem.updateManyAndReturn({
      where: { tenantId, id, deletedAt: null },
      data: {
        state,
        ...(state === "PUBLISHED" ? { publishedAt: new Date() } : { publishedAt: null }),
      },
    });
    return updated ?? null;
  }

  async softDelete(tenantId: string, id: string): Promise<ServiceItem | null> {
    const [deleted] = await this.prisma.serviceItem.updateManyAndReturn({
      where: { tenantId, id, deletedAt: null },
      data: { deletedAt: new Date(), state: "RETIRED" },
    });
    return deleted ?? null;
  }

  async findForm(tenantId: string, serviceId: string): Promise<ServiceRequestForm | null> {
    return this.prisma.serviceRequestForm.findFirst({
      where: { tenantId, serviceId },
    });
  }

  async replaceForm(
    tenantId: string,
    serviceId: string,
    schema: { fields: Array<Record<string, unknown>> },
  ): Promise<ServiceRequestForm> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.serviceRequestForm.findFirst({
        where: { tenantId, serviceId },
      });
      if (!existing) {
        return tx.serviceRequestForm.create({
          data: { tenantId, serviceId, formVersion: 1, schema: schema as Prisma.InputJsonValue },
        });
      }
      return tx.serviceRequestForm.update({
        where: { id: existing.id },
        data: {
          formVersion: existing.formVersion + 1,
          schema: schema as Prisma.InputJsonValue,
        },
      });
    });
  }

  async slugExists(tenantId: string, slug: string, excludeId?: string): Promise<boolean> {
    const count = await this.prisma.serviceItem.count({
      where: { tenantId, slug, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    return count > 0;
  }

  async countRequests(tenantId: string, serviceId: string): Promise<number> {
    return this.prisma.serviceRequest.count({ where: { tenantId, serviceId } });
  }
}
