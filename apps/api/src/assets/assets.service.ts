import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { buildAuditEventData } from "../audit/audit-event";
import { PrismaService } from "../database/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import { AssetCategoriesRepository } from "./asset-categories.repository";
import { AssetLocationsRepository } from "./asset-locations.repository";
import { AssetTypesRepository } from "./asset-types.repository";
import { AssetsRepository } from "./assets.repository";
import { isAllowedAssetTransition } from "./domain/asset-lifecycle";
import {
  ASSET_LIFECYCLE_STATE_VALUES,
  type AssignAssetDto,
  type CreateAssetCategoryDto,
  type CreateAssetDto,
  type CreateAssetLocationDto,
  type CreateAssetRelationshipDto,
  type CreateAssetTypeDto,
  type CreateTicketFromAssetDto,
  type ListAssetCategoriesQuery,
  type ListAssetLocationsQuery,
  type ListAssetsQuery,
  type ListAssetTypesQuery,
  type TransitionAssetDto,
  type UpdateAssetCategoryDto,
  type UpdateAssetDto,
  type UpdateAssetLocationDto,
  type UpdateAssetTypeDto,
} from "./dto/asset-dtos";

export interface RequestContext {
  tenantId: string;
  userId: string;
}

const ASSET_RELATIONSHIP_PERMISSION: Record<string, string> = {
  PARENT_CHILD: "asset.relationship.create",
  DEPENDS_ON: "asset.relationship.create",
  CONNECTED_TO: "asset.relationship.create",
  INSTALLED_ON: "asset.relationship.create",
  HOSTED_ON: "asset.relationship.create",
  LICENSE_ASSIGNED_TO: "asset.relationship.create",
};

