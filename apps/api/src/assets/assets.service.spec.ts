import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../database/prisma.service";
import type { RbacService } from "../rbac/rbac.service";
import type { AssetCategoriesRepository } from "./asset-categories.repository";
import type { AssetLocationsRepository } from "./asset-locations.repository";
import type { AssetTypesRepository } from "./asset-types.repository";
import type { AssetsRepository } from "./assets.repository";
import { AssetsService } from "./assets.service";

const ctx = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
};

describe("AssetsService Unit Tests", () => {
  let assetsRepository: { [K in keyof AssetsRepository]: ReturnType<typeof vi.fn> };
  let assetTypesRepository: { [K in keyof AssetTypesRepository]: ReturnType<typeof vi.fn> };
  let categoriesRepository: { [K in keyof AssetCategoriesRepository]: ReturnType<typeof vi.fn> };
  let locationsRepository: { [K in keyof AssetLocationsRepository]: ReturnType<typeof vi.fn> };
  let rbacService: { can: ReturnType<typeof vi.fn> };
  let prisma: { auditEvent: { create: ReturnType<typeof vi.fn> } };
  let service: AssetsService;

  beforeEach(() => {
    assetsRepository = {
      create: vi.fn(),
      findOne: vi.fn(),
      findOneIncludingDeleted: vi.fn(),
      findByRef: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      transition: vi.fn(),
      assign: vi.fn(),
      unassign: vi.fn(),
      softDelete: vi.fn(),
      listHistory: vi.fn(),
      listAssignments: vi.fn(),
      createRelationship: vi.fn(),
      listRelationships: vi.fn(),
      deleteRelationship: vi.fn(),
      linkTicket: vi.fn(),
      unlinkTicket: vi.fn(),
      listTicketsForAsset: vi.fn(),
      listAssetsForTicket: vi.fn(),
      createTicketFromAsset: vi.fn(),
      linkAssetTypeKb: vi.fn(),
      unlinkAssetTypeKb: vi.fn(),
      listKbForAssetType: vi.fn(),
      countByLifecycleState: vi.fn(),
      countAssets: vi.fn(),
    };
    assetTypesRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByKey: vi.fn(),
      list: vi.fn(),
      listAllForTenant: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      countAssetsUsing: vi.fn(),
    };
    categoriesRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      list: vi.fn(),
      listAllForTenant: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      countAssetsUsing: vi.fn(),
      countChildren: vi.fn(),
    };
    locationsRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      list: vi.fn(),
      listAllForTenant: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      countAssetsAt: vi.fn(),
    };
    rbacService = { can: vi.fn().mockResolvedValue(true) };
    prisma = { auditEvent: { create: vi.fn().mockResolvedValue({}) } };

    service = new AssetsService(
      assetsRepository as unknown as AssetsRepository,
      assetTypesRepository as unknown as AssetTypesRepository,
      categoriesRepository as unknown as AssetCategoriesRepository,
      locationsRepository as unknown as AssetLocationsRepository,
      rbacService as unknown as RbacService,
      prisma as unknown as PrismaService,
    );
  });

  it("throws ForbiddenException when RBAC denies", async () => {
    rbacService.can.mockResolvedValue(false);
    await expect(service.getAsset(ctx, "id")).rejects.toThrow("permission");
  });

  describe("createAsset", () => {
    it("rejects ASSIGNED initial lifecycle state", async () => {
      await expect(
        service.createAsset(ctx, {
          name: "MBP",
          assetTypeId: "33333333-3333-4333-8333-333333333333",
          lifecycleState: "ASSIGNED",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("creates an asset in DRAFT and returns it", async () => {
      assetTypesRepository.findById.mockResolvedValue({ id: "type-1" });
      assetsRepository.create.mockResolvedValue({ id: "asset-1", assetRef: "AST-000001" });
      const result = await service.createAsset(ctx, {
        name: "MBP 16",
        assetTypeId: "33333333-3333-4333-8333-333333333333",
      });
      expect(result).toEqual({ id: "asset-1", assetRef: "AST-000001" });
      expect(assetsRepository.create).toHaveBeenCalledWith(
        ctx.tenantId,
        expect.objectContaining({ name: "MBP 16" }),
        ctx.userId,
        expect.objectContaining({ action: "asset.created", targetType: "asset" }),
      );
    });
  });

  describe("transitionAsset", () => {
    it("rejects same-state transition with ConflictException", async () => {
      assetsRepository.findOne.mockResolvedValue({ lifecycleState: "DRAFT" });
      await expect(service.transitionAsset(ctx, "id", { lifecycleState: "DRAFT" })).rejects.toThrow(
        ConflictException,
      );
    });

    it("rejects invalid transition with BadRequestException", async () => {
      assetsRepository.findOne.mockResolvedValue({ lifecycleState: "DRAFT" });
      await expect(
        service.transitionAsset(ctx, "id", { lifecycleState: "RETIRED" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("transitions DRAFT -> IN_STOCK", async () => {
      assetsRepository.findOne.mockResolvedValue({ lifecycleState: "DRAFT" });
      assetsRepository.transition.mockResolvedValue({ lifecycleState: "IN_STOCK" });
      const result = await service.transitionAsset(ctx, "id", {
        lifecycleState: "IN_STOCK",
        comment: "received from vendor",
      });
      expect(result).toEqual({ lifecycleState: "IN_STOCK" });
      expect(assetsRepository.transition).toHaveBeenCalledWith(
        ctx.tenantId,
        "id",
        expect.objectContaining({ lifecycleState: "IN_STOCK" }),
        ctx.userId,
        expect.objectContaining({ action: "asset.lifecycle.changed" }),
      );
    });
  });

  describe("deleteAssetType", () => {
    it("rejects deleting system asset types", async () => {
      assetTypesRepository.findById.mockResolvedValue({ id: "type-1", isSystem: true });
      await expect(service.deleteAssetType(ctx, "type-1")).rejects.toThrow(BadRequestException);
    });

    it("rejects deleting an asset type still in use", async () => {
      assetTypesRepository.findById.mockResolvedValue({ id: "type-1", isSystem: false });
      assetTypesRepository.countAssetsUsing.mockResolvedValue(3);
      await expect(service.deleteAssetType(ctx, "type-1")).rejects.toThrow(ConflictException);
    });

    it("soft-deletes an unused custom asset type", async () => {
      assetTypesRepository.findById.mockResolvedValue({
        id: "type-1",
        isSystem: false,
        key: "x",
        name: "X",
      });
      assetTypesRepository.countAssetsUsing.mockResolvedValue(0);
      assetTypesRepository.softDelete.mockResolvedValue({ id: "type-1" });
      await service.deleteAssetType(ctx, "type-1");
      expect(assetTypesRepository.softDelete).toHaveBeenCalledWith(ctx.tenantId, "type-1");
      expect(prisma.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "asset.type.deleted",
          tenantId: ctx.tenantId,
        }) as unknown,
      });
    });
  });

  describe("createRelationship", () => {
    it("throws NotFoundException when source asset missing", async () => {
      assetsRepository.findOne.mockResolvedValue(null);
      await expect(
        service.createRelationship(ctx, "asset-1", {
          targetAssetId: "44444444-4444-4444-8444-444444444444",
          type: "DEPENDS_ON",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("creates a relationship for a valid source asset", async () => {
      assetsRepository.findOne.mockResolvedValue({ id: "asset-1" });
      assetsRepository.createRelationship.mockResolvedValue({
        id: "rel-1",
        type: "DEPENDS_ON",
      });
      const result = await service.createRelationship(ctx, "asset-1", {
        targetAssetId: "44444444-4444-4444-8444-444444444444",
        type: "DEPENDS_ON",
        note: "needs network",
      });
      expect(result).toEqual({ id: "rel-1", type: "DEPENDS_ON" });
      expect(assetsRepository.createRelationship).toHaveBeenCalledWith(
        ctx.tenantId,
        "asset-1",
        expect.objectContaining({ type: "DEPENDS_ON" }),
        ctx.userId,
        expect.objectContaining({ action: "asset.relationship.created" }),
      );
    });
  });

  describe("listAssets", () => {
    it("rejects invalid lifecycleState filter", async () => {
      await expect(
        service.listAssets(ctx, { lifecycleState: "BOGUS" as unknown as "ASSIGNED" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("delegates paginated search to the repository", async () => {
      assetsRepository.list.mockResolvedValue({ items: [], totalRecords: 0 });
      await service.listAssets(ctx, {
        q: "mbp",
        lifecycleState: "IN_STOCK",
        page: 2,
        pageSize: 10,
      });
      expect(assetsRepository.list).toHaveBeenCalledWith(ctx.tenantId, {
        page: 2,
        pageSize: 10,
        query: "mbp",
        lifecycleState: "IN_STOCK",
        assetTypeId: undefined,
        categoryId: undefined,
        locationId: undefined,
        assignedToUserId: undefined,
        ownerUserId: undefined,
      });
    });
  });
});
