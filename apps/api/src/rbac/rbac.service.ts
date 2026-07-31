import { Inject, Injectable } from "@nestjs/common";
import { RoleScope } from "@prisma/client";

import { RbacRepository } from "./rbac.repository";

export type PermissionScope = "own" | "group" | "tenant" | "organization" | "platform";

export interface ResourceScopeContext {
  /** Resource owner / requester user id (OWN scope). */
  ownerUserId?: string | null;
  /** Assigned agent user id (OWN scope for assignee). */
  assigneeUserId?: string | null;
  /** Assigned group id (GROUP scope). */
  groupId?: string | null;
  /** Actor group memberships used for GROUP scope evaluation. */
  actorGroupIds?: readonly string[];
}

export interface PermissionCheck {
  permissionKey: string;
  tenantId: string;
  userId: string;
  /** When provided, grant scopes are evaluated against the resource. */
  resource?: ResourceScopeContext;
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
  scope?: RoleScope;
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

    const scopes = await this.repository.getPermissionScopes(
      input.tenantId,
      input.userId,
      input.permissionKey,
    );

    if (scopes.length === 0) {
      return false;
    }

    if (!input.resource) {
      return true;
    }

    return scopes.some((scope) => this.scopeAllows(scope, input.userId, input.resource!));
  }

  /**
   * Returns the broadest ticket-list filter implied by the actor's scopes for a permission.
   * `null` means tenant-wide access; otherwise callers should apply the returned filter.
   */
  async resolveListScopeFilter(
    input: Omit<PermissionCheck, "resource">,
  ): Promise<{ requesterOrAssigneeUserId?: string; assignedGroupIds?: string[] } | null | false> {
    if (
      !uuidPattern.test(input.tenantId) ||
      !uuidPattern.test(input.userId) ||
      !permissionKeyPattern.test(input.permissionKey)
    ) {
      return false;
    }

    const scopes = await this.repository.getPermissionScopes(
      input.tenantId,
      input.userId,
      input.permissionKey,
    );

    if (scopes.length === 0) {
      return false;
    }

    if (scopes.includes(RoleScope.TENANT) || scopes.includes(RoleScope.PLATFORM)) {
      return null;
    }

    const filter: { requesterOrAssigneeUserId?: string; assignedGroupIds?: string[] } = {};

    if (scopes.includes(RoleScope.OWN)) {
      filter.requesterOrAssigneeUserId = input.userId;
    }

    if (scopes.includes(RoleScope.GROUP)) {
      // Group membership catalogue is not yet persisted; empty means no group-visible rows.
      filter.assignedGroupIds = [];
    }

    if (!filter.requesterOrAssigneeUserId && !filter.assignedGroupIds) {
      return false;
    }

    return filter;
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

    await this.repository.grantRolePermission(
      input.tenantId,
      input.roleId,
      input.permissionKey,
      input.scope ?? RoleScope.TENANT,
    );
    await this.repository.recordAuditEvent({
      action: "rbac.role_permission.assigned",
      actorUserId: input.actorUserId,
      metadata: {
        permissionKey: input.permissionKey,
        roleId: input.roleId,
        scope: input.scope ?? RoleScope.TENANT,
      },
      outcome: "SUCCESS",
      tenantId: input.tenantId,
    });

    return {
      status: "granted",
    };
  }

  private scopeAllows(
    scope: RoleScope,
    actorUserId: string,
    resource: ResourceScopeContext,
  ): boolean {
    switch (scope) {
      case RoleScope.TENANT:
      case RoleScope.PLATFORM:
        return true;
      case RoleScope.OWN:
        return resource.ownerUserId === actorUserId || resource.assigneeUserId === actorUserId;
      case RoleScope.GROUP: {
        if (!resource.groupId) {
          return false;
        }
        return (resource.actorGroupIds ?? []).includes(resource.groupId);
      }
      case RoleScope.ORGANIZATION:
        // Organization membership is not yet modeled; fail closed.
        return false;
      default:
        return false;
    }
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
