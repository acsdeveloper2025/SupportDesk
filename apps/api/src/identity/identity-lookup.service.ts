import { Inject, Injectable } from "@nestjs/common";
import { TenantDomainState, TenantState, UserState } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type {
  AuthTenantContext,
  TenantLookupInput,
  TenantResolution,
  TenantUserIdentity,
  TenantUserIdentityInput,
  TenantUserIdentityResolution,
} from "./identity.types";

interface IdentityLookupPrisma {
  tenant: {
    findFirst(args: Record<string, unknown>): Promise<TenantRecord | null>;
  };
  tenantDomain: {
    findFirst(args: Record<string, unknown>): Promise<TenantDomainRecord | null>;
  };
  user: {
    findFirst(args: Record<string, unknown>): Promise<UserRecord | null>;
  };
}

interface TenantSettingRecord {
  namespace: string;
  settings: unknown;
}

interface TenantRecord {
  id: string;
  publicId: string;
  slug: string;
  name: string;
  defaultLocale: string;
  defaultTimeZone: string;
  registrationEnabled: boolean;
  failedLoginLockoutThreshold: number;
  failedLoginWindowMinutes: number;
  lockoutDurationMinutes: number;
  passwordExpiresDays: number | null;
  settings?: TenantSettingRecord[];
}

interface TenantDomainRecord {
  tenant: TenantRecord;
}

interface UserProfileRecord {
  displayName: string | null;
  firstName: string | null;
  language: string;
  lastName: string | null;
  locale: string;
  profilePicturePlaceholder: string | null;
  timeZone: string;
}

interface UserPreferenceRecord {
  preferences: unknown;
}

interface RolePermissionRecord {
  permission: {
    key: string;
  };
  scope: string;
}

interface UserRoleRecord {
  role: {
    id: string;
    key: string;
    name: string;
    rolePermissions: RolePermissionRecord[];
  };
}

interface UserRecord {
  id: string;
  publicId: string;
  email: string;
  emailNormalized: string;
  emailVerifiedAt: Date | null;
  profile: UserProfileRecord | null;
  preferences: UserPreferenceRecord | null;
  roles: UserRoleRecord[];
}

const unavailable = {
  status: "unavailable",
} as const;

const activeTenantFilter = {
  deletedAt: null,
  state: TenantState.ACTIVE,
} as const;

