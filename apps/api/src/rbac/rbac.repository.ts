import { Inject, Injectable } from "@nestjs/common";
import { AuditOutcome, Prisma, RoleScope } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";

export interface AssignRoleRecord {
  actorUserId: string;
  roleId: string;
  targetUserId: string;
  tenantId: string;
}

export interface RbacAuditInput {
  action: string;
  actorUserId: string;
  metadata?: Record<string, unknown>;
  outcome: keyof typeof AuditOutcome;
  tenantId: string;
}

export abstract class RbacRepository {
  abstract hasPermission(tenantId: string, userId: string, permissionKey: string): Promise<boolean>;

  abstract getRolePermissionKeys(tenantId: string, roleId: string): Promise<string[]>;

  abstract roleBelongsToTenant(roleId: string, tenantId: string): Promise<boolean>;

  abstract userBelongsToTenant(userId: string, tenantId: string): Promise<boolean>;

  abstract assignRole(input: AssignRoleRecord): Promise<void>;

  abstract frameworkPermissionExists(permissionKey: string): Promise<boolean>;

  abstract grantRolePermission(
    tenantId: string,
    roleId: string,
    permissionKey: string,
  ): Promise<void>;

  abstract recordAuditEvent(input: RbacAuditInput): Promise<void>;
}

@Injectable()
export class PrismaRbacRepository implements RbacRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async hasPermission(tenantId: string, userId: string, permissionKey: string): Promise<boolean> {
    const grant = await this.prisma.rolePermission.findFirst({
      select: {
        id: true,
      },
      where: {
        permission: {
          key: permissionKey,
        },
        role: {
          deletedAt: null,
          userRoles: {
            some: {
              revokedAt: null,
              tenantId,
              userId,
            },
          },
        },
        tenantId,
      },
    });

    return grant !== null;
  }

  async getRolePermissionKeys(tenantId: string, roleId: string): Promise<string[]> {
    const grants = await this.prisma.rolePermission.findMany({
      select: {
        permission: {
          select: {
            key: true,
          },
        },
      },
      where: {
        roleId,
        tenantId,
      },
    });

    return grants.map((grant) => grant.permission.key);
  }

  async roleBelongsToTenant(roleId: string, tenantId: string): Promise<boolean> {
    return (
      (await this.prisma.role.count({
        where: {
          deletedAt: null,
          id: roleId,
          tenantId,
        },
      })) === 1
    );
  }

  async userBelongsToTenant(userId: string, tenantId: string): Promise<boolean> {
    return (
      (await this.prisma.userRole.count({
        where: {
          revokedAt: null,
          tenantId,
          userId,
        },
      })) > 0
    );
  }

  async assignRole(input: AssignRoleRecord): Promise<void> {
    await this.prisma.userRole.upsert({
      create: {
        assignedBy: input.actorUserId,
        roleId: input.roleId,
        tenantId: input.tenantId,
        userId: input.targetUserId,
      },
      update: {
        assignedAt: new Date(),
        assignedBy: input.actorUserId,
        revokedAt: null,
      },
      where: {
        tenantId_userId_roleId: {
          roleId: input.roleId,
          tenantId: input.tenantId,
          userId: input.targetUserId,
        },
      },
    });
  }

  async frameworkPermissionExists(permissionKey: string): Promise<boolean> {
    return (
      (await this.prisma.permission.count({
        where: {
          isSystem: true,
          key: permissionKey,
        },
      })) === 1
    );
  }

  async grantRolePermission(
    tenantId: string,
    roleId: string,
    permissionKey: string,
  ): Promise<void> {
    const permission = await this.prisma.permission.findUniqueOrThrow({
      select: {
        id: true,
      },
      where: {
        key: permissionKey,
      },
    });

    await this.prisma.rolePermission.upsert({
      create: {
        permissionId: permission.id,
        roleId,
        scope: RoleScope.TENANT,
        tenantId,
      },
      update: {},
      where: {
        tenantId_roleId_permissionId_scope: {
          permissionId: permission.id,
          roleId,
          scope: RoleScope.TENANT,
          tenantId,
        },
      },
    });
  }

  async recordAuditEvent(input: RbacAuditInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        action: input.action,
        actorUserId: input.actorUserId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        outcome: AuditOutcome[input.outcome],
        tenantId: input.tenantId,
      },
    });
  }
}
