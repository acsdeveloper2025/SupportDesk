import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AppModule } from "../app.module";
import { cleanDatabase } from "../common/testing/clean-database";
import { PrismaService } from "../database/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import { AssetsRepository } from "./assets.repository";
import { AssetsService } from "./assets.service";

const databaseUrl = process.env.DATABASE_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration("Asset Management Integration Tests", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let assetsService: AssetsService;
  let assetsRepository: AssetsRepository;

  let tenant1Id: string;
  let tenant2Id: string;
  let user1Id: string;

  const ctx1 = () => ({ tenantId: tenant1Id, userId: user1Id });

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    assetsService = moduleRef.get(AssetsService);
    assetsRepository = moduleRef.get(AssetsRepository);
    const rbacService = moduleRef.get(RbacService);
    vi.spyOn(rbacService, "can").mockResolvedValue(true);
  });

  afterAll(async () => {
    if (prisma) {
      await cleanDatabase(prisma);
    }
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const t1 = await prisma.tenant.create({
      data: {
        name: `Asset Tenant 1 ${Date.now()}`,
        slug: `asset-tenant-1-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      },
    });
    tenant1Id = t1.id;
    const t2 = await prisma.tenant.create({
      data: {
        name: `Asset Tenant 2 ${Date.now()}`,
        slug: `asset-tenant-2-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      },
    });
    tenant2Id = t2.id;

    const user = await prisma.user.create({
      data: {
        email: `asset-user-${Date.now()}@example.com`,
        emailNormalized: `asset-user-${Date.now()}@example.com`,
        passwordHash: "hash",
        state: "ACTIVE",
      },
    });
    user1Id = user.id;
  });

  it("creates an asset with an auto-generated asset ref, history, audit, and outbox event", async () => {
    const hardware = await prisma.assetType.findFirstOrThrow({
      where: { key: "hardware", tenantId: null },
    });

    const asset = await assetsService.createAsset(ctx1(), {
      name: "MBP 16 2024 - Dev",
      assetTypeId: hardware.id,
      serialNumber: "SN-1234",
      lifecycleState: "DRAFT",
    });

    expect(asset.assetRef).toMatch(/^AST-\d{6}$/);
    expect(asset.lifecycleState).toBe("DRAFT");
    expect(asset.version).toBe(1);

    const history = await assetsRepository.listHistory(tenant1Id, asset.id);
    expect(history.some((h) => h.action === "asset.created")).toBe(true);

    const audit = await prisma.auditEvent.findFirst({ where: { tenantId: tenant1Id } });
    expect(audit?.action).toBe("asset.created");

    const outbox = await prisma.outboxEvent.findFirst({
      where: { tenantId: tenant1Id, eventType: "asset.created" },
    });
    expect(outbox).not.toBeNull();
  });

  it("walks the full lifecycle DRAFT -> IN_STOCK -> ASSIGNED -> IN_REPAIR -> IN_STOCK -> RETIRED", async () => {
    const hardware = await prisma.assetType.findFirstOrThrow({
      where: { key: "hardware", tenantId: null },
    });
    const asset = await assetsService.createAsset(ctx1(), {
      name: "Lifecycle Laptop",
      assetTypeId: hardware.id,
    });
    expect(asset.lifecycleState).toBe("DRAFT");

    const inStock = await assetsService.transitionAsset(ctx1(), asset.id, {
      lifecycleState: "IN_STOCK",
    });
    expect(inStock.lifecycleState).toBe("IN_STOCK");

    const assigned = await assetsService.assignAsset(ctx1(), asset.id, {
      kind: "USER",
      assignedToUserId: user1Id,
      reason: "issued to engineer",
    });
    expect(assigned.lifecycleState).toBe("ASSIGNED");
    expect(assigned.assignedUserId).toBe(user1Id);
    expect(assigned.assignedUser?.id).toBe(user1Id);

    const repair = await assetsService.transitionAsset(ctx1(), asset.id, {
      lifecycleState: "IN_REPAIR",
    });
    expect(repair.lifecycleState).toBe("IN_REPAIR");

    const back = await assetsService.transitionAsset(ctx1(), asset.id, {
      lifecycleState: "IN_STOCK",
    });
    expect(back.lifecycleState).toBe("IN_STOCK");

    const retired = await assetsService.transitionAsset(ctx1(), asset.id, {
      lifecycleState: "RETIRED",
      comment: "replaced by M4 model",
    });
    expect(retired.lifecycleState).toBe("RETIRED");

    const outbox = await prisma.outboxEvent.findMany({
      where: { tenantId: tenant1Id, aggregateId: asset.id },
      orderBy: { createdAt: "asc" },
    });
    expect(outbox.map((e) => e.eventType)).toContain("asset.status_changed");

    const assignments = await assetsService.getAssetAssignments(ctx1(), asset.id);
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.kind).toBe("USER");
    expect(assignments[0]?.assignedToUserId).toBe(user1Id);
  });

  it("rejects invalid lifecycle transitions", async () => {
    const hardware = await prisma.assetType.findFirstOrThrow({
      where: { key: "hardware", tenantId: null },
    });
    const asset = await assetsService.createAsset(ctx1(), {
      name: "Invalid Transition",
      assetTypeId: hardware.id,
    });
    await expect(
      assetsService.transitionAsset(ctx1(), asset.id, { lifecycleState: "RETIRED" }),
    ).rejects.toThrow(/not allowed/);
  });

  it("supports department and location assignments and unassignment", async () => {
    const hardware = await prisma.assetType.findFirstOrThrow({
      where: { key: "hardware", tenantId: null },
    });
    const location = await assetsService.createAssetLocation(ctx1(), { name: "HQ Floor 3" });
    const asset = await assetsService.createAsset(ctx1(), {
      name: "Printer",
      assetTypeId: hardware.id,
      lifecycleState: "IN_STOCK",
    });

    const dept = await assetsService.assignAsset(ctx1(), asset.id, {
      kind: "DEPARTMENT",
      assignedDepartment: "Finance",
      reason: "shared printer",
    });
    expect(dept.assignedDepartment).toBe("Finance");

    const loc = await assetsService.assignAsset(ctx1(), asset.id, {
      kind: "LOCATION",
      assignedLocationId: location.id,
      transitionLifecycle: false,
    });
    expect(loc.locationId).toBe(location.id);

    const unassigned = await assetsService.unassignAsset(ctx1(), asset.id);
    expect(unassigned.assignedDepartment).toBeNull();
    expect(unassigned.assignedUserId).toBeNull();

    const history = await assetsRepository.listHistory(tenant1Id, asset.id);
    expect(history.map((h) => h.action)).toEqual(
      expect.arrayContaining(["asset.assigned", "asset.unassigned"]),
    );
  });

  it("enforces tenant isolation for assets, types, and locations", async () => {
    const hardware = await prisma.assetType.findFirstOrThrow({
      where: { key: "hardware", tenantId: null },
    });
    const asset = await assetsService.createAsset(ctx1(), {
      name: "Tenant Secret Asset",
      assetTypeId: hardware.id,
      serialNumber: "SN-ISOLATED",
    });

    const t2Ctx = { tenantId: tenant2Id, userId: user1Id };
    await expect(assetsService.getAsset(t2Ctx, asset.id)).rejects.toThrow(/not found/);

    const listT2 = await assetsService.listAssets(t2Ctx, {});
    expect(listT2.totalRecords).toBe(0);

    const t2Type = await assetsService.createAssetType(t2Ctx, {
      key: "custom_device",
      name: "Custom Device",
    });
    const t1Types = await assetsService.listAssetTypes(ctx1(), { customOnly: true });
    expect(t1Types.items.every((t) => t.id !== t2Type.id)).toBe(true);
  });

  it("links tickets, creates tickets from assets, and lists both directions", async () => {
    const hardware = await prisma.assetType.findFirstOrThrow({
      where: { key: "hardware", tenantId: null },
    });
    const asset = await assetsService.createAsset(ctx1(), {
      name: "Server-01",
      assetTypeId: hardware.id,
    });

    const ticket = await prisma.ticket.create({
      data: {
        tenantId: tenant1Id,
        publicRef: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
        title: "Server down",
        description: "no response",
        status: "NEW",
        priority: "HIGH",
        channel: "WEB",
        type: "INCIDENT",
        requesterUserId: user1Id,
        version: 1,
      },
    });

    const link = await assetsService.linkTicket(ctx1(), asset.id, ticket.id);
    expect(link.assetId).toBe(asset.id);
    expect(link.ticketId).toBe(ticket.id);

    const tickets = await assetsService.listTicketsForAsset(ctx1(), asset.id);
    expect(tickets).toHaveLength(1);

    const created = await assetsService.createTicketFromAsset(ctx1(), asset.id, {
      title: "New ticket from asset",
      description: "created via CMDB",
      priority: "MEDIUM",
      type: "INCIDENT",
    });
    expect(created.ticket.publicRef).toMatch(/^TKT-/);

    const ticketsAfter = await assetsService.listTicketsForAsset(ctx1(), asset.id);
    expect(ticketsAfter).toHaveLength(2);

    await assetsService.unlinkTicket(ctx1(), asset.id, ticket.id);
    const ticketsAfterUnlink = await assetsService.listTicketsForAsset(ctx1(), asset.id);
    expect(ticketsAfterUnlink).toHaveLength(1);
  });

  it("manages parent-child and depends-on relationships with cycle guard", async () => {
    const server = await prisma.assetType.findFirstOrThrow({
      where: { key: "server", tenantId: null },
    });
    const network = await prisma.assetType.findFirstOrThrow({
      where: { key: "network_device", tenantId: null },
    });
    const parent = await assetsService.createAsset(ctx1(), {
      name: "Parent Server",
      assetTypeId: server.id,
    });
    const child = await assetsService.createAsset(ctx1(), {
      name: "VM Child",
      assetTypeId: server.id,
    });
    const switchDevice = await assetsService.createAsset(ctx1(), {
      name: "Top-of-rack Switch",
      assetTypeId: network.id,
    });

    const rel = await assetsService.createRelationship(ctx1(), parent.id, {
      targetAssetId: child.id,
      type: "PARENT_CHILD",
      note: "hosts VM",
    });
    expect(rel.type).toBe("PARENT_CHILD");

    await assetsService.createRelationship(ctx1(), child.id, {
      targetAssetId: switchDevice.id,
      type: "CONNECTED_TO",
    });

    await expect(
      assetsService.createRelationship(ctx1(), child.id, {
        targetAssetId: parent.id,
        type: "PARENT_CHILD",
      }),
    ).rejects.toThrow(/cycle/);

    const graph = await assetsService.listRelationships(ctx1(), parent.id);
    expect(graph.outgoing.some((r) => r.targetAssetId === child.id)).toBe(true);
    expect(graph.incoming).toHaveLength(0);

    const incoming = await assetsService.listRelationships(ctx1(), child.id);
    expect(incoming.incoming.some((r) => r.sourceAssetId === parent.id)).toBe(true);
  });

  it("links KB articles to asset types", async () => {
    const type = await assetsService.createAssetType(ctx1(), {
      key: "custom_router",
      name: "Custom Router",
    });
    const kbCategory = await prisma.kbCategory.create({
      data: {
        tenantId: tenant1Id,
        name: `Networking ${Date.now()}`,
        slug: `networking-${Date.now()}`,
      },
    });
    const article = await prisma.kbArticle.create({
      data: {
        tenantId: tenant1Id,
        categoryId: kbCategory.id,
        title: `Router guide ${Date.now()}`,
        slug: `router-guide-${Date.now()}`,
        summary: "setup",
        content: "steps",
        status: "PUBLISHED",
        authorId: user1Id,
        publishedAt: new Date(),
        versionNumber: 1,
      },
    });

    const link = await assetsService.linkAssetTypeKb(ctx1(), type.id, article.id);
    expect(link.assetTypeId).toBe(type.id);

    const links = await assetsService.listKbForAssetType(ctx1(), type.id);
    expect(links).toHaveLength(1);

    await assetsService.unlinkAssetTypeKb(ctx1(), type.id, article.id);
    expect(await assetsService.listKbForAssetType(ctx1(), type.id)).toHaveLength(0);
  });

  it("searches assets by name, tag, serial, and barcode with filters", async () => {
    const hardware = await prisma.assetType.findFirstOrThrow({
      where: { key: "hardware", tenantId: null },
    });
    await assetsService.createAsset(ctx1(), {
      name: "MacBook Air M3",
      assetTypeId: hardware.id,
      assetTag: "TAG-MBA3",
      serialNumber: "SER-MBA3-001",
      lifecycleState: "IN_STOCK",
    });
    await assetsService.createAsset(ctx1(), {
      name: "Dell Monitor",
      assetTypeId: hardware.id,
      barcode: "BARCODE-DELL-77",
      lifecycleState: "IN_STOCK",
    });
    await assetsService.createAsset(ctx1(), {
      name: "Office Chair",
      assetTypeId: hardware.id,
      lifecycleState: "DRAFT",
    });

    const byName = await assetsService.listAssets(ctx1(), { q: "MacBook" });
    expect(byName.totalRecords).toBe(1);
    expect(byName.items[0]?.name).toBe("MacBook Air M3");

    const byTag = await assetsService.listAssets(ctx1(), { q: "TAG-MBA3" });
    expect(byTag.totalRecords).toBe(1);

    const byBarcode = await assetsService.listAssets(ctx1(), { q: "BARCODE-DELL" });
    expect(byBarcode.totalRecords).toBe(1);

    const byState = await assetsService.listAssets(ctx1(), { lifecycleState: "IN_STOCK" });
    expect(byState.totalRecords).toBe(2);

    const byType = await assetsService.listAssets(ctx1(), { assetTypeId: hardware.id });
    expect(byType.totalRecords).toBe(3);

    const none = await assetsService.listAssets(ctx1(), { q: "does-not-exist-xyz" });
    expect(none.totalRecords).toBe(0);
  });

  it("bumps version on update and records history", async () => {
    const hardware = await prisma.assetType.findFirstOrThrow({
      where: { key: "hardware", tenantId: null },
    });
    const asset = await assetsService.createAsset(ctx1(), {
      name: "Versioned Laptop",
      assetTypeId: hardware.id,
    });
    const updated = await assetsService.updateAsset(ctx1(), asset.id, {
      notes: "new notes",
      manufacturer: "Apple",
    });
    expect(updated.version).toBe(2);

    const history = await assetsRepository.listHistory(tenant1Id, asset.id);
    expect(history.some((h) => h.action === "asset.updated")).toBe(true);
  });

  it("soft-deletes assets and hides them from lists", async () => {
    const hardware = await prisma.assetType.findFirstOrThrow({
      where: { key: "hardware", tenantId: null },
    });
    const asset = await assetsService.createAsset(ctx1(), {
      name: "Doomed Laptop",
      assetTypeId: hardware.id,
    });

    await assetsService.deleteAsset(ctx1(), asset.id);

    await expect(assetsService.getAsset(ctx1(), asset.id)).rejects.toThrow(/not found/);
    const list = await assetsService.listAssets(ctx1(), {});
    expect(list.totalRecords).toBe(0);

    const history = await assetsRepository.listHistory(tenant1Id, asset.id);
    expect(history.some((h) => h.action === "asset.deleted")).toBe(true);
  });

  it("creates custom asset types with custom field schemas", async () => {
    const type = await assetsService.createAssetType(ctx1(), {
      key: "lab_device",
      name: "Lab Device",
      customFieldsSchema: [{ key: "calibrationDue", label: "Calibration Due", type: "DATE" }],
    });
    expect(type.isSystem).toBe(false);

    await expect(
      assetsService.createAssetType(ctx1(), {
        key: "lab_device",
        name: "Lab Device 2",
      }),
    ).rejects.toThrow(/already exists/);
  });

  it("returns lifecycle summary counts", async () => {
    const hardware = await prisma.assetType.findFirstOrThrow({
      where: { key: "hardware", tenantId: null },
    });
    await assetsService.createAsset(ctx1(), {
      name: "A",
      assetTypeId: hardware.id,
      lifecycleState: "IN_STOCK",
    });
    await assetsService.createAsset(ctx1(), {
      name: "B",
      assetTypeId: hardware.id,
      lifecycleState: "IN_STOCK",
    });
    await assetsService.createAsset(ctx1(), {
      name: "C",
      assetTypeId: hardware.id,
      lifecycleState: "DRAFT",
    });

    const summary = await assetsService.getLifecycleSummary(ctx1());
    const byState = Object.fromEntries(summary.map((row) => [row.lifecycleState, row._count._all]));
    expect(byState["IN_STOCK"]).toBe(2);
    expect(byState["DRAFT"]).toBe(1);
  });
});