const tenantInclude = {
  settings: {
    orderBy: [
      {
        namespace: "asc",
      },
      {
        version: "desc",
      },
    ],
    where: {
      isActive: true,
    },
  },
} as const;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class IdentityLookupService {
  constructor(@Inject(PrismaService) private readonly prisma: IdentityLookupPrisma) {}

  async resolveTenant(input: TenantLookupInput): Promise<TenantResolution> {
    const slug = normalizeToken(input.slug);

    if (slug) {
      const tenant = await this.prisma.tenant.findFirst({
        include: tenantInclude,
        where: {
          ...activeTenantFilter,
          slug,
        },
      });

      return tenant ? { status: "found", tenant: this.toTenantContext(tenant) } : unavailable;
    }

    const domain = normalizeToken(input.domain);

    if (domain) {
      const tenantDomain = await this.prisma.tenantDomain.findFirst({
        include: {
          tenant: {
            include: tenantInclude,
          },
        },
        where: {
          domain,
          state: TenantDomainState.VERIFIED,
          tenant: activeTenantFilter,
        },
      });

      return tenantDomain
        ? { status: "found", tenant: this.toTenantContext(tenantDomain.tenant) }
        : unavailable;
    }

    const tenantId = normalizeUuid(input.tenantId);

    if (tenantId) {
      return this.resolveTenantByUniqueField("id", tenantId);
    }

    const publicId = normalizeUuid(input.publicId);

    if (publicId) {
      return this.resolveTenantByUniqueField("publicId", publicId);
    }

    return unavailable;
  }

  async loadTenantUserIdentity(
    input: TenantUserIdentityInput,
  ): Promise<TenantUserIdentityResolution> {
    const tenantId = normalizeUuid(input.tenantId);

    if (!tenantId) {
      return unavailable;
    }

    const userSelector = this.createUserSelector(input);

    if (!userSelector) {
      return unavailable;
    }

    const user = await this.prisma.user.findFirst({
      include: {
        preferences: true,
        profile: true,
        roles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                  where: {
                    tenantId,
                  },
                },
              },
            },
          },
          where: {
            revokedAt: null,
            role: {
              deletedAt: null,
            },
            tenantId,
          },
        },
      },
      where: {
        ...userSelector,
        deletedAt: null,
        roles: {
          some: {
            revokedAt: null,
            role: {
              deletedAt: null,
            },
            tenantId,
          },
        },
        state: UserState.ACTIVE,
      },
    });

    return user
      ? { identity: this.toTenantUserIdentity(tenantId, user), status: "found" }
      : unavailable;
  }

  private async resolveTenantByUniqueField(
    field: "id" | "publicId",
    value: string,
  ): Promise<TenantResolution> {
    const tenant = await this.prisma.tenant.findFirst({
      include: tenantInclude,
      where: {
        ...activeTenantFilter,
        [field]: value,
      },
    });

    return tenant ? { status: "found", tenant: this.toTenantContext(tenant) } : unavailable;
  }

  private createUserSelector(input: TenantUserIdentityInput): Record<string, string> | null {
    const userId = normalizeUuid(input.userId);

    if (userId) {
      return {
        id: userId,
      };
    }

    const emailNormalized = normalizeEmail(input.email);

    if (!emailNormalized) {
      return null;
    }

    return {
      emailNormalized,
    };
  }

  private toTenantContext(record: TenantRecord): AuthTenantContext {
    return {
      defaultLocale: record.defaultLocale,
      defaultTimeZone: record.defaultTimeZone,
      id: record.id,
      name: record.name,
      publicId: record.publicId,
      registrationEnabled: record.registrationEnabled,
      securityPolicy: {
        failedLoginLockoutThreshold: record.failedLoginLockoutThreshold,
        failedLoginWindowMinutes: record.failedLoginWindowMinutes,
        lockoutDurationMinutes: record.lockoutDurationMinutes,
        passwordExpiresDays: record.passwordExpiresDays,
      },
      settings: toSettingsMap(record.settings),
      slug: record.slug,
    };
  }

  private toTenantUserIdentity(tenantId: string, user: UserRecord): TenantUserIdentity {
    const roles = user.roles.map((userRole) => ({
      id: userRole.role.id,
      key: userRole.role.key,
      name: userRole.role.name,
    }));
    const permissions = user.roles.flatMap((userRole) =>
      userRole.role.rolePermissions.map((rolePermission) => ({
        key: rolePermission.permission.key,
        scope: rolePermission.scope,
      })),
    );

    return {
      email: user.email,
      emailNormalized: user.emailNormalized,
      emailVerified: user.emailVerifiedAt !== null,
      id: user.id,
      permissions,
      preferences: toRecord(user.preferences?.preferences),
      profile: {
        displayName: user.profile?.displayName ?? null,
        firstName: user.profile?.firstName ?? null,
        language: user.profile?.language ?? "en",
        lastName: user.profile?.lastName ?? null,
        locale: user.profile?.locale ?? "en-US",
        profilePicturePlaceholder: user.profile?.profilePicturePlaceholder ?? null,
        timeZone: user.profile?.timeZone ?? "UTC",
      },
      publicId: user.publicId,
      roles,
      tenantId,
    };
  }
}

function normalizeToken(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();

  return normalized && normalized.length > 0 ? normalized : null;
}

function normalizeEmail(value: string | undefined): string | null {
  return normalizeToken(value);
}

function normalizeUuid(value: string | undefined): string | null {
  const normalized = value?.trim();

  return normalized && uuidPattern.test(normalized) ? normalized.toLowerCase() : null;
}

function toSettingsMap(settings: TenantSettingRecord[] | undefined): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};

  for (const setting of settings ?? []) {
    if (mapped[setting.namespace] === undefined) {
      mapped[setting.namespace] = setting.settings;
    }
  }

  return mapped;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
