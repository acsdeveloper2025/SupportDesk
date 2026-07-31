import { describe, expect, it } from "vitest";

import type { AuthNotificationService } from "../registration/auth-notification.service";
import { PasswordHashingService } from "../security/password-hashing.service";
import { SecureTokenService } from "../security/secure-token.service";
import { PasswordPolicyService } from "../validation/password-policy.service";
import type {
  AuthPasswordResetAuditInput,
  AuthPasswordResetRepository,
  CreatePasswordResetTokenInput,
  PasswordResetTokenRecord,
} from "./auth-password-reset.repository";
import { AuthPasswordResetService } from "./auth-password-reset.service";

const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

class FakeIdentityLookup {
  available = true;

  resolveTenant() {
    if (!this.available) {
      return Promise.resolve({
        status: "unavailable" as const,
      });
    }

    return Promise.resolve({
      status: "found" as const,
      tenant: {
        defaultLocale: "en-US",
        defaultTimeZone: "UTC",
        id: tenantId,
        name: "Acme",
        publicId: "33333333-3333-4333-8333-333333333333",
        registrationEnabled: true,
        securityPolicy: {
          failedLoginLockoutThreshold: 5,
          failedLoginWindowMinutes: 15,
          lockoutDurationMinutes: 30,
          passwordExpiresDays: null,
        },
        settings: {},
        slug: "acme",
      },
    });
  }
}

class FakePasswordResetRepository implements AuthPasswordResetRepository {
  audits: AuthPasswordResetAuditInput[] = [];
  candidate: { emailNormalized: string; id: string; tenantId: string } | null = null;
  createdToken: CreatePasswordResetTokenInput | null = null;
  createThrows = false;
  expiredTokenId: string | null = null;
  passwordExpiresAt: Date | null | undefined;
  resetPasswordHash: string | null = null;
  revokedRefreshTokens = false;
  revokedSessions = false;
  tokenRecord: PasswordResetTokenRecord | null = null;

  findPasswordResetCandidate() {
    return Promise.resolve(this.candidate);
  }

  createPasswordResetToken(input: CreatePasswordResetTokenInput) {
    if (this.createThrows) {
      return Promise.reject(new Error("write failed"));
    }

    this.createdToken = input;

    return Promise.resolve();
  }

  findPasswordResetTokenByHash() {
    return Promise.resolve(this.tokenRecord);
  }

  markPasswordResetTokenExpired(tokenId: string) {
    this.expiredTokenId = tokenId;

    return Promise.resolve();
  }

  completePasswordReset(input: { passwordExpiresAt: Date | null; passwordHash: string }) {
    this.passwordExpiresAt = input.passwordExpiresAt;
    this.resetPasswordHash = input.passwordHash;
    this.revokedRefreshTokens = true;
    this.revokedSessions = true;

    return Promise.resolve();
  }

  recordAuthAuditEvent(input: AuthPasswordResetAuditInput) {
    this.audits.push({
      action: input.action,
      ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
      outcome: input.outcome,
      tenantId: input.tenantId ?? null,
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
    });

    return Promise.resolve();
  }
}

class FakeNotificationService implements Pick<AuthNotificationService, "deliverPasswordReset"> {
  deliveredToken: string | null = null;

  deliverPasswordReset(input: { token: string }) {
    this.deliveredToken = input.token;

    return Promise.resolve();
  }
}

