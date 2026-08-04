import { randomUUID } from "node:crypto";

import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  Asset,
  AssetAssignment,
  AssetCategory,
  AssetHistory,
  AssetLifecycleState,
  AssetLocation,
  AssetRelationship,
  AssetTicketLink,
  AssetType,
  AssetTypeKbLink,
  Ticket,
} from "@prisma/client";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { OutboxPublisherService } from "../outbox/outbox-publisher.service";
import { isAllowedAssetTransition } from "./domain/asset-lifecycle";
import type {
  AssignAssetDto,
  CreateAssetDto,
  CreateAssetRelationshipDto,
  CreateTicketFromAssetDto,
  TransitionAssetDto,
  UpdateAssetDto,
} from "./dto/asset-dtos";

export interface AuditEventInput {
  action: string;
  actorUserId: string;
  targetId?: string;
  targetType: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

export interface OutboxEventInput {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  dedupeKey?: string;
  correlationId?: string;
}

export interface AssetSearchOptions {
  page: number;
  pageSize: number;
  query?: string;
  lifecycleState?: AssetLifecycleState;
  assetTypeId?: string;
  categoryId?: string;
  locationId?: string;
  assignedToUserId?: string;
  ownerUserId?: string;
  includeDeleted?: boolean;
}

export type AssetWithRelations = Asset & {
  assetType?: AssetType | null;
  category?: AssetCategory | null;
  location?: AssetLocation | null;
  ownerUser?: {
    id: string;
    profile?: {
      displayName?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  } | null;
  assignedUser?: {
    id: string;
    profile?: {
      displayName?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  } | null;
  assignments?: AssetAssignment[];
};

const ASSET_INCLUDE = {
  assetType: true,
  category: true,
  location: true,
  ownerUser: {
    select: {
      id: true,
      profile: { select: { displayName: true, firstName: true, lastName: true } },
    },
  },
  assignedUser: {
    select: {
      id: true,
      profile: { select: { displayName: true, firstName: true, lastName: true } },
    },
  },
  assignments: { orderBy: { assignedAt: "desc" as const }, take: 1 },
} satisfies Prisma.AssetInclude;

const ASSET_REF_PREFIX = "AST";

@Injectable()
export class AssetsRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OutboxPublisherService) private readonly outboxPublisher: OutboxPublisherService,
  ) {}