@Injectable()
export class AssetsService {
  constructor(
    @Inject(AssetsRepository) private readonly assetsRepository: AssetsRepository,
    @Inject(AssetTypesRepository) private readonly assetTypesRepository: AssetTypesRepository,
    @Inject(AssetCategoriesRepository)
    private readonly assetCategoriesRepository: AssetCategoriesRepository,
    @Inject(AssetLocationsRepository)
    private readonly assetLocationsRepository: AssetLocationsRepository,
    @Inject(RbacService) private readonly rbacService: RbacService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  private async assertCan(ctx: RequestContext, permissionKey: string): Promise<void> {
    const allowed = await this.rbacService.can({
      permissionKey,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
    });
    if (!allowed) {
      throw new ForbiddenException(`Lacks required ${permissionKey} permission`);
    }
  }

  private async assertAssetTypeForTenant(ctx: RequestContext, assetTypeId: string): Promise<void> {
    const assetType = await this.assetTypesRepository.findById(ctx.tenantId, assetTypeId);
    if (!assetType) {
      throw new BadRequestException("Asset type not found");
    }
  }

  // -------------------------------------------------------------------------
  // Asset types
  // -------------------------------------------------------------------------

  async createAssetType(ctx: RequestContext, dto: CreateAssetTypeDto, correlationId?: string) {
    await this.assertCan(ctx, "asset.type.create");
    const existing = await this.assetTypesRepository.findByKey(ctx.tenantId, dto.key);
    if (existing) {
      throw new ConflictException("An asset type with this key already exists");
    }
    const assetType = await this.assetTypesRepository.create(ctx.tenantId, dto);
    await this.writeAudit(ctx, {
      action: "asset.type.created",
      targetId: assetType.id,
      targetType: "asset_type",
      metadata: { key: assetType.key, name: assetType.name },
      correlationId,
    });
    return assetType;
  }

  async listAssetTypes(ctx: RequestContext, query: ListAssetTypesQuery) {
    await this.assertCan(ctx, "asset.type.read");
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const includeSystem = query.includeSystem ?? true;
    const customOnly = query.customOnly ?? false;
    return this.assetTypesRepository.list(ctx.tenantId, {
      page,
      pageSize,
      includeSystem,
      customOnly,
    });
  }

  async getAllAssetTypes(ctx: RequestContext) {
    await this.assertCan(ctx, "asset.type.read");
    return this.assetTypesRepository.listAllForTenant(ctx.tenantId);
  }

  async getAssetType(ctx: RequestContext, id: string) {
    await this.assertCan(ctx, "asset.type.read");
    const assetType = await this.assetTypesRepository.findById(ctx.tenantId, id);
    if (!assetType) {
      throw new NotFoundException("Asset type not found");
    }
    return assetType;
  }

  async updateAssetType(
    ctx: RequestContext,
    id: string,
    dto: UpdateAssetTypeDto,
    correlationId?: string,
  ) {
    await this.assertCan(ctx, "asset.type.update");
    const updated = await this.assetTypesRepository.update(ctx.tenantId, id, dto);
    if (!updated) {
      throw new NotFoundException("Asset type not found");
    }
    await this.writeAudit(ctx, {
      action: "asset.type.updated",
      targetId: id,
      targetType: "asset_type",
      metadata: { key: updated.key, name: updated.name },
      correlationId,
    });
    return updated;
  }

  async deleteAssetType(ctx: RequestContext, id: string, correlationId?: string) {
    await this.assertCan(ctx, "asset.type.delete");
    const assetType = await this.assetTypesRepository.findById(ctx.tenantId, id);
    if (!assetType) {
      throw new NotFoundException("Asset type not found");
    }
    if (assetType.isSystem) {
      throw new BadRequestException("System asset types cannot be deleted");
    }
    const usage = await this.assetTypesRepository.countAssetsUsing(ctx.tenantId, id);
    if (usage > 0) {
      throw new ConflictException(
        `Asset type is referenced by ${usage} asset(s); reassign them first`,
      );
    }
    await this.assetTypesRepository.softDelete(ctx.tenantId, id);
    await this.writeAudit(ctx, {
      action: "asset.type.deleted",
      targetId: id,
      targetType: "asset_type",
      metadata: { key: assetType.key, name: assetType.name },
      correlationId,
    });
  }

  // -------------------------------------------------------------------------
  // Asset categories
  // -------------------------------------------------------------------------

  async createAssetCategory(
    ctx: RequestContext,
    dto: CreateAssetCategoryDto,
    correlationId?: string,
  ) {
    await this.assertCan(ctx, "asset.category.create");
    const category = await this.assetCategoriesRepository.create(ctx.tenantId, dto);
    await this.writeAudit(ctx, {
      action: "asset.category.created",
      targetId: category.id,
      targetType: "asset_category",
      metadata: { name: category.name, slug: category.slug },
      correlationId,
    });
    return category;
  }

  async listAssetCategories(ctx: RequestContext, query: ListAssetCategoriesQuery) {
    await this.assertCan(ctx, "asset.category.read");
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    return this.assetCategoriesRepository.list(ctx.tenantId, { page, pageSize });
  }

  async getAllAssetCategories(ctx: RequestContext) {
    await this.assertCan(ctx, "asset.category.read");
    return this.assetCategoriesRepository.listAllForTenant(ctx.tenantId);
  }

  async getAssetCategory(ctx: RequestContext, id: string) {
    await this.assertCan(ctx, "asset.category.read");
    const category = await this.assetCategoriesRepository.findById(ctx.tenantId, id);
    if (!category) {
      throw new NotFoundException("Asset category not found");
    }
    return category;
  }

  async updateAssetCategory(
    ctx: RequestContext,
    id: string,
    dto: UpdateAssetCategoryDto,
    correlationId?: string,
  ) {
    await this.assertCan(ctx, "asset.category.update");
    if (dto.parentId !== undefined && dto.parentId !== null && dto.parentId !== id) {
      const parent = await this.assetCategoriesRepository.findById(ctx.tenantId, dto.parentId);
      if (!parent) {
        throw new BadRequestException("Parent category not found");
      }
    }
    if (dto.parentId === id) {
      throw new BadRequestException("A category cannot be its own parent");
    }
    const updated = await this.assetCategoriesRepository.update(ctx.tenantId, id, dto);
    if (!updated) {
      throw new NotFoundException("Asset category not found");
    }
    await this.writeAudit(ctx, {
      action: "asset.category.updated",
      targetId: id,
      targetType: "asset_category",
      metadata: { name: updated.name, slug: updated.slug },
      correlationId,
    });
    return updated;
  }

  async deleteAssetCategory(ctx: RequestContext, id: string, correlationId?: string) {
    await this.assertCan(ctx, "asset.category.delete");
    const category = await this.assetCategoriesRepository.findById(ctx.tenantId, id);
    if (!category) {
      throw new NotFoundException("Asset category not found");
    }
    const children = await this.assetCategoriesRepository.countChildren(ctx.tenantId, id);
    if (children > 0) {
      throw new ConflictException("Category has child categories; move or delete them first");
    }
    const usage = await this.assetCategoriesRepository.countAssetsUsing(ctx.tenantId, id);
    if (usage > 0) {
      throw new ConflictException(`Category is used by ${usage} asset(s); reassign them first`);
    }
    await this.assetCategoriesRepository.softDelete(ctx.tenantId, id);
    await this.writeAudit(ctx, {
      action: "asset.category.deleted",
      targetId: id,
      targetType: "asset_category",
      metadata: { name: category.name, slug: category.slug },
      correlationId,
    });
  }

  // -------------------------------------------------------------------------
  // Asset locations
  // -------------------------------------------------------------------------

  async createAssetLocation(
    ctx: RequestContext,
    dto: CreateAssetLocationDto,
    correlationId?: string,
  ) {
    await this.assertCan(ctx, "asset.location.create");
    const location = await this.assetLocationsRepository.create(ctx.tenantId, dto);
    await this.writeAudit(ctx, {
      action: "asset.location.created",
      targetId: location.id,
      targetType: "asset_location",
      metadata: { name: location.name },
      correlationId,
    });
    return location;
  }

  async listAssetLocations(ctx: RequestContext, query: ListAssetLocationsQuery) {
    await this.assertCan(ctx, "asset.location.read");
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    return this.assetLocationsRepository.list(ctx.tenantId, { page, pageSize });
  }

  async getAllAssetLocations(ctx: RequestContext) {
    await this.assertCan(ctx, "asset.location.read");
    return this.assetLocationsRepository.listAllForTenant(ctx.tenantId);
  }

  async getAssetLocation(ctx: RequestContext, id: string) {
    await this.assertCan(ctx, "asset.location.read");
    const location = await this.assetLocationsRepository.findById(ctx.tenantId, id);
    if (!location) {
      throw new NotFoundException("Asset location not found");
    }
    return location;
  }

  async updateAssetLocation(
    ctx: RequestContext,
    id: string,
    dto: UpdateAssetLocationDto,
    correlationId?: string,
  ) {
    await this.assertCan(ctx, "asset.location.update");
    const updated = await this.assetLocationsRepository.update(ctx.tenantId, id, dto);
    if (!updated) {
      throw new NotFoundException("Asset location not found");
    }
    await this.writeAudit(ctx, {
      action: "asset.location.updated",
      targetId: id,
      targetType: "asset_location",
      metadata: { name: updated.name },
      correlationId,
    });
    return updated;
  }

  async deleteAssetLocation(ctx: RequestContext, id: string, correlationId?: string) {
    await this.assertCan(ctx, "asset.location.delete");
    const location = await this.assetLocationsRepository.findById(ctx.tenantId, id);
    if (!location) {
      throw new NotFoundException("Asset location not found");
    }
    const usage = await this.assetLocationsRepository.countAssetsAt(ctx.tenantId, id);
    if (usage > 0) {
      throw new ConflictException(`Location is used by ${usage} asset(s); reassign them first`);
    }
    await this.assetLocationsRepository.delete(ctx.tenantId, id);
    await this.writeAudit(ctx, {
      action: "asset.location.deleted",
      targetId: id,
      targetType: "asset_location",
      metadata: { name: location.name },
      correlationId,
    });
  }

  // -------------------------------------------------------------------------
  // Assets
  // -------------------------------------------------------------------------

  async createAsset(ctx: RequestContext, dto: CreateAssetDto, correlationId?: string) {
    await this.assertCan(ctx, "asset.create");
    await this.assertAssetTypeForTenant(ctx, dto.assetTypeId);

    if (dto.lifecycleState === "ASSIGNED") {
      throw new BadRequestException(
        "Assets cannot be created directly in ASSIGNED state; create first, then assign",
      );
    }

    const asset = await this.assetsRepository.create(
      ctx.tenantId,
      dto,
      ctx.userId,
      this.auditEnvelope(ctx, "asset.created", "asset", correlationId),
    );
    return asset;
  }

  async listAssets(ctx: RequestContext, query: ListAssetsQuery) {
    await this.assertCan(ctx, "asset.read");
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const lifecycleState = query.lifecycleState;
    if (lifecycleState && !ASSET_LIFECYCLE_STATE_VALUES.includes(lifecycleState)) {
      throw new BadRequestException(`Invalid lifecycleState filter`);
    }
    if (query.q && query.q.length > 200) {
      throw new BadRequestException("Search query must be at most 200 characters");
    }
    return this.assetsRepository.list(ctx.tenantId, {
      page,
      pageSize,
      query: query.q,
      lifecycleState,
      assetTypeId: query.assetTypeId,
      categoryId: query.categoryId,
      locationId: query.locationId,
      assignedToUserId: query.assignedToUserId,
      ownerUserId: query.ownerUserId,
    });
  }

  async getAsset(ctx: RequestContext, id: string) {
    await this.assertCan(ctx, "asset.read");
    const asset = await this.assetsRepository.findOne(ctx.tenantId, id);
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }
    return asset;
  }

