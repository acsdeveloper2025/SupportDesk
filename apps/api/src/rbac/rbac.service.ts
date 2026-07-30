import { Inject, Injectable } from "@nestjs/common";

import { RbacRepository } from "./rbac.repository";

export interface PermissionCheck {
  permissionKey: string;
  tenantId: string;
  userId: string;
}

export interface AssignRoleRequest {
  actorUserId: string;
  roleId: string;
  targetUserId: string;
  tenantId: string;
}

export interface GrantRolePermissionRequest {
  actorUserId: string;
  permissionKey: string;
  roleId: string;
  tenantId: string;
}

@Injectable()
export class RbacService {
  constructor(@Inject(RbacRepository) private readonly repository: RbacRepository) {}

  async can(input: PermissionCheck): Promise<boolean> {
    if (
      !uuidPattern.test(input.tenantId) ||
      !uuidPattern.test(input.userId) ||
      !permissionKeyPattern.test(input.permissionKey)
    ) {
      return false;
    }

    return this.repository.hasPermission(input.tenantId, input.userId, input.permissionKey);
  }

  async assignRole(
    input: AssignRoleRequest,
  ): Promise<{ status: "assigned" } | { status: "denied" }> {
    const canAssign = await this.can({
      permissionKey: "role.assign",
      tenantId: input.tenantId,
      userId: input.actorUserId,
    });
    const [roleBelongsToTenant, targetBelongsToTenant] = await Promise.all([
      this.repository.roleBelongsToTenant(input.roleId, input.tenantId),
      this.repository.userBelongsToTenant(input.targetUserId, input.tenantId),
    ]);

    if (!canAssign || !roleBelongsToTenant || !targetBelongsToTenant) {
      await this.auditAssignment(input, "DENIED", "ownership_or_authority_denied");

      return {
        status: "denied",
      };
    }

    const rolePermissionKeys = await this.repository.getRolePermissionKeys(
      input.tenantId,
      input.roleId,
    );
    const actorPermissionChecks = await Promise.all(
      rolePermissionKeys.map((permissionKey) =>
        this.can({
          permissionKey,
          tenantId: input.tenantId,
          userId: input.actorUserId,
        }),
      ),
    );

    if (actorPermissionChecks.some((allowed) => !allowed)) {
      await this.auditAssignment(input, "DENIED", "privilege_escalation_denied");

      return {
        status: "denied",
      };
    }

    await this.repository.assignRole(input);
    await this.auditAssignment(input, "SUCCESS", "assigned");

    return {
      status: "assigned",
    };
  }

  async grantRolePermission(
    input: GrantRolePermissionRequest,
  ): Promise<{ status: "granted" } | { status: "denied" }> {
    const [canUpdateRole, canGrantPermission, permissionExists, roleBelongsToTenant] =
      await Promise.all([
        this.can({
          permissionKey: "role.update",
          tenantId: input.tenantId,
          userId: input.actorUserId,
        }),
        this.can({
          permissionKey: input.permissionKey,
          tenantId: input.tenantId,
          userId: input.actorUserId,
        }),
        this.repository.frameworkPermissionExists(input.permissionKey),
        this.repository.roleBelongsToTenant(input.roleId, input.tenantId),
      ]);

    if (!canUpdateRole || !canGrantPermission || !permissionExists || !roleBelongsToTenant) {
      await this.repository.recordAuditEvent({
        action: "rbac.role_permission.assignment_rejected",
        actorUserId: input.actorUserId,
        metadata: {
          permissionKey: input.permissionKey,
          roleId: input.roleId,
        },
        outcome: "DENIED",
        tenantId: input.tenantId,
      });

      return {
        status: "denied",
      };
    }

    await this.repository.grantRolePermission(input.tenantId, input.roleId, input.permissionKey);
    await this.repository.recordAuditEvent({
      action: "rbac.role_permission.assigned",
      actorUserId: input.actorUserId,
      metadata: {
        permissionKey: input.permissionKey,
        roleId: input.roleId,
      },
      outcome: "SUCCESS",
      tenantId: input.tenantId,
    });

    return {
      status: "granted",
    };
  }

  private async auditAssignment(
    input: AssignRoleRequest,
    outcome: "DENIED" | "SUCCESS",
    reason: string,
  ): Promise<void> {
    await this.repository.recordAuditEvent({
      action: outcome === "SUCCESS" ? "rbac.role.assigned" : "rbac.role.assignment_rejected",
      actorUserId: input.actorUserId,
      metadata: {
        reason,
        roleId: input.roleId,
        targetUserId: input.targetUserId,
      },
      outcome,
      tenantId: input.tenantId,
    });
  }
}

const permissionKeyPattern = /^[a-z][a-z0-9]*(?:[._][a-z0-9]+)+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
