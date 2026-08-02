import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../database/prisma.service";
import type { RbacService } from "../rbac/rbac.service";
import { AdminService } from "./admin.service";

describe("AdminService", () => {
  let service: AdminService;

  const globalSettingFindMany = vi.fn().mockResolvedValue([]);
  const globalSettingUpsert = vi
    .fn()
    .mockImplementation((args: { where: { key: string }; update: Record<string, unknown> }) =>
      Promise.resolve({ key: args.where.key, ...args.update }),
    );
  const featureFlagFindMany = vi.fn().mockResolvedValue([]);
  const featureFlagUpsert = vi
    .fn()
    .mockImplementation((args: { update: Record<string, unknown> }) =>
      Promise.resolve({ id: "flag-1", ...args.update }),
    );
  const systemMaintenanceWindowFindMany = vi.fn().mockResolvedValue([]);
  const systemMaintenanceWindowCreate = vi
    .fn()
    .mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "mw-1", ...args.data }),
    );
  const tenantFindMany = vi.fn().mockResolvedValue([]);
  const tenantCount = vi.fn().mockResolvedValue(0);
  const tenantFindUnique = vi
    .fn()
    .mockResolvedValue({ id: "tenant-1", name: "Acme Corp", slug: "acme", state: "ACTIVE" });
  const tenantFindFirst = vi.fn().mockResolvedValue(null);
  const tenantCreate = vi
    .fn()
    .mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "tenant-1", state: "ACTIVE", ...args.data }),
    );
  const tenantUpdate = vi
    .fn()
    .mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "tenant-1", name: "Acme", ...args.data }),
    );

  const tenantSettingUpsert = vi.fn().mockResolvedValue({});
  const tenantDomainFindMany = vi.fn().mockResolvedValue([]);
  const tenantDomainCreate = vi.fn().mockResolvedValue({ id: "domain-1" });
  const tenantDomainDelete = vi.fn().mockResolvedValue({});

  const userFindMany = vi.fn().mockResolvedValue([]);
  const userCount = vi.fn().mockResolvedValue(0);
  const userFindUnique = vi
    .fn()
    .mockResolvedValue({ id: "user-1", emailNormalized: "test@test.com" });
  const userCreate = vi.fn().mockResolvedValue({ id: "user-1" });
  const userUpdate = vi.fn().mockResolvedValue({ id: "user-1" });

  const tenantUserCreate = vi.fn().mockResolvedValue({});
  const tenantUserFindMany = vi.fn().mockResolvedValue([]);
  const tenantUserDelete = vi.fn().mockResolvedValue({});

  const auditEventCreate = vi.fn().mockResolvedValue({ id: "audit-1" });
  const auditEventFindMany = vi.fn().mockResolvedValue([]);
  const auditEventCount = vi.fn().mockResolvedValue(0);

  const sessionFindMany = vi.fn().mockResolvedValue([]);
  const sessionUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
  const refreshTokenUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
  const authTokenCreate = vi.fn().mockResolvedValue({ tokenHash: "hash" });
  const authTokenUpdateMany = vi.fn().mockResolvedValue({ count: 1 });

  const queryRaw = vi.fn().mockResolvedValue([{ count: 5n }]);

  const mockPrisma = {
    globalSetting: { findMany: globalSettingFindMany, upsert: globalSettingUpsert },
    featureFlag: { findMany: featureFlagFindMany, upsert: featureFlagUpsert },
    systemMaintenanceWindow: {
      findMany: systemMaintenanceWindowFindMany,
      create: systemMaintenanceWindowCreate,
    },
    tenant: {
      findMany: tenantFindMany,
      count: tenantCount,
      findUnique: tenantFindUnique,
      findFirst: tenantFindFirst,
      create: tenantCreate,
      update: tenantUpdate,
    },
    tenantSetting: { upsert: tenantSettingUpsert },
    tenantDomain: {
      findMany: tenantDomainFindMany,
      create: tenantDomainCreate,
      delete: tenantDomainDelete,
    },
    user: {
      findMany: userFindMany,
      count: userCount,
      findUnique: userFindUnique,
      create: userCreate,
      update: userUpdate,
    },
    tenantUser: {
      create: tenantUserCreate,
      findMany: tenantUserFindMany,
      delete: tenantUserDelete,
    },
    auditEvent: {
      create: auditEventCreate,
      findMany: auditEventFindMany,
      count: auditEventCount,
    },
    session: { findMany: sessionFindMany, updateMany: sessionUpdateMany },
    refreshToken: { updateMany: refreshTokenUpdateMany },
    authToken: { create: authTokenCreate, updateMany: authTokenUpdateMany },
    $queryRaw: queryRaw,
  } as unknown as PrismaService;

  const mockRbac = {
    can: vi.fn().mockResolvedValue(true),
  } as unknown as RbacService;

  beforeEach(() => {
    service = new AdminService(mockPrisma, mockRbac);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should return global settings", async () => {
    const settings = await service.getGlobalSettings();
    expect(settings).toBeDefined();
    expect(globalSettingFindMany).toHaveBeenCalled();
  });

  it("should update a global setting and record audit event", async () => {
    const res = await service.updateGlobalSetting("actor-1", {
      key: "theme",
      value: { mode: "dark" },
    });
    expect(res).toBeDefined();
    expect(auditEventCreate).toHaveBeenCalled();
  });

  it("should list tenants", async () => {
    const res = await service.listTenants("acme");
    expect(res.tenants).toBeDefined();
    expect(res.total).toBe(0);
  });

  it("should transition tenant lifecycle state", async () => {
    const res = await service.transitionTenantState("actor-1", "tenant-1", "SUSPENDED");
    expect(res).toBeDefined();
    expect(tenantUpdate).toHaveBeenCalledWith({
      where: { id: "tenant-1" },
      data: { state: "SUSPENDED" },
    });
  });

  it("should return system health status summary", async () => {
    const health = await service.getDetailedComponentHealth();
    expect(health.status).toBe("UP");
    expect(health.components.database.status).toBe("UP");
  });

  it("should run diagnostics without error", async () => {
    const diags = await service.runDiagnostics();
    expect(Array.isArray(diags)).toBe(true);
    expect(diags.length).toBeGreaterThan(0);
  });
});
