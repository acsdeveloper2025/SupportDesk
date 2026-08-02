import { UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RbacService } from "../rbac/rbac.service";
import type { AdminService } from "./admin.service";
import { AuditAdminController } from "./audit-admin.controller";
import { OutboxAdminController } from "./outbox-admin.controller";
import { SystemHealthAdminController } from "./system-health-admin.controller";

describe("Admin RBAC & Tenant Isolation Security", () => {
  let auditController: AuditAdminController;
  let systemHealthController: SystemHealthAdminController;
  let adminService: AdminService;
  let rbacService: RbacService;

  const getSecurityDashboardMock = vi.fn().mockResolvedValue({ failedLogins: 0, accountLocks: 0 });
  const mockAdminService = {
    getSecurityDashboard: getSecurityDashboardMock,
    listAuditLogs: vi.fn().mockResolvedValue({ logs: [], total: 0 }),
    getOutboxStats: vi.fn().mockResolvedValue({ pendingCount: 0 }),
    replayOutboxEvent: vi.fn().mockResolvedValue({ id: "evt-1", state: "PENDING" }),
    getDetailedComponentHealth: vi.fn().mockResolvedValue({ status: "UP" }),
    runDiagnostics: vi.fn().mockResolvedValue([]),
  } as unknown as AdminService;

  beforeEach(() => {
    adminService = mockAdminService;
    rbacService = { can: vi.fn().mockResolvedValue(true) } as unknown as RbacService;
    auditController = new AuditAdminController(adminService);
    new OutboxAdminController(adminService, rbacService);
    systemHealthController = new SystemHealthAdminController(adminService);
  });

  const validReq = {
    user: { tenantId: "tenant-agent", userId: "agent-123" },
  } as unknown as Request;

  const invalidReq = {} as unknown as Request;

  it("should throw UnauthorizedException when request context is missing", async () => {
    await expect(auditController.getSecurityDashboard(invalidReq)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should get security dashboard when user is authenticated", async () => {
    const res = await auditController.getSecurityDashboard(validReq);
    expect(res).toBeDefined();
    expect(getSecurityDashboardMock).toHaveBeenCalledWith("tenant-agent");
  });

  it("should allow health endpoint access when user is authenticated", async () => {
    const health = await systemHealthController.getDetailedComponentHealth(validReq);
    expect(health).toBeDefined();
    expect(health.status).toBe("UP");
  });
});