  private async appendOutbox(
    tx: Prisma.TransactionClient,
    tenantId: string,
    event: OutboxEventInput,
  ): Promise<void> {
    await this.outboxPublisher.appendOutboxEvent(tx, {
      tenantId,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload,
      dedupeKey: event.dedupeKey,
      correlationId: event.correlationId,
    });
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    tenantId: string,
    audit: AuditEventInput,
  ): Promise<void> {
    await tx.auditEvent.create({
      data: {
        action: audit.action,
        actorUserId: audit.actorUserId,
        correlationId: audit.correlationId,
        outcome: "SUCCESS",
        targetId: audit.targetId ?? randomUUID(),
        targetType: audit.targetType,
        tenantId,
        metadata: audit.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private async writeHistory(
    tx: Prisma.TransactionClient,
    tenantId: string,
    assetId: string,
    action: string,
    actorUserId: string,
    data: {
      fromState?: string;
      toState?: string;
      comment?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<AssetHistory> {
    return tx.assetHistory.create({
      data: {
        tenantId,
        assetId,
        action,
        fromState: data.fromState ?? null,
        toState: data.toState ?? null,
        actorUserId,
        comment: data.comment ?? null,
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  private async nextAssetRef(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
    const count = await tx.asset.count({ where: { tenantId } });
    return `${ASSET_REF_PREFIX}-${String(count + 1).padStart(6, "0")}`;
  }

  /** Atomically creates an asset with ref, history, audit, and outbox event. */
  async create(
    tenantId: string,
    dto: CreateAssetDto,
    actorUserId: string,
    audit: AuditEventInput,
  ): Promise<AssetWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const assetRef = await this.nextAssetRef(tx, tenantId);
      const lifecycleState = dto.lifecycleState ?? "DRAFT";

      const asset = await tx.asset.create({
        data: {
          tenantId,
          assetRef,
          name: dto.name.trim(),
          assetTypeId: dto.assetTypeId,
          categoryId: dto.categoryId ?? null,
          serialNumber: dto.serialNumber?.trim() || null,
          assetTag: dto.assetTag?.trim() || null,
          barcode: dto.barcode?.trim() || null,
          manufacturer: dto.manufacturer?.trim() || null,
          model: dto.model?.trim() || null,
          vendor: dto.vendor?.trim() || null,
          purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
          warrantyExpiresAt: dto.warrantyExpiresAt ? new Date(dto.warrantyExpiresAt) : null,
          cost: dto.cost ?? null,
          lifecycleState,
          ownerUserId: dto.ownerUserId ?? null,
          locationId: dto.locationId ?? null,
          notes: dto.notes?.trim() || null,
          customFields: (dto.customFields ?? {}) as Prisma.InputJsonValue,
          version: 1,
        },
      });

      await this.writeHistory(tx, tenantId, asset.id, "asset.created", actorUserId, {
        toState: lifecycleState,
        comment: "Asset created",
      });

      await this.writeAudit(tx, tenantId, { ...audit, targetId: asset.id });

      await this.appendOutbox(tx, tenantId, {
        eventType: "asset.created",
        aggregateType: "asset",
        aggregateId: asset.id,
        correlationId: audit.correlationId,
        payload: {
          asset: {
            id: asset.id,
            tenantId,
            assetRef,
            name: asset.name,
            assetTypeId: asset.assetTypeId,
            lifecycleState,
          },
          assetId: asset.id,
          assetRef,
          assetType: asset.assetTypeId,
          lifecycleState,
        },
      });

      const created = await this.findOneWithClient(tx, tenantId, asset.id);
      if (!created) {
        throw new Error(`Failed to retrieve created asset ${asset.id}`);
      }
      return created;
    });
  }

  async findOne(tenantId: string, id: string): Promise<AssetWithRelations | null> {
    return this.prisma.asset.findFirst({
      where: { tenantId, id, deletedAt: null },
      include: ASSET_INCLUDE,
    });
  }

  private async findOneWithClient(
    client: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ): Promise<AssetWithRelations | null> {
    return client.asset.findFirst({
      where: { tenantId, id, deletedAt: null },
      include: ASSET_INCLUDE,
    });
  }

  async findOneIncludingDeleted(tenantId: string, id: string): Promise<AssetWithRelations | null> {
    return this.prisma.asset.findFirst({
      where: { tenantId, id },
      include: ASSET_INCLUDE,
    });
  }

  async findByRef(tenantId: string, assetRef: string): Promise<AssetWithRelations | null> {
    return this.prisma.asset.findFirst({
      where: { tenantId, assetRef, deletedAt: null },
      include: ASSET_INCLUDE,
    });
  }

  async list(
    tenantId: string,
    options: AssetSearchOptions,
  ): Promise<{ items: AssetWithRelations[]; totalRecords: number }> {
    const where: Prisma.AssetWhereInput = this.buildWhere(tenantId, options);
    const [items, totalRecords] = await this.prisma.$transaction([
      this.prisma.asset.findMany({
        where,
        include: ASSET_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
      }),
      this.prisma.asset.count({ where }),
    ]);
    return { items, totalRecords };
  }

  private buildWhere(tenantId: string, options: AssetSearchOptions): Prisma.AssetWhereInput {
    const where: Prisma.AssetWhereInput = {
      tenantId,
      ...(options.includeDeleted ? {} : { deletedAt: null }),
      ...(options.lifecycleState ? { lifecycleState: options.lifecycleState } : {}),
      ...(options.assetTypeId ? { assetTypeId: options.assetTypeId } : {}),
      ...(options.categoryId ? { categoryId: options.categoryId } : {}),
      ...(options.locationId ? { locationId: options.locationId } : {}),
      ...(options.assignedToUserId ? { assignedUserId: options.assignedToUserId } : {}),
      ...(options.ownerUserId ? { ownerUserId: options.ownerUserId } : {}),
    };

    const q = options.query?.trim() ?? "";
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { assetTag: { contains: q, mode: "insensitive" } },
        { serialNumber: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q, mode: "insensitive" } },
      ];
    }

    return where;
  }

  /** Applies a partial update, bumping version and recording history + audit. */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateAssetDto,
    actorUserId: string,
    audit: AuditEventInput,
  ): Promise<AssetWithRelations | null> {
    return this.prisma.$transaction(async (tx) => {
      const [updated] = await tx.asset.updateManyAndReturn({
        where: { tenantId, id, deletedAt: null },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId || null } : {}),
          ...(dto.serialNumber !== undefined
            ? { serialNumber: dto.serialNumber?.trim() || null }
            : {}),
          ...(dto.assetTag !== undefined ? { assetTag: dto.assetTag?.trim() || null } : {}),
          ...(dto.barcode !== undefined ? { barcode: dto.barcode?.trim() || null } : {}),
          ...(dto.manufacturer !== undefined
            ? { manufacturer: dto.manufacturer?.trim() || null }
            : {}),
          ...(dto.model !== undefined ? { model: dto.model?.trim() || null } : {}),
          ...(dto.vendor !== undefined ? { vendor: dto.vendor?.trim() || null } : {}),
          ...(dto.purchaseDate !== undefined
            ? { purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null }
            : {}),
          ...(dto.warrantyExpiresAt !== undefined
            ? { warrantyExpiresAt: dto.warrantyExpiresAt ? new Date(dto.warrantyExpiresAt) : null }
            : {}),
          ...(dto.cost !== undefined ? { cost: dto.cost || null } : {}),
          ...(dto.ownerUserId !== undefined ? { ownerUserId: dto.ownerUserId || null } : {}),
          ...(dto.locationId !== undefined ? { locationId: dto.locationId || null } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
          ...(dto.customFields !== undefined
            ? { customFields: dto.customFields as Prisma.InputJsonValue }
            : {}),
          version: { increment: 1 },
        },
      });

      if (!updated) {
        return null;
      }

      await this.writeHistory(tx, tenantId, id, "asset.updated", actorUserId, {
        fromState: updated.lifecycleState,
        toState: updated.lifecycleState,
        comment: "Asset updated",
        metadata: { changedFields: Object.keys(dto) },
      });
      await this.writeAudit(tx, tenantId, { ...audit, targetId: id });

      return this.findOneWithClient(tx, tenantId, id);
    });
  }

  /** Transitions lifecycle state with validation, history, audit, and outbox event. */
  async transition(
    tenantId: string,
    id: string,
    dto: TransitionAssetDto,
    actorUserId: string,
    audit: AuditEventInput,
  ): Promise<AssetWithRelations | null> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.asset.findFirst({ where: { tenantId, id, deletedAt: null } });
      if (!current) {
        return null;
      }
      if (current.lifecycleState === dto.lifecycleState) {
        throw new Error("asset.transition.same_state");
      }
      if (!isAllowedAssetTransition(current.lifecycleState, dto.lifecycleState)) {
        throw new Error(
          `asset.transition.not_allowed:${current.lifecycleState}->${dto.lifecycleState}`,
        );
      }

      const [updated] = await tx.asset.updateManyAndReturn({
        where: { tenantId, id, deletedAt: null, lifecycleState: current.lifecycleState },
        data: { lifecycleState: dto.lifecycleState, version: { increment: 1 } },
      });
      if (!updated) {
        return null;
      }

      await this.writeHistory(tx, tenantId, id, "asset.status_changed", actorUserId, {
        fromState: current.lifecycleState,
        toState: dto.lifecycleState,
        comment: dto.comment ?? null,
      });
      await this.writeAudit(tx, tenantId, { ...audit, targetId: id });

      await this.appendOutbox(tx, tenantId, {
        eventType: "asset.status_changed",
        aggregateType: "asset",
        aggregateId: id,
        correlationId: audit.correlationId,
        payload: {
          asset: {
            id,
            tenantId,
            assetRef: current.assetRef,
            name: current.name,
            lifecycleState: dto.lifecycleState,
            fromLifecycleState: current.lifecycleState,
          },
          assetId: id,
          assetRef: current.assetRef,
          assetType: current.assetTypeId,
          lifecycleState: dto.lifecycleState,
          fromLifecycleState: current.lifecycleState,
        },
      });

      return this.findOneWithClient(tx, tenantId, id);
    });
  }

  /** Assigns an asset to a user, department, or location with full history. */
  async assign(
    tenantId: string,
    id: string,
    dto: AssignAssetDto,
    actorUserId: string,
    audit: AuditEventInput,
  ): Promise<AssetWithRelations | null> {
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findFirst({ where: { tenantId, id, deletedAt: null } });
      if (!asset) {
        return null;
      }

      const assignment = await tx.assetAssignment.create({
        data: {
          tenantId,
          assetId: id,
          kind: dto.kind,
          assignedToUserId: dto.assignedToUserId ?? null,
          assignedDepartment: dto.assignedDepartment ?? null,
          assignedLocationId: dto.assignedLocationId ?? null,
          assignedByUserId: actorUserId,
          assignedAt: new Date(),
          reason: dto.reason?.trim() || null,
        },
      });

      const targetLifecycle =
        dto.kind === "USER" &&
        dto.transitionLifecycle !== false &&
        asset.lifecycleState === "IN_STOCK"
          ? "ASSIGNED"
          : asset.lifecycleState;
      const nextLifecycle = targetLifecycle;

      const [updated] = await tx.asset.updateManyAndReturn({
        where: { tenantId, id, deletedAt: null },
        data: {
          ...(dto.kind === "USER" ? { assignedUserId: dto.assignedToUserId } : {}),
          ...(dto.kind === "DEPARTMENT" ? { assignedDepartment: dto.assignedDepartment } : {}),
          ...(dto.kind === "LOCATION" ? { locationId: dto.assignedLocationId } : {}),
          version: { increment: 1 },
          ...(nextLifecycle !== asset.lifecycleState ? { lifecycleState: nextLifecycle } : {}),
        },
      });
      if (!updated) {
        return null;
      }

      await this.writeHistory(tx, tenantId, id, "asset.assigned", actorUserId, {
        fromState: asset.lifecycleState,
        toState: nextLifecycle,
        comment: dto.reason?.trim() || null,
        metadata: {
          assignmentId: assignment.id,
          kind: dto.kind,
          ...(dto.kind === "USER" ? { assignedToUserId: dto.assignedToUserId } : {}),
          ...(dto.kind === "DEPARTMENT" ? { assignedDepartment: dto.assignedDepartment } : {}),
          ...(dto.kind === "LOCATION" ? { assignedLocationId: dto.assignedLocationId } : {}),
        },
      });
      await this.writeAudit(tx, tenantId, { ...audit, targetId: id });

      await this.appendOutbox(tx, tenantId, {
        eventType: "asset.assigned",
        aggregateType: "asset",
        aggregateId: id,
        correlationId: audit.correlationId,
        payload: {
          asset: {
            id,
            tenantId,
            assetRef: asset.assetRef,
            name: asset.name,
            lifecycleState: nextLifecycle,
          },
          assignment: {
            id: assignment.id,
            kind: dto.kind,
            assignedToUserId: dto.assignedToUserId ?? null,
            assignedDepartment: dto.assignedDepartment ?? null,
            assignedLocationId: dto.assignedLocationId ?? null,
          },
        },
      });

      return this.findOneWithClient(tx, tenantId, id);
    });
  }

  /** Removes the current assignment (asset returns to unassigned state). */
  async unassign(
    tenantId: string,
    id: string,
    actorUserId: string,
    audit: AuditEventInput,
  ): Promise<AssetWithRelations | null> {
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findFirst({ where: { tenantId, id, deletedAt: null } });
      if (!asset) {
        return null;
      }

      await tx.assetAssignment.updateMany({
        where: { tenantId, assetId: id },
        data: { unassignedAt: new Date(), unassignedByUserId: actorUserId },
      });

      const [updated] = await tx.asset.updateManyAndReturn({
        where: { tenantId, id, deletedAt: null },
        data: {
          assignedUserId: null,
          assignedDepartment: null,
          version: { increment: 1 },
        },
      });
      if (!updated) {
        return null;
      }

      await this.writeHistory(tx, tenantId, id, "asset.unassigned", actorUserId, {
        fromState: asset.lifecycleState,
        toState: asset.lifecycleState,
        comment: "Assignment removed",
      });
      await this.writeAudit(tx, tenantId, { ...audit, targetId: id });

      await this.appendOutbox(tx, tenantId, {
        eventType: "asset.unassigned",
        aggregateType: "asset",
        aggregateId: id,
        correlationId: audit.correlationId,
        payload: {
          asset: {
            id,
            tenantId,
            assetRef: asset.assetRef,
            name: asset.name,
            lifecycleState: asset.lifecycleState,
          },
        },
      });

      return this.findOneWithClient(tx, tenantId, id);
    });
  }

  /** Soft-deletes an asset; relationship graph is preserved but hidden. */
  async softDelete(
    tenantId: string,
    id: string,
    actorUserId: string,
    audit: AuditEventInput,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const [deleted] = await tx.asset.updateManyAndReturn({
        where: { tenantId, id, deletedAt: null },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      if (!deleted) {
        return false;
      }
      await this.writeHistory(tx, tenantId, id, "asset.deleted", actorUserId, {
        fromState: deleted.lifecycleState,
        toState: deleted.lifecycleState,
        comment: "Asset soft-deleted",
      });
      await this.writeAudit(tx, tenantId, { ...audit, targetId: id });
      return true;
    });
  }

  // -------------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------------

  async listHistory(tenantId: string, assetId: string): Promise<AssetHistory[]> {
    return this.prisma.assetHistory.findMany({
      where: { tenantId, assetId },
      orderBy: { createdAt: "desc" },
    });
  }

  // -------------------------------------------------------------------------
  // Assignments
  // -------------------------------------------------------------------------

  async listAssignments(tenantId: string, assetId: string): Promise<AssetAssignment[]> {
    return this.prisma.assetAssignment.findMany({
      where: { tenantId, assetId },
      orderBy: { assignedAt: "desc" },
    });
  }

  // -------------------------------------------------------------------------
  // Relationships
  // -------------------------------------------------------------------------

  async createRelationship(
    tenantId: string,
    sourceAssetId: string,
    dto: CreateAssetRelationshipDto,
    actorUserId: string,
    audit: AuditEventInput,
  ): Promise<AssetRelationship | null> {
    return this.prisma.$transaction(async (tx) => {
      if (sourceAssetId === dto.targetAssetId) {
        throw new Error("asset.relationship.self_reference");
      }
      const target = await tx.asset.findFirst({
        where: { tenantId, id: dto.targetAssetId, deletedAt: null },
      });
      if (!target) {
        return null;
      }
      const existing = await tx.assetRelationship.findFirst({
        where: { tenantId, sourceAssetId, targetAssetId: dto.targetAssetId, type: dto.type },
      });
      if (existing) {
        return existing;
      }

      if (dto.type === "PARENT_CHILD") {
        await this.assertNoParentCycle(tx, tenantId, sourceAssetId, dto.targetAssetId);
      }

      const relationship = await tx.assetRelationship.create({
        data: {
          tenantId,
          sourceAssetId,
          targetAssetId: dto.targetAssetId,
          type: dto.type,
          note: dto.note?.trim() || null,
          createdByUserId: actorUserId,
        },
      });

      await this.writeHistory(
        tx,
        tenantId,
        sourceAssetId,
        "asset.relationship_added",
        actorUserId,
        {
          metadata: {
            relationshipId: relationship.id,
            targetAssetId: dto.targetAssetId,
            type: dto.type,
          },
        },
      );
      await this.writeAudit(tx, tenantId, { ...audit, targetId: sourceAssetId });

      return relationship;
    });
  }

  /** Prevents introducing a cycle in the PARENT_CHILD hierarchy. */
  private async assertNoParentCycle(
    tx: Prisma.TransactionClient,
    tenantId: string,
    parentAssetId: string,
    childAssetId: string,
  ): Promise<void> {
    // Adding parentAssetId -> childAssetId is a cycle iff childAssetId is
    // already an ancestor of parentAssetId.
    const seen = new Set<string>([parentAssetId]);
    let cursor = parentAssetId;
    while (cursor) {
      const row = await tx.assetRelationship.findFirst({
        where: {
          tenantId,
          targetAssetId: cursor,
          type: "PARENT_CHILD",
        },
      });
      if (!row) {
        return;
      }
      if (row.sourceAssetId === childAssetId || seen.has(row.sourceAssetId)) {
        throw new Error("asset.relationship.cycle_detected");
      }
      seen.add(row.sourceAssetId);
      cursor = row.sourceAssetId;
    }
  }

  async listRelationships(
    tenantId: string,
    assetId: string,
  ): Promise<{ outgoing: AssetRelationship[]; incoming: AssetRelationship[] }> {
    const [outgoing, incoming] = await this.prisma.$transaction([
      this.prisma.assetRelationship.findMany({
        where: { tenantId, sourceAssetId: assetId, deletedAt: null },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.assetRelationship.findMany({
        where: { tenantId, targetAssetId: assetId, deletedAt: null },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    return { outgoing, incoming };
  }

  async deleteRelationship(
    tenantId: string,
    assetId: string,
    relationshipId: string,
    actorUserId: string,
    audit: AuditEventInput,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const relationship = await tx.assetRelationship.findFirst({
        where: {
          tenantId,
          id: relationshipId,
          OR: [{ sourceAssetId: assetId }, { targetAssetId: assetId }],
        },
      });
      if (!relationship) {
        return false;
      }
      await tx.assetRelationship.delete({ where: { id: relationshipId } });
      await this.writeHistory(tx, tenantId, assetId, "asset.relationship_removed", actorUserId, {
        metadata: {
          relationshipId,
          targetAssetId: relationship.targetAssetId,
          type: relationship.type,
        },
      });
      await this.writeAudit(tx, tenantId, { ...audit, targetId: assetId });
      return true;
    });
  }

  // -------------------------------------------------------------------------
  // Ticket links
  // -------------------------------------------------------------------------

  async linkTicket(
    tenantId: string,
    assetId: string,
    ticketId: string,
    actorUserId: string,
    audit: AuditEventInput,
  ): Promise<AssetTicketLink | null> {
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findFirst({ where: { tenantId, id: assetId, deletedAt: null } });
      if (!asset) {
        return null;
      }
      const ticket = await tx.ticket.findFirst({ where: { tenantId, id: ticketId } });
      if (!ticket) {
        throw new Error("asset.link.ticket_not_found");
      }
      const existing = await tx.assetTicketLink.findUnique({
        where: { tenantId_assetId_ticketId: { tenantId, assetId, ticketId } },
      });
      if (existing) {
        return existing;
      }
      const link = await tx.assetTicketLink.create({
        data: { tenantId, assetId, ticketId, createdByUserId: actorUserId },
      });
      await this.writeHistory(tx, tenantId, assetId, "asset.ticket_linked", actorUserId, {
        metadata: { ticketId },
      });
      await this.writeAudit(tx, tenantId, { ...audit, targetId: assetId });
      return link;
    });
  }

  async unlinkTicket(
    tenantId: string,
    assetId: string,
    ticketId: string,
    actorUserId: string,
    audit: AuditEventInput,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.assetTicketLink.deleteMany({
        where: { tenantId, assetId, ticketId },
      });
      if (result.count === 0) {
        return false;
      }
      await this.writeHistory(tx, tenantId, assetId, "asset.ticket_unlinked", actorUserId, {
        metadata: { ticketId },
      });
      await this.writeAudit(tx, tenantId, { ...audit, targetId: assetId });
      return true;
    });
  }

  async listTicketsForAsset(tenantId: string, assetId: string): Promise<AssetTicketLink[]> {
    return this.prisma.assetTicketLink.findMany({
      where: { tenantId, assetId },
      orderBy: { createdAt: "desc" },
    });
  }

  async listAssetsForTicket(
    tenantId: string,
    ticketId: string,
  ): Promise<Array<AssetTicketLink & { asset: { id: string; assetRef: string; name: string } }>> {
    return this.prisma.assetTicketLink.findMany({
      where: { tenantId, ticketId },
      include: { asset: { select: { id: true, assetRef: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Atomically creates a ticket from an asset and links them, mirroring the
   * service-catalog ticket-generation pattern (row lock + idempotent link).
   */
  async createTicketFromAsset(
    tenantId: string,
    assetId: string,
    dto: CreateTicketFromAssetDto,
    actorUserId: string,
    audit: AuditEventInput,
  ): Promise<{ asset: Asset; ticket: Ticket }> {
    const maxRetries = 15;
    let attempt = 0;

    while (true) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`
            SELECT "id" FROM "assets"
            WHERE "tenant_id" = ${tenantId}::uuid AND "id" = ${assetId}::uuid
            FOR UPDATE
          `;

          const asset = await tx.asset.findFirst({
            where: { tenantId, id: assetId, deletedAt: null },
          });
          if (!asset) {
            throw new NotFoundException("Asset not found");
          }

          const count = await tx.ticket.count({ where: { tenantId } });
          const publicRef = `TKT-${count + 1001 + attempt}`;
          const ticketId = randomUUID();

          await tx.ticket.create({
            data: {
              id: ticketId,
              tenantId,
              publicRef,
              title: dto.title.trim(),
              description: dto.description.trim(),
              status: "NEW",
              priority: dto.priority ?? "MEDIUM",
              channel: "WEB",
              type: dto.type ?? "INCIDENT",
              requesterUserId: actorUserId,
              version: 1,
            },
          });

          await tx.assetTicketLink.create({
            data: { tenantId, assetId, ticketId, createdByUserId: actorUserId },
          });

          await this.writeHistory(tx, tenantId, assetId, "asset.ticket_created", actorUserId, {
            metadata: { ticketId, publicRef },
          });
          await this.writeAudit(tx, tenantId, {
            ...audit,
            targetId: ticketId,
            metadata: { ...audit.metadata, assetId, assetRef: asset.assetRef, publicRef },
          });

          await this.appendOutbox(tx, tenantId, {
            eventType: "ticket.created",
            aggregateType: "ticket",
            aggregateId: ticketId,
            correlationId: audit.correlationId,
            payload: {
              ticket: {
                id: ticketId,
                tenantId,
                publicRef,
                title: dto.title.trim(),
                description: dto.description.trim(),
                status: "NEW",
                priority: dto.priority ?? "MEDIUM",
                channel: "WEB",
                type: dto.type ?? "INCIDENT",
                requesterUserId: actorUserId,
              },
              sourceAssetId: assetId,
              sourceAssetRef: asset.assetRef,
            },
          });

          await this.appendOutbox(tx, tenantId, {
            eventType: "asset.ticket_created",
            aggregateType: "asset",
            aggregateId: assetId,
            correlationId: audit.correlationId,
            payload: {
              assetId,
              assetRef: asset.assetRef,
              ticketId,
              publicRef,
            },
          });

          const ticket = await tx.ticket.findFirstOrThrow({ where: { tenantId, id: ticketId } });
          return { asset, ticket };
        });
      } catch (error) {
        const prismaError = error as { code?: string };
        if (prismaError.code === "P2002" && attempt < maxRetries) {
          attempt += 1;
          continue;
        }
        throw error;
      }
    }
  }

  // -------------------------------------------------------------------------
  // KB links
  // -------------------------------------------------------------------------

  async linkAssetTypeKb(
    tenantId: string,
    assetTypeId: string,
    articleId: string,
    actorUserId: string,
    audit: AuditEventInput,
  ): Promise<AssetTypeKbLink | null> {
    return this.prisma.$transaction(async (tx) => {
      const assetType = await tx.assetType.findFirst({
        where: { tenantId, id: assetTypeId, deletedAt: null },
      });
      if (!assetType) {
        return null;
      }
      const article = await tx.kbArticle.findFirst({ where: { tenantId, id: articleId } });
      if (!article) {
        throw new Error("asset.type_kb.article_not_found");
      }
      const existing = await tx.assetTypeKbLink.findUnique({
        where: { tenantId_assetTypeId_articleId: { tenantId, assetTypeId, articleId } },
      });
      if (existing) {
        return existing;
      }
      const link = await tx.assetTypeKbLink.create({
        data: { tenantId, assetTypeId, articleId, createdByUserId: actorUserId },
      });
      await this.writeAudit(tx, tenantId, { ...audit, targetId: assetTypeId });
      return link;
    });
  }

  async unlinkAssetTypeKb(
    tenantId: string,
    assetTypeId: string,
    articleId: string,
    actorUserId: string,
    audit: AuditEventInput,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.assetTypeKbLink.deleteMany({
        where: { tenantId, assetTypeId, articleId },
      });
      if (result.count === 0) {
        return false;
      }
      await this.writeAudit(tx, tenantId, { ...audit, targetId: assetTypeId });
      return true;
    });
  }

  async listKbForAssetType(tenantId: string, assetTypeId: string): Promise<AssetTypeKbLink[]> {
    return this.prisma.assetTypeKbLink.findMany({
      where: { tenantId, assetTypeId },
      orderBy: { createdAt: "desc" },
    });
  }

  // -------------------------------------------------------------------------
  // Counters
  // -------------------------------------------------------------------------

  async countByLifecycleState(tenantId: string) {
    return this.prisma.asset.groupBy({
      by: ["lifecycleState"],
      where: { tenantId, deletedAt: null },
      _count: { _all: true },
    });
  }

  async countAssets(tenantId: string): Promise<number> {
    return this.prisma.asset.count({ where: { tenantId, deletedAt: null } });
  }
}