  async getAssetByRef(ctx: RequestContext, assetRef: string) {
    await this.assertCan(ctx, "asset.read");
    const asset = await this.assetsRepository.findByRef(ctx.tenantId, assetRef);
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }
    return asset;
  }

  async updateAsset(ctx: RequestContext, id: string, dto: UpdateAssetDto, correlationId?: string) {
    await this.assertCan(ctx, "asset.update");
    if (dto.categoryId !== undefined && dto.categoryId !== null) {
      const category = await this.assetCategoriesRepository.findById(ctx.tenantId, dto.categoryId);
      if (!category) {
        throw new BadRequestException("Category not found");
      }
    }
    if (dto.locationId !== undefined && dto.locationId !== null) {
      const location = await this.assetLocationsRepository.findById(ctx.tenantId, dto.locationId);
      if (!location) {
        throw new BadRequestException("Location not found");
      }
    }
    const asset = await this.assetsRepository.update(
      ctx.tenantId,
      id,
      dto,
      ctx.userId,
      this.auditEnvelope(ctx, "asset.updated", "asset", correlationId),
    );
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }
    return asset;
  }

  async transitionAsset(
    ctx: RequestContext,
    id: string,
    dto: TransitionAssetDto,
    correlationId?: string,
  ) {
    await this.assertCan(ctx, "asset.update");
    const current = await this.assetsRepository.findOne(ctx.tenantId, id);
    if (!current) {
      throw new NotFoundException("Asset not found");
    }
    if (current.lifecycleState === dto.lifecycleState) {
      throw new ConflictException("Asset is already in this lifecycle state");
    }
    if (!isAllowedAssetTransition(current.lifecycleState, dto.lifecycleState)) {
      throw new BadRequestException(
        `Lifecycle transition from ${current.lifecycleState} to ${dto.lifecycleState} is not allowed`,
      );
    }
    const asset = await this.assetsRepository.transition(
      ctx.tenantId,
      id,
      dto,
      ctx.userId,
      this.auditEnvelope(ctx, "asset.lifecycle.changed", "asset", correlationId),
    );
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }
    return asset;
  }

  async deleteAsset(ctx: RequestContext, id: string, correlationId?: string) {
    await this.assertCan(ctx, "asset.delete");
    const deleted = await this.assetsRepository.softDelete(
      ctx.tenantId,
      id,
      ctx.userId,
      this.auditEnvelope(ctx, "asset.deleted", "asset", correlationId),
    );
    if (!deleted) {
      throw new NotFoundException("Asset not found");
    }
  }

  async getAssetHistory(ctx: RequestContext, id: string) {
    await this.assertCan(ctx, "asset.history.read");
    const asset = await this.assetsRepository.findOne(ctx.tenantId, id);
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }
    return this.assetsRepository.listHistory(ctx.tenantId, id);
  }

  async getAssetAssignments(ctx: RequestContext, id: string) {
    await this.assertCan(ctx, "asset.read");
    const asset = await this.assetsRepository.findOne(ctx.tenantId, id);
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }
    return this.assetsRepository.listAssignments(ctx.tenantId, id);
  }

  async assignAsset(ctx: RequestContext, id: string, dto: AssignAssetDto, correlationId?: string) {
    await this.assertCan(ctx, "asset.assign");
    if (dto.kind === "LOCATION") {
      if (!dto.assignedLocationId) {
        throw new BadRequestException("LOCATION assignment requires assignedLocationId");
      }
      const location = await this.assetLocationsRepository.findById(
        ctx.tenantId,
        dto.assignedLocationId,
      );
      if (!location) {
        throw new BadRequestException("Location not found");
      }
    }
    const asset = await this.assetsRepository.assign(
      ctx.tenantId,
      id,
      dto,
      ctx.userId,
      this.auditEnvelope(ctx, "asset.assigned", "asset", correlationId),
    );
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }
    return asset;
  }

  async unassignAsset(ctx: RequestContext, id: string, correlationId?: string) {
    await this.assertCan(ctx, "asset.assign");
    const asset = await this.assetsRepository.unassign(
      ctx.tenantId,
      id,
      ctx.userId,
      this.auditEnvelope(ctx, "asset.unassigned", "asset", correlationId),
    );
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }
    return asset;
  }

  // -------------------------------------------------------------------------
  // Relationships
  // -------------------------------------------------------------------------

  async createRelationship(
    ctx: RequestContext,
    assetId: string,
    dto: CreateAssetRelationshipDto,
    correlationId?: string,
  ) {
    await this.assertCan(
      ctx,
      ASSET_RELATIONSHIP_PERMISSION[dto.type] ?? "asset.relationship.create",
    );
    const asset = await this.assetsRepository.findOne(ctx.tenantId, assetId);
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }
    const relationship = await this.assetsRepository.createRelationship(
      ctx.tenantId,
      assetId,
      dto,
      ctx.userId,
      this.auditEnvelope(ctx, "asset.relationship.created", "asset_relationship", correlationId),
    );
    if (!relationship) {
      throw new NotFoundException("Target asset not found");
    }
    return relationship;
  }

  async listRelationships(ctx: RequestContext, assetId: string) {
    await this.assertCan(ctx, "asset.read");
    const asset = await this.assetsRepository.findOne(ctx.tenantId, assetId);
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }
    return this.assetsRepository.listRelationships(ctx.tenantId, assetId);
  }

  async deleteRelationship(
    ctx: RequestContext,
    assetId: string,
    relationshipId: string,
    correlationId?: string,
  ) {
    await this.assertCan(ctx, "asset.relationship.delete");
    const deleted = await this.assetsRepository.deleteRelationship(
      ctx.tenantId,
      assetId,
      relationshipId,
      ctx.userId,
      this.auditEnvelope(ctx, "asset.relationship.deleted", "asset_relationship", correlationId),
    );
    if (!deleted) {
      throw new NotFoundException("Relationship not found");
    }
  }

  // -------------------------------------------------------------------------
  // Ticket links
  // -------------------------------------------------------------------------

  async linkTicket(ctx: RequestContext, assetId: string, ticketId: string, correlationId?: string) {
    await this.assertCan(ctx, "asset.link.ticket.create");
    const link = await this.assetsRepository.linkTicket(
      ctx.tenantId,
      assetId,
      ticketId,
      ctx.userId,
      this.auditEnvelope(ctx, "asset.ticket.linked", "asset", correlationId),
    );
    if (!link) {
      throw new NotFoundException("Asset not found");
    }
    return link;
  }

  async unlinkTicket(
    ctx: RequestContext,
    assetId: string,
    ticketId: string,
    correlationId?: string,
  ) {
    await this.assertCan(ctx, "asset.link.ticket.delete");
    const removed = await this.assetsRepository.unlinkTicket(
      ctx.tenantId,
      assetId,
      ticketId,
      ctx.userId,
      this.auditEnvelope(ctx, "asset.ticket.unlinked", "asset", correlationId),
    );
    if (!removed) {
      throw new NotFoundException("Asset-ticket link not found");
    }
  }

  async listTicketsForAsset(ctx: RequestContext, assetId: string) {
    await this.assertCan(ctx, "asset.read");
    const asset = await this.assetsRepository.findOne(ctx.tenantId, assetId);
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }
    return this.assetsRepository.listTicketsForAsset(ctx.tenantId, assetId);
  }

  async createTicketFromAsset(
    ctx: RequestContext,
    assetId: string,
    dto: CreateTicketFromAssetDto,
    correlationId?: string,
  ) {
    await this.assertCan(ctx, "asset.link.ticket.create");
    const result = await this.assetsRepository.createTicketFromAsset(
      ctx.tenantId,
      assetId,
      dto,
      ctx.userId,
      this.auditEnvelope(ctx, "asset.ticket_created", "ticket", correlationId),
    );
    return result;
  }

  // -------------------------------------------------------------------------
  // KB links
  // -------------------------------------------------------------------------

  async linkAssetTypeKb(
    ctx: RequestContext,
    assetTypeId: string,
    articleId: string,
    correlationId?: string,
  ) {
    await this.assertCan(ctx, "asset.type.link.kb");
    const link = await this.assetsRepository.linkAssetTypeKb(
      ctx.tenantId,
      assetTypeId,
      articleId,
      ctx.userId,
      this.auditEnvelope(ctx, "asset.type.kb.linked", "asset_type", correlationId),
    );
    if (!link) {
      throw new NotFoundException("Asset type not found");
    }
    return link;
  }

  async unlinkAssetTypeKb(
    ctx: RequestContext,
    assetTypeId: string,
    articleId: string,
    correlationId?: string,
  ) {
    await this.assertCan(ctx, "asset.type.link.kb");
    const removed = await this.assetsRepository.unlinkAssetTypeKb(
      ctx.tenantId,
      assetTypeId,
      articleId,
      ctx.userId,
      this.auditEnvelope(ctx, "asset.type.kb.unlinked", "asset_type", correlationId),
    );
    if (!removed) {
      throw new NotFoundException("Asset type KB link not found");
    }
  }

  async listKbForAssetType(ctx: RequestContext, assetTypeId: string) {
    await this.assertCan(ctx, "asset.type.read");
    const assetType = await this.assetTypesRepository.findById(ctx.tenantId, assetTypeId);
    if (!assetType) {
      throw new NotFoundException("Asset type not found");
    }
    return this.assetsRepository.listKbForAssetType(ctx.tenantId, assetTypeId);
  }

  // -------------------------------------------------------------------------
  // Counters
  // -------------------------------------------------------------------------

  async getLifecycleSummary(ctx: RequestContext) {
    await this.assertCan(ctx, "asset.read");
    return this.assetsRepository.countByLifecycleState(ctx.tenantId);
  }

  // -------------------------------------------------------------------------

  private auditEnvelope(
    ctx: RequestContext,
    action: string,
    targetType: string,
    correlationId?: string,
  ) {
    return {
      action,
      actorUserId: ctx.userId,
      correlationId,
      targetType,
    };
  }

  private async writeAudit(
    ctx: RequestContext,
    input: {
      action: string;
      targetId?: string;
      targetType: string;
      metadata?: Record<string, unknown>;
      correlationId?: string;
    },
  ): Promise<void> {
    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: input.action,
        actorUserId: ctx.userId,
        correlationId: input.correlationId,
        outcome: "SUCCESS",
        targetId: input.targetId,
        targetType: input.targetType,
        tenantId: ctx.tenantId,
        metadata: input.metadata,
      }),
    });
  }
}
