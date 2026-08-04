import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ServiceItem, ServiceRequestForm } from "@prisma/client";

import { buildAuditEventData } from "../audit/audit-event";
import { PrismaService } from "../database/prisma.service";
import { KbArticlesRepository } from "../kb/kb-articles.repository";
import { CatalogCategoriesRepository } from "./catalog-categories.repository";
import { slugify } from "./catalog-categories.service";
import {
  CatalogServicesRepository,
  type ServiceItemWithRelations,
} from "./catalog-services.repository";
import {
  type CreateServiceItemDto,
  type UpdateServiceItemDto,
  validateFormSchemaPayload,
} from "./dto/service-dtos";

export interface ServiceSuggestion {
  id: string;
  title: string;
  slug: string;
  summary?: string | null;
  category: { id: string; name: string; slug: string } | null;
  tags: string[];
}

@Injectable()
export class CatalogServicesService {
  constructor(
    @Inject(CatalogServicesRepository) private readonly repository: CatalogServicesRepository,
    @Inject(CatalogCategoriesRepository)
    private readonly categoriesRepository: CatalogCategoriesRepository,
    @Inject(KbArticlesRepository) private readonly kbArticlesRepository: KbArticlesRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  private async assertCategoryExists(tenantId: string, categoryId: string): Promise<void> {
    const category = await this.categoriesRepository.findById(tenantId, categoryId);
    if (!category) {
      throw new BadRequestException(`Category '${categoryId}' not found`);
    }
  }

  private async assertSlaPolicyExists(tenantId: string, slaPolicyId: string): Promise<void> {
    const policy = await this.prisma.slaPolicy.findFirst({
      where: { tenantId, id: slaPolicyId, deletedAt: null },
    });
    if (!policy) {
      throw new BadRequestException(`SLA policy '${slaPolicyId}' not found in this tenant`);
    }
  }

  async createService(
    tenantId: string,
    dto: CreateServiceItemDto,
    actorUserId: string,
    correlationId?: string,
  ): Promise<ServiceItemWithRelations> {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    if (!slug) {
      throw new BadRequestException("Invalid service name or slug");
    }

    if (await this.repository.slugExists(tenantId, slug)) {
      throw new BadRequestException(`Service with slug '${slug}' already exists`);
    }

    await this.assertCategoryExists(tenantId, dto.categoryId);
    if (dto.slaPolicyId) {
      await this.assertSlaPolicyExists(tenantId, dto.slaPolicyId);
    }

    const formSchema = dto.formSchema ?? {
      fields: [{ key: "details", label: "Details", type: "TEXTAREA", required: true }],
    };

    const approvalSteps =
      dto.approvalMode &&
      dto.approvalMode !== "NONE" &&
      (!dto.approvalSteps || dto.approvalSteps.length === 0)
        ? [{ ordinal: 1, approverRole: "TENANT_ADMIN" }]
        : dto.approvalSteps;

    const service = await this.repository.createWithForm(
      tenantId,
      { ...dto, approvalSteps },
      slug,
      formSchema,
    );

    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: "catalog.service.created",
        actorUserId,
        correlationId,
        outcome: "SUCCESS",
        targetId: service.id,
        targetType: "service_item",
        tenantId,
        metadata: {
          name: service.name,
          slug: service.slug,
          kind: service.kind,
          approvalMode: service.approvalMode,
          slaPolicyId: service.slaPolicyId,
        },
      }),
    });

    return service;
  }

  async listServices(
    tenantId: string,
    options: {
      page: number;
      pageSize: number;
      kind?: "BUSINESS" | "TECHNICAL";
      categoryId?: string;
      state?: "DRAFT" | "PUBLISHED" | "RETIRED";
      canReadInternal?: boolean;
    },
  ) {
    if (!options.canReadInternal) {
      return this.repository.list(tenantId, { ...options, state: "PUBLISHED" });
    }
    return this.repository.list(tenantId, options);
  }

  async listPublishedServices(tenantId: string): Promise<ServiceItemWithRelations[]> {
    return this.repository.listPublished(tenantId);
  }

  async getService(
    tenantId: string,
    idOrSlug: string,
    canReadInternal = false,
  ): Promise<ServiceItemWithRelations> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrSlug);
    const service = isUuid
      ? await this.repository.findById(tenantId, idOrSlug)
      : await this.repository.findBySlug(tenantId, idOrSlug);

    if (!service) {
      throw new NotFoundException(`Service '${idOrSlug}' not found`);
    }
    if (!canReadInternal && service.state !== "PUBLISHED") {
      throw new NotFoundException(`Service '${idOrSlug}' not found`);
    }
    return service;
  }

  async updateService(
    tenantId: string,
    id: string,
    dto: UpdateServiceItemDto,
    actorUserId: string,
    correlationId?: string,
  ): Promise<ServiceItem> {
    const existing = await this.repository.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundException(`Service '${id}' not found`);
    }

    let newSlug: string | undefined;
    if (dto.slug !== undefined) {
      newSlug = slugify(dto.slug);
    } else if (dto.name !== undefined && dto.name.trim() !== existing.name) {
      newSlug = slugify(dto.name);
    }

    if (newSlug && newSlug !== existing.slug) {
      if (await this.repository.slugExists(tenantId, newSlug, id)) {
        throw new BadRequestException(`Service with slug '${newSlug}' already exists`);
      }
    }

    if (dto.categoryId !== undefined) {
      await this.assertCategoryExists(tenantId, dto.categoryId);
    }
    if (dto.slaPolicyId) {
      await this.assertSlaPolicyExists(tenantId, dto.slaPolicyId);
    }

    const updated = await this.repository.update(tenantId, id, dto, newSlug);
    if (!updated) {
      throw new NotFoundException(`Service '${id}' not found`);
    }

    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: "catalog.service.updated",
        actorUserId,
        correlationId,
        outcome: "SUCCESS",
        targetId: updated.id,
        targetType: "service_item",
        tenantId,
        metadata: {
          name: updated.name,
          slug: updated.slug,
          kind: updated.kind,
          approvalMode: updated.approvalMode,
          slaPolicyId: updated.slaPolicyId,
        },
      }),
    });

    return updated;
  }

  async publishService(
    tenantId: string,
    id: string,
    actorUserId: string,
    correlationId?: string,
    state: "PUBLISHED" | "RETIRED" = "PUBLISHED",
  ): Promise<ServiceItem> {
    const existing = await this.repository.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundException(`Service '${id}' not found`);
    }
    if (existing.state === state) {
      throw new BadRequestException(
        state === "PUBLISHED" ? "Service is already published" : "Service is already retired",
      );
    }
    if (state === "PUBLISHED" && !existing.form) {
      throw new BadRequestException("Service cannot be published without a request form");
    }

    const updated = await this.repository.publish(tenantId, id, state);
    if (!updated) {
      throw new NotFoundException(`Service '${id}' not found`);
    }

    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: state === "PUBLISHED" ? "catalog.service.published" : "catalog.service.retired",
        actorUserId,
        correlationId,
        outcome: "SUCCESS",
        targetId: updated.id,
        targetType: "service_item",
        tenantId,
        metadata: { name: updated.name, slug: updated.slug, state },
      }),
    });

    return updated;
  }

  async deleteService(
    tenantId: string,
    id: string,
    actorUserId: string,
    correlationId?: string,
  ): Promise<ServiceItem> {
    const service = await this.repository.findById(tenantId, id);
    if (!service) {
      throw new NotFoundException(`Service '${id}' not found`);
    }

    if ((await this.repository.countRequests(tenantId, id)) > 0) {
      throw new BadRequestException("Cannot delete a service with submitted requests");
    }

    const deleted = await this.repository.softDelete(tenantId, id);
    if (!deleted) {
      throw new NotFoundException(`Service '${id}' not found`);
    }

    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: "catalog.service.deleted",
        actorUserId,
        correlationId,
        outcome: "SUCCESS",
        targetId: id,
        targetType: "service_item",
        tenantId,
        metadata: { name: service.name, slug: service.slug },
      }),
    });

    return deleted;
  }

  async getForm(tenantId: string, serviceId: string): Promise<ServiceRequestForm> {
    const form = await this.repository.findForm(tenantId, serviceId);
    if (!form) {
      throw new NotFoundException(`Request form for service '${serviceId}' not found`);
    }
    return form;
  }

  async replaceForm(
    tenantId: string,
    serviceId: string,
    schema: { fields: Array<Record<string, unknown>> },
    actorUserId: string,
    correlationId?: string,
  ): Promise<ServiceRequestForm> {
    const service = await this.repository.findById(tenantId, serviceId);
    if (!service) {
      throw new NotFoundException(`Service '${serviceId}' not found`);
    }
    if (service.state === "RETIRED") {
      throw new BadRequestException("Cannot update the form of a retired service");
    }

    validateFormSchemaPayload(schema);

    const form = await this.repository.replaceForm(tenantId, serviceId, schema);

    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: "catalog.form.updated",
        actorUserId,
        correlationId,
        outcome: "SUCCESS",
        targetId: serviceId,
        targetType: "service_request_form",
        tenantId,
        metadata: {
          serviceName: service.name,
          formVersion: form.formVersion,
          fieldCount: schema.fields.length,
        },
      }),
    });

    return form;
  }

  async suggestions(
    tenantId: string,
    serviceId: string,
    canReadInternal: boolean,
    limit = 5,
  ): Promise<ServiceSuggestion[]> {
    const service = await this.repository.findById(tenantId, serviceId);
    if (!service) {
      throw new NotFoundException(`Service '${serviceId}' not found`);
    }

    const tags = Array.isArray(service.suggestedKbTags)
      ? (service.suggestedKbTags as string[])
      : [];
    const keywords = [service.name].concat(tags).filter(Boolean);

    const articles = await this.kbArticlesRepository.searchForSuggestions(
      tenantId,
      tags,
      keywords,
      canReadInternal,
      limit,
    );

    return articles.map((article) => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      category: article.category ?? null,
      tags: (article.articleTags ?? []).map(({ tag }) => tag.name),
    }));
  }
}
