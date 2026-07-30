import { TenantDomainState, TenantState, UserState } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { IdentityLookupService } from "./identity-lookup.service";

type QueryArgs = {
  where?: Record<string, unknown>;
  include?: Record<string, unknown>;
};

class FakePrisma {
  tenant = {
    findFirst: (args: QueryArgs) => Promise.resolve(this.findTenant(args)),
  };

  tenantDomain = {
    findFirst: (args: QueryArgs) => Promise.resolve(this.findTenantDomain(args)),
  };

  user = {
    findFirst: (args: QueryArgs) => Promise.resolve(this.findUser(args)),
  };

  private readonly activeTenant = {
    id: "11111111-1111-4111-8111-111111111111",
    publicId: "22222222-2222-4222-8222-222222222222",
    slug: "acme",
    name: "Acme Support",
    state: TenantState.ACTIVE,
    defaultLocale: "en-US",
    defaultTimeZone: "America/New_York",
    registrationEnabled: true,
    failedLoginLockoutThreshold: 5,
    failedLoginWindowMinutes: 15,
    lockoutDurationMinutes: 30,
    passwordExpiresDays: 90,
    settings: [
      {
        namespace: "branding",
        settings: {
          primaryColor: "#2563eb",
        },
        version: 1,
      },
    ],
  };

  private readonly activeDomain = {
    domain: "support.acme.test",
    state: TenantDomainState.VERIFIED,
    tenant: this.activeTenant,
  };

  private readonly activeUser = {
    id: "33333333-3333-4333-8333-333333333333",
    publicId: "44444444-4444-4444-8444-444444444444",
    email: "Agent@Acme.test",
    emailNormalized: "agent@acme.test",
    emailVerifiedAt: new Date("2026-07-30T00:00:00.000Z"),
    state: UserState.ACTIVE,
    profile: {
      displayName: "Acme Agent",
      firstName: "Acme",
      lastName: "Agent",
      profilePicturePlaceholder: "AA",
      timeZone: "America/New_York",
      language: "en",
      locale: "en-US",
    },
    preferences: {
      preferences: {
        density: "compact",
      },
    },
    roles: [
      {
        role: {
          id: "55555555-5555-4555-8555-555555555555",
          key: "agent",
          name: "Agent",
          rolePermissions: [
            {
              permission: {
                key: "auth.session.read",
              },
              scope: "tenant",
            },
          ],
        },
      },
    ],
  };

  private findTenant(args: QueryArgs) {
    const where = args.where;

    if (
      where?.["state"] === TenantState.ACTIVE &&
      where["deletedAt"] === null &&
      where["slug"] === "acme"
    ) {
      return this.activeTenant;
    }

    return null;
  }

  private findTenantDomain(args: QueryArgs) {
    const where = args.where;
    const tenantFilter = where?.["tenant"] as Record<string, unknown> | undefined;

    if (
      where?.["domain"] === "support.acme.test" &&
      where["state"] === TenantDomainState.VERIFIED &&
      tenantFilter?.["state"] === TenantState.ACTIVE &&
      tenantFilter["deletedAt"] === null
    ) {
      return this.activeDomain;
    }

    return null;
  }

  private findUser(args: QueryArgs) {
    const where = args.where;
    const roleFilter = where?.["roles"] as { some?: Record<string, unknown> } | undefined;
    const roleTenant = roleFilter?.some?.["tenantId"];
    const roleRelation = roleFilter?.some?.["role"] as Record<string, unknown> | undefined;

    if (
      where?.["emailNormalized"] === "agent@acme.test" &&
      where["state"] === UserState.ACTIVE &&
      where["deletedAt"] === null &&
      roleTenant === this.activeTenant.id &&
      roleFilter?.some?.["revokedAt"] === null &&
      roleRelation?.["deletedAt"] === null
    ) {
      return this.activeUser;
    }

    return null;
  }
}

describe("IdentityLookupService", () => {
  it("resolves an active tenant from a normalized slug without exposing raw settings rows", async () => {
    const service = new IdentityLookupService(new FakePrisma());

    const result = await service.resolveTenant({ slug: " ACME " });

    expect(result).toEqual({
      status: "found",
      tenant: {
        id: "11111111-1111-4111-8111-111111111111",
        publicId: "22222222-2222-4222-8222-222222222222",
        slug: "acme",
        name: "Acme Support",
        defaultLocale: "en-US",
        defaultTimeZone: "America/New_York",
        registrationEnabled: true,
        securityPolicy: {
          failedLoginLockoutThreshold: 5,
          failedLoginWindowMinutes: 15,
          lockoutDurationMinutes: 30,
          passwordExpiresDays: 90,
        },
        settings: {
          branding: {
            primaryColor: "#2563eb",
          },
        },
      },
    });
  });

  it("resolves an active tenant from a verified normalized domain", async () => {
    const service = new IdentityLookupService(new FakePrisma());

    const result = await service.resolveTenant({ domain: " SUPPORT.ACME.TEST " });

    expect(result.status).toBe("found");
  });

  it("fails closed when no active tenant can be resolved", async () => {
    const service = new IdentityLookupService(new FakePrisma());

    await expect(service.resolveTenant({ slug: "suspended" })).resolves.toEqual({
      status: "unavailable",
    });
    await expect(service.resolveTenant({})).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("loads an active user only through an active role in the selected tenant", async () => {
    const service = new IdentityLookupService(new FakePrisma());

    const result = await service.loadTenantUserIdentity({
      email: " Agent@Acme.test ",
      tenantId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result).toEqual({
      identity: {
        email: "Agent@Acme.test",
        emailNormalized: "agent@acme.test",
        emailVerified: true,
        id: "33333333-3333-4333-8333-333333333333",
        permissions: [
          {
            key: "auth.session.read",
            scope: "tenant",
          },
        ],
        profile: {
          displayName: "Acme Agent",
          firstName: "Acme",
          language: "en",
          lastName: "Agent",
          locale: "en-US",
          profilePicturePlaceholder: "AA",
          timeZone: "America/New_York",
        },
        publicId: "44444444-4444-4444-8444-444444444444",
        roles: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            key: "agent",
            name: "Agent",
          },
        ],
        preferences: {
          density: "compact",
        },
        tenantId: "11111111-1111-4111-8111-111111111111",
      },
      status: "found",
    });
  });

  it("fails closed for cross-tenant or inactive user lookups", async () => {
    const service = new IdentityLookupService(new FakePrisma());

    await expect(
      service.loadTenantUserIdentity({
        email: "agent@acme.test",
        tenantId: "99999999-9999-4999-8999-999999999999",
      }),
    ).resolves.toEqual({
      status: "unavailable",
    });
  });
});
