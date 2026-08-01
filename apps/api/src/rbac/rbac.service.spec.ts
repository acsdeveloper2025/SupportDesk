import { RoleScope } from "@prisma/client";
import { describe, expect, it } from "vitest";

import type { RbacRepository } from "./rbac.repository";
import { RbacService } from "./rbac.service";

const tenantId = "11111111-1111-4111-8111-111111111111";
const actorUserId = "22222222-2222-4222-8222-222222222222";
const targetUserId = "33333333-3333-4333-8333-333333333333";
const roleId = "44444444-4444-4444-8444-444444444444";
const otherUserId = "55555555-5555-4555-8555-555555555555";
const groupId = "66666666-6666-4666-8666-666666666666";

class FakeRbacRepository implements RbacRepository {
  actorPermissions = new Set<string>();
  actorPermissionScopes = new Map<string, RoleScope[]>();
  assigned = false;
  rolePermissionKeys: string[] = [];
  roleTenantId: string | null = tenantId;
  targetIsMember = true;
  permissionExists = true;
  permissionGranted = false;

  hasPermission(tenantIdInput: string, _userId: string, permissionKey: string) {
    return Promise.resolve(tenantIdInput === tenantId && this.actorPermissions.has(permissionKey));
  }

  getPermissionScopes(tenantIdInput: string, _userId: string, permissionKey: string) {
    if (tenantIdInput !== tenantId || !this.actorPermissions.has(permissionKey)) {
      return Promise.resolve([]);
    }

    return Promise.resolve(this.actorPermissionScopes.get(permissionKey) ?? [RoleScope.TENANT]);
  }

  getRolePermissionKeys() {
    return Promise.resolve(this.rolePermissionKeys);
  }

  roleBelongsToTenant(roleIdInput: string, tenantIdInput: string) {
    return Promise.resolve(roleIdInput === roleId && this.roleTenantId === tenantIdInput);
  }

  userBelongsToTenant(userIdInput: string, tenantIdInput: string) {
    return Promise.resolve(userIdInput === targetUserId && tenantIdInput === tenantId);
  }

  assignRole() {
    this.assigned = true;

    return Promise.resolve();
  }

  frameworkPermissionExists() {
    return Promise.resolve(this.permissionExists);
  }

  grantRolePermission() {
    this.permissionGranted = true;

    return Promise.resolve();
  }

  recordAuditEvent() {
    return Promise.resolve();
  }
}

describe("RbacService", () => {
  it("denies missing permissions by default and never crosses tenants", async () => {
    const repository = new FakeRbacRepository();
    repository.actorPermissions.add("role.read");
    const service = new RbacService(repository);

    await expect(
      service.can({
        permissionKey: "role.read",
        tenantId,
        userId: actorUserId,
      }),
    ).resolves.toBe(true);
    await expect(
      service.can({
        permissionKey: "role.update",
        tenantId,
        userId: actorUserId,
      }),
    ).resolves.toBe(false);
    await expect(
      service.can({
        permissionKey: "role.read",
        tenantId: "55555555-5555-4555-8555-555555555555",
        userId: actorUserId,
      }),
    ).resolves.toBe(false);
  });

  it("evaluates own, group, and tenant scopes against a resource", async () => {
    const repository = new FakeRbacRepository();
    repository.actorPermissions.add("ticket.read");
    repository.actorPermissionScopes.set("ticket.read", [RoleScope.OWN]);
    const service = new RbacService(repository);

    await expect(
      service.can({
        permissionKey: "ticket.read",
        resource: {
          ownerUserId: actorUserId,
        },
        tenantId,
        userId: actorUserId,
      }),
    ).resolves.toBe(true);

    await expect(
      service.can({
        permissionKey: "ticket.read",
        resource: {
          ownerUserId: otherUserId,
        },
        tenantId,
        userId: actorUserId,
      }),
    ).resolves.toBe(false);

    repository.actorPermissionScopes.set("ticket.read", [RoleScope.GROUP]);
    await expect(
      service.can({
        permissionKey: "ticket.read",
        resource: {
          actorGroupIds: [groupId],
          groupId,
          ownerUserId: otherUserId,
        },
        tenantId,
        userId: actorUserId,
      }),
    ).resolves.toBe(true);

    await expect(
      service.can({
        permissionKey: "ticket.read",
        resource: {
          actorGroupIds: [],
          groupId,
          ownerUserId: otherUserId,
        },
        tenantId,
        userId: actorUserId,
      }),
    ).resolves.toBe(false);

    repository.actorPermissionScopes.set("ticket.read", [RoleScope.TENANT]);
    await expect(
      service.can({
        permissionKey: "ticket.read",
        resource: {
          ownerUserId: otherUserId,
        },
        tenantId,
        userId: actorUserId,
      }),
    ).resolves.toBe(true);
  });

  it("assigns a tenant role only when the actor can assign every permission it grants", async () => {
    const repository = new FakeRbacRepository();
    repository.actorPermissions.add("role.assign");
    repository.actorPermissions.add("role.read");
    repository.rolePermissionKeys = ["role.read"];
    const service = new RbacService(repository);

    await expect(
      service.assignRole({
        actorUserId,
        roleId,
        targetUserId,
        tenantId,
      }),
    ).resolves.toEqual({ status: "assigned" });
    expect(repository.assigned).toBe(true);
  });

  it("rejects cross-tenant or privilege-escalating role assignments", async () => {
    const repository = new FakeRbacRepository();
    repository.actorPermissions.add("role.assign");
    repository.rolePermissionKeys = ["settings.security.update"];
    const service = new RbacService(repository);

    await expect(
      service.assignRole({
        actorUserId,
        roleId,
        targetUserId,
        tenantId,
      }),
    ).resolves.toEqual({ status: "denied" });
    expect(repository.assigned).toBe(false);

    repository.actorPermissions.add("settings.security.update");
    repository.roleTenantId = "55555555-5555-4555-8555-555555555555";

    await expect(
      service.assignRole({
        actorUserId,
        roleId,
        targetUserId,
        tenantId,
      }),
    ).resolves.toEqual({ status: "denied" });
  });

  it("grants a role permission only when the actor holds the same stable permission", async () => {
    const repository = new FakeRbacRepository();
    repository.actorPermissions.add("role.update");
    repository.actorPermissions.add("settings.read");
    const service = new RbacService(repository);

    await expect(
      service.grantRolePermission({
        actorUserId,
        permissionKey: "settings.read",
        roleId,
        tenantId,
      }),
    ).resolves.toEqual({ status: "granted" });
    expect(repository.permissionGranted).toBe(true);

    repository.permissionGranted = false;
    repository.actorPermissions.delete("settings.read");

    await expect(
      service.grantRolePermission({
        actorUserId,
        permissionKey: "settings.read",
        roleId,
        tenantId,
      }),
    ).resolves.toEqual({ status: "denied" });
    expect(repository.permissionGranted).toBe(false);
  });
});
