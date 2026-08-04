import { UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RbacService } from "../rbac/rbac.service";
import type { AdminService } from "./admin.service";
import { GlobalAdminController } from "./global-admin.controller";
import { TenantAdminController } from "./tenant-admin.controller";

describe("AdminControllers", () => {
  let globalController: GlobalAdminController;
  let tenantController: TenantAdminController;
  let adminService: AdminService;

  const getGlobalSettingsMock = vi
    .fn()
    .mockResolvedValue([{ key: "site_name", value: { text: "SupportDesk" } }]);
  const listTenantsMock = vi.fn().mockResolvedValue({ tenants: [], total: 0 });
  const transitionTenantStateMock = vi
    .fn()
    .mockResolvedValue({ id: "tenant-1", state: "SUSPENDED" });

  const mockAdminService = {
    getGlobalSettings: getGlobalSettingsMock,
    updateGlobalSetting: vi
      .fn()
      .mockResolvedValue({ key: "site_name", value: { text: "SupportDesk" } }),
    listTenants: listTenantsMock,
    getTenantDetails: vi.fn().mockResolvedValue({ id: "tenant-1", name: "Acme" }),
    transitionTenantState: transitionTenantStateMock,
  } as unknown as AdminService;

  const mockRbac = {
    can: vi.fn().mockResolvedValue(true),
  } as unknown as RbacService;

  beforeEach(() => {
    adminService = mockAdminService;
    globalController = new GlobalAdminController(adminService, mockRbac);
    tenantController = new TenantAdminController(adminService, mockRbac);
  });

  const validReq = {
    auth: { tenantId: "tenant-1", userId: "user-1" },
  } as unknown as Request;

  const invalidReq = {} as unknown as Request;

  it("should throw UnauthorizedException when request context is missing", async () => {
    await expect(globalController.getGlobalSettings(invalidReq)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should get global settings when authorized", async () => {
    const result = await globalController.getGlobalSettings(validReq);
    expect(result).toBeDefined();
    expect(getGlobalSettingsMock).toHaveBeenCalled();
  });

  it("should list tenants when authorized", async () => {
    const result = await tenantController.listTenants(validReq);
    expect(result).toBeDefined();
    expect(listTenantsMock).toHaveBeenCalled();
  });

  it("should suspend tenant when authorized", async () => {
    const result = await tenantController.suspendTenant(validReq, "tenant-1");
    expect(result).toBeDefined();
    expect(transitionTenantStateMock).toHaveBeenCalledWith("user-1", "tenant-1", "SUSPENDED", {
      userId: "user-1",
      tenantId: "tenant-1",
    });
  });
});