describe("AuthPasswordResetService", () => {
  it("accepts malformed reset requests without account disclosure", async () => {
    const repository = new FakePasswordResetRepository();
    const service = new AuthPasswordResetService(
      new FakeIdentityLookup(),
      repository,
      new PasswordPolicyService(),
      new PasswordHashingService({ memoryCost: 4096, timeCost: 1 }),
      new SecureTokenService(16),
      new FakeNotificationService(),
      () => new Date("2026-07-30T00:00:00.000Z"),
    );

    await expect(service.requestPasswordReset({ email: "not-an-email" })).resolves.toEqual({
      status: "accepted",
    });
    expect(repository.createdToken).toBeNull();
    expect(repository.audits).toContainEqual({
      action: "auth.password_reset.request_rejected",
      outcome: "FAILURE",
      tenantId: null,
    });
  });

  it("keeps tenant lookup failures generic during reset requests", async () => {
    const identity = new FakeIdentityLookup();
    identity.available = false;
    const repository = new FakePasswordResetRepository();
    const service = new AuthPasswordResetService(
      identity,
      repository,
      new PasswordPolicyService(),
      new PasswordHashingService({ memoryCost: 4096, timeCost: 1 }),
      new SecureTokenService(16),
      new FakeNotificationService(),
      () => new Date("2026-07-30T00:00:00.000Z"),
    );

    await expect(
      service.requestPasswordReset({
        email: "agent@acme.test",
        tenant: { slug: "missing" },
      }),
    ).resolves.toEqual({ status: "accepted" });
    expect(repository.createdToken).toBeNull();
    expect(repository.audits).toContainEqual({
      action: "auth.password_reset.request_rejected",
      outcome: "DENIED",
      tenantId: null,
    });
  });

  it("creates a secure one-time reset token without exposing the raw token in storage", async () => {
    const repository = new FakePasswordResetRepository();
    repository.candidate = {
      emailNormalized: "agent@acme.test",
      id: userId,
      tenantId,
    };
    const notifications = new FakeNotificationService();
    const service = new AuthPasswordResetService(
      new FakeIdentityLookup(),
      repository,
      new PasswordPolicyService(),
      new PasswordHashingService({ memoryCost: 4096, timeCost: 1 }),
      new SecureTokenService(16),
      notifications,
      () => new Date("2026-07-30T00:00:00.000Z"),
    );

    await expect(
      service.requestPasswordReset({
        correlationId: "corr-1",
        email: " Agent@Acme.test ",
        ipAddress: "203.0.113.11",
        tenant: { slug: "acme" },
        userAgent: "Reset Test Browser",
      }),
    ).resolves.toEqual({ status: "accepted" });

    const createdToken = repository.createdToken;

    expect(createdToken).not.toBeNull();
    expect(createdToken?.emailHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createdToken?.expiresAt).toEqual(new Date("2026-07-30T01:00:00.000Z"));
    expect(createdToken?.tenantId).toBe(tenantId);
    expect(createdToken?.userId).toBe(userId);
    expect(createdToken?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createdToken?.tokenHash).not.toBe(notifications.deliveredToken);
    expect(notifications.deliveredToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(repository.audits).toContainEqual(
      expect.objectContaining({
        action: "auth.password_reset.requested",
        ipAddress: "203.0.113.11",
        outcome: "SUCCESS",
        tenantId,
        userAgent: "Reset Test Browser",
      }),
    );
  });

  it("does not disclose missing users or tenants during reset requests", async () => {
    const repository = new FakePasswordResetRepository();
    const service = new AuthPasswordResetService(
      new FakeIdentityLookup(),
      repository,
      new PasswordPolicyService(),
      new PasswordHashingService({ memoryCost: 4096, timeCost: 1 }),
      new SecureTokenService(16),
      new FakeNotificationService(),
      () => new Date("2026-07-30T00:00:00.000Z"),
    );

    await expect(
      service.requestPasswordReset({
        email: "missing@acme.test",
        tenant: { slug: "acme" },
      }),
    ).resolves.toEqual({ status: "accepted" });

    expect(repository.createdToken).toBeNull();
    expect(repository.audits).toContainEqual({
      action: "auth.password_reset.request_rejected",
      outcome: "DENIED",
      tenantId,
    });
  });

  it("audits reset-token creation failures without disclosing them", async () => {
    const repository = new FakePasswordResetRepository();
    repository.candidate = {
      emailNormalized: "agent@acme.test",
      id: userId,
      tenantId,
    };
    repository.createThrows = true;
    const service = new AuthPasswordResetService(
      new FakeIdentityLookup(),
      repository,
      new PasswordPolicyService(),
      new PasswordHashingService({ memoryCost: 4096, timeCost: 1 }),
      new SecureTokenService(16),
      new FakeNotificationService(),
      () => new Date("2026-07-30T00:00:00.000Z"),
    );

    await expect(
      service.requestPasswordReset({
        email: "agent@acme.test",
        tenant: { slug: "acme" },
      }),
    ).resolves.toEqual({ status: "accepted" });
    expect(repository.audits).toContainEqual({
      action: "auth.password_reset.request_rejected",
      outcome: "FAILURE",
      tenantId,
    });
  });

  it("rejects invalid reset passwords before token lookup", async () => {
    const repository = new FakePasswordResetRepository();
    const service = new AuthPasswordResetService(
      new FakeIdentityLookup(),
      repository,
      new PasswordPolicyService(),
      new PasswordHashingService({ memoryCost: 4096, timeCost: 1 }),
      new SecureTokenService(16),
      new FakeNotificationService(),
    );

    await expect(
      service.confirmPasswordReset({
        password: "weak",
        token: "unused-token",
      }),
    ).resolves.toMatchObject({
      status: "validation_failed",
    });
    expect(repository.resetPasswordHash).toBeNull();
  });

  it("keeps missing and unavailable reset tokens generic", async () => {
    const repository = new FakePasswordResetRepository();
    const service = new AuthPasswordResetService(
      new FakeIdentityLookup(),
      repository,
      new PasswordPolicyService(),
      new PasswordHashingService({ memoryCost: 4096, timeCost: 1 }),
      new SecureTokenService(16),
      new FakeNotificationService(),
    );

    await expect(
      service.confirmPasswordReset({
        password: "NewCorrectHorse9!Battery",
      }),
    ).resolves.toEqual({ status: "accepted" });
    await expect(
      service.confirmPasswordReset({
        password: "NewCorrectHorse9!Battery",
        token: "unknown-token",
      }),
    ).resolves.toEqual({ status: "accepted" });
    expect(repository.resetPasswordHash).toBeNull();
    expect(repository.audits).toContainEqual({
      action: "auth.password_reset.rejected",
      outcome: "FAILURE",
      tenantId: null,
    });
  });

  it("accepts a valid reset token once, changes the password, and revokes active sessions", async () => {
    const oldHash = await new PasswordHashingService({
      memoryCost: 4096,
      timeCost: 1,
    }).hashPassword("CorrectHorse9!Battery");
    const repository = new FakePasswordResetRepository();
    repository.tokenRecord = {
      emailNormalized: "agent@acme.test",
      expiresAt: new Date("2026-07-30T01:00:00.000Z"),
      id: "token-1",
      passwordExpiresDays: 90,
      passwordHash: oldHash,
      state: "ACTIVE",
      tenantId,
      userId,
      userState: "ACTIVE",
    };
    const service = new AuthPasswordResetService(
      new FakeIdentityLookup(),
      repository,
      new PasswordPolicyService(),
      new PasswordHashingService({ memoryCost: 4096, timeCost: 1 }),
      new SecureTokenService(16),
      new FakeNotificationService(),
      () => new Date("2026-07-30T00:00:00.000Z"),
    );

    await expect(
      service.confirmPasswordReset({
        password: "NewCorrectHorse9!Battery",
        token: "valid-reset-token",
      }),
    ).resolves.toEqual({ status: "accepted" });

    expect(repository.resetPasswordHash).toMatch(/^\$argon2id\$/);
    expect(repository.resetPasswordHash).not.toContain("NewCorrectHorse9!Battery");
    expect(repository.resetPasswordHash).not.toBe(oldHash);
    expect(repository.passwordExpiresAt).toEqual(new Date("2026-10-28T00:00:00.000Z"));
    expect(repository.revokedSessions).toBe(true);
    expect(repository.revokedRefreshTokens).toBe(true);
    expect(repository.audits).toContainEqual({
      action: "auth.password_reset.completed",
      outcome: "SUCCESS",
      tenantId,
    });
  });

  it("allows tenants without password expiration during reset completion", async () => {
    const oldHash = await new PasswordHashingService({
      memoryCost: 4096,
      timeCost: 1,
    }).hashPassword("CorrectHorse9!Battery");
    const repository = new FakePasswordResetRepository();
    repository.tokenRecord = {
      emailNormalized: "agent@acme.test",
      expiresAt: new Date("2026-07-30T01:00:00.000Z"),
      id: "token-1",
      passwordExpiresDays: null,
      passwordHash: oldHash,
      state: "ACTIVE",
      tenantId,
      userId,
      userState: "ACTIVE",
    };
    const service = new AuthPasswordResetService(
      new FakeIdentityLookup(),
      repository,
      new PasswordPolicyService(),
      new PasswordHashingService({ memoryCost: 4096, timeCost: 1 }),
      new SecureTokenService(16),
      new FakeNotificationService(),
      () => new Date("2026-07-30T00:00:00.000Z"),
    );

    await expect(
      service.confirmPasswordReset({
        password: "NewCorrectHorse9!Battery",
        token: "valid-reset-token",
      }),
    ).resolves.toEqual({ status: "accepted" });
    expect(repository.passwordExpiresAt).toBeNull();
  });

  it("denies reset completion for inactive user identities", async () => {
    const repository = new FakePasswordResetRepository();
    repository.tokenRecord = {
      emailNormalized: "agent@acme.test",
      expiresAt: new Date("2026-07-31T00:00:00.000Z"),
      id: "token-1",
      passwordExpiresDays: 90,
      passwordHash: "old-hash",
      state: "ACTIVE",
      tenantId,
      userId,
      userState: "SUSPENDED",
    };
    const service = new AuthPasswordResetService(
      new FakeIdentityLookup(),
      repository,
      new PasswordPolicyService(),
      new PasswordHashingService({ memoryCost: 4096, timeCost: 1 }),
      new SecureTokenService(16),
      new FakeNotificationService(),
      () => new Date("2026-07-30T00:00:00.000Z"),
    );

    await expect(
      service.confirmPasswordReset({
        password: "NewCorrectHorse9!Battery",
        token: "valid-reset-token",
      }),
    ).resolves.toEqual({ status: "accepted" });
    expect(repository.resetPasswordHash).toBeNull();
    expect(repository.audits).toContainEqual({
      action: "auth.password_reset.rejected",
      outcome: "DENIED",
      tenantId,
    });
  });

  it("rejects reuse of the existing password during reset completion", async () => {
    const oldHash = await new PasswordHashingService({
      memoryCost: 4096,
      timeCost: 1,
    }).hashPassword("CorrectHorse9!Battery");
    const repository = new FakePasswordResetRepository();
    repository.tokenRecord = {
      emailNormalized: "agent@acme.test",
      expiresAt: new Date("2026-07-31T00:00:00.000Z"),
      id: "token-1",
      passwordExpiresDays: 90,
      passwordHash: oldHash,
      state: "ACTIVE",
      tenantId,
      userId,
      userState: "ACTIVE",
    };
    const service = new AuthPasswordResetService(
      new FakeIdentityLookup(),
      repository,
      new PasswordPolicyService(),
      new PasswordHashingService({ memoryCost: 4096, timeCost: 1 }),
      new SecureTokenService(16),
      new FakeNotificationService(),
      () => new Date("2026-07-30T00:00:00.000Z"),
    );

    await expect(
      service.confirmPasswordReset({
        password: "CorrectHorse9!Battery",
        token: "valid-reset-token",
      }),
    ).resolves.toEqual({
      errors: ["PASSWORD_RECENTLY_USED"],
      status: "validation_failed",
    });
    expect(repository.resetPasswordHash).toBeNull();
  });

  it("expires old reset tokens without changing the password", async () => {
    const repository = new FakePasswordResetRepository();
    repository.tokenRecord = {
      emailNormalized: "agent@acme.test",
      expiresAt: new Date("2026-07-29T00:00:00.000Z"),
      id: "token-1",
      passwordExpiresDays: 90,
      passwordHash: "old-hash",
      state: "ACTIVE",
      tenantId,
      userId,
      userState: "ACTIVE",
    };
    const service = new AuthPasswordResetService(
      new FakeIdentityLookup(),
      repository,
      new PasswordPolicyService(),
      new PasswordHashingService({ memoryCost: 4096, timeCost: 1 }),
      new SecureTokenService(16),
      new FakeNotificationService(),
      () => new Date("2026-07-30T00:00:00.000Z"),
    );

    await expect(
      service.confirmPasswordReset({
        password: "NewCorrectHorse9!Battery",
        token: "expired-reset-token",
      }),
    ).resolves.toEqual({ status: "accepted" });

    expect(repository.expiredTokenId).toBe("token-1");
    expect(repository.resetPasswordHash).toBeNull();
    expect(repository.audits).toContainEqual({
      action: "auth.password_reset.rejected",
      outcome: "FAILURE",
      tenantId,
    });
  });

  it("audits replayed reset tokens and keeps the generic response", async () => {
    const repository = new FakePasswordResetRepository();
    repository.tokenRecord = {
      emailNormalized: "agent@acme.test",
      expiresAt: new Date("2026-07-31T00:00:00.000Z"),
      id: "token-1",
      passwordExpiresDays: 90,
      passwordHash: "old-hash",
      state: "USED",
      tenantId,
      userId,
      userState: "ACTIVE",
    };
    const service = new AuthPasswordResetService(
      new FakeIdentityLookup(),
      repository,
      new PasswordPolicyService(),
      new PasswordHashingService({ memoryCost: 4096, timeCost: 1 }),
      new SecureTokenService(16),
      new FakeNotificationService(),
    );

    await expect(
      service.confirmPasswordReset({
        password: "NewCorrectHorse9!Battery",
        token: "replayed-reset-token",
      }),
    ).resolves.toEqual({ status: "accepted" });

    expect(repository.resetPasswordHash).toBeNull();
    expect(repository.audits).toContainEqual({
      action: "auth.password_reset.replay_detected",
      outcome: "DENIED",
      tenantId,
    });
  });
});
