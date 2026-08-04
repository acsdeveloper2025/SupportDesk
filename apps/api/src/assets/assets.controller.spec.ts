import type { Request } from "express";
import { describe, expect, it, vi } from "vitest";

import type { RbacService } from "../rbac/rbac.service";
import { AssetsController } from "./assets.controller";
import type { AssetsService } from "./assets.service";

const request = {
  auth: {
    email: "agent@acme.com",
    emailNormalized: "agent@acme.com",
    emailVerified: true,
    passwordChangeRequired: false,
    permissions: [],
    preferences: {},
    profile: {},
    publicId: "user-public-id",
    roles: [],
    sessionId: "session-1",
    tenantId: "tenant-1",
    userId: "user-1",
  },
} as unknown as Request;

describe("AssetsController", () => {
  it("passes the q search query through to the assets service", async () => {
    const listAssets = vi.fn().mockResolvedValue({ items: [], totalRecords: 0 });
    const assetsService = {
      listAssets,
    } as unknown as AssetsService;
    const rbacService = {
      can: vi.fn().mockResolvedValue(true),
    } as unknown as RbacService;
    const controller = new AssetsController(assetsService, rbacService);

    await controller.list(request, "2", "10", "macbook", "IN_STOCK");

    expect(listAssets).toHaveBeenCalledWith(
      { tenantId: "tenant-1", userId: "user-1" },
      expect.objectContaining({
        lifecycleState: "IN_STOCK",
        page: 2,
        pageSize: 10,
        q: "macbook",
      }),
    );
  });
});
