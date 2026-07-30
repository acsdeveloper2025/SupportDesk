import { describe, expect, it } from "vitest";

import { PasswordHashingService } from "../security/password-hashing.service";
import { SecureTokenService } from "../security/secure-token.service";
import { PasswordPolicyService } from "../validation/password-policy.service";
import type { AuthNotificationService } from "./auth-notification.service";
import type {
  AuthRegistrationRepository,
  PendingUserRegistrationInput,
  VerificationTokenRecord,
} from "./auth-registration.repository";
import { AuthRegistrationService } from "./auth-registration.service";

const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

class FakeIdentityLookup {
  registrationEnabled = true;

  resolveTenant() {
    return Promise.resolve({
      status: "found" as const,
      tenant: {
        defaultLocale: "en-US",
        defaultTimeZone: "UTC",
        id: tenantId,
        name: "Acme",
        publicId: "33333333-3333-4333-8333-333333333333",
        registrationEnabled: this.registrationEnabled,
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

class FakeRegistrationRepository implements AuthRegistrationRepository {
  audits: Array<{ action: string; outcome: string; tenantId: string | null }> = [];
  createdRegistration: PendingUserRegistrationInput | null = null;
  duplicateUser = false;
  tokenRecord: VerificationTokenRecord | null = null;
  expiredTokenId: string | null = null;
  verifiedTokenId: string | null = null;

  findTenantUserByEmail() {
    return Promise.resolve(this.duplicateUser ? { id: userId } : null);
  }

  createPendingUserRegistration(input: PendingUserRegistrationInput) {
    this.createdRegistration = input;

    return Promise.resolve({
      tenantId: input.tenantId,
      userId,
    });
  }

  findActiveEmailVerificationToken() {
    return Promise.resolve(this.tokenRecord);
  }

  markVerificationTokenExpired(tokenId: string) {
    this.expiredTokenId = tokenId;

    return Promise.resolve();
  }

  completeEmailVerification(tokenId: string) {
    this.verifiedTokenId = tokenId;

    return Promise.resolve({
      tenantId,
      userId,
    });
  }

  recordAuthAuditEvent(input: { action: string; outcome: string; tenantId?: string | null }) {
    this.audits.push({
      action: input.action,
      outcome: input.outcome,
      tenantId: input.tenantId ?? null,
    });

    return Promise.resolve();
  }
}

class FakeNotificationService implements Pick<AuthNotificationService, "deliverEmailVerification"> {
  deliveredToken: string | null = null;

  deliverEmailVerification(input: { token: string }) {
    this.deliveredToken = input.token;

    return Promise.resolve();
  }
}

describe("AuthRegistrationService", () => {
  it("creates a pending user, stores only hashed secrets, sends the raw verification token, and audits success", async () => {
    const identity = new FakeIdentityLookup();
    const repository = new FakeRegistrationRepository();
    const notifications = new FakeNotificationService();
    const service = new AuthRegistrationService(
      identity,
      repository,
      new PasswordPolicyService(),
      new PasswordHashingService({ memoryCost: 4096, timeCost: 1 }),
      new SecureTokenService(16),
      notifications,
    );

    const result = await service.register({
      correlationId: "corr-1",
      displayName: "Acme Agent",
      email: " Agent@Acme.test ",
      password: "CorrectHorse9!Battery",
      tenant: { slug: "acme" },
    });

    expect(result).toEqual({ status: "accepted" });
    expect(repository.createdRegistration?.emailNormalized).toBe("agent@acme.test");
    expect(repository.createdRegistration?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(repository.createdRegistration?.passwordHash).not.toContain("CorrectHorse9!Battery");
    expect(repository.createdRegistration?.verificationTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(repository.createdRegistration?.verificationTokenHash).not.toBe(
      notifications.deliveredToken,
    );
    expect(notifications.deliveredToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(repository.audits).toContainEqual({
      action: "auth.registration.completed",
      outcome: "SUCCESS",
      tenantId,
    });
  });

  it("does not create users when tenant registration is disabled and still returns accepted", async () => {
    const identity = new FakeIdentityLookup();
    identity.registrationEnabled = false;
    const repository = new FakeRegistrationRepository();
    const service = new AuthRegistrationService(
      identity,
      repository,
      new PasswordPolicyService(),
      new PasswordHashingService({ memoryCost: 4096, timeCost: 1 }),
      new SecureTokenService(16),
      new FakeNotificationService(),
    );

    await expect(
      service.register({
        email: "agent@acme.test",
        password: "CorrectHorse9!Battery",
        tenant: { slug: "acme" },
      }),
    ).resolves.toEqual({ status: "accepted" });
    expect(repository.createdRegistration).toBeNull();
    expect(repository.audits).toContainEqual({
      action: "auth.registration.rejected",
      outcome: "DENIED",
      tenantId,
    });
  });

  it("does not disclose duplicate tenant identities", async () => {
    const repository = new FakeRegistrationRepository();
    repository.duplicateUser = true;
    const service = new AuthRegistrationService(
      new FakeIdentityLookup(),
      repository,
      new PasswordPolicyService(),
      new PasswordHashingService({ memoryCost: 4096, timeCost: 1 }),
      new SecureTokenService(16),
      new FakeNotificationService(),
    );

    await expect(
      service.register({
        email: "agent@acme.test",
        password: "CorrectHorse9!Battery",
        tenant: { slug: "acme" },
      }),
    ).resolves.toEqual({ status: "accepted" });
    expect(repository.createdRegistration).toBeNull();
    expect(repository.audits).toContainEqual({
      action: "auth.registration.rejected",
      outcome: "DENIED",
      tenantId,
    });
  });

  it("confirms a valid email verification token once", async () => {
    const repository = new FakeRegistrationRepository();
    repository.tokenRecord = {
      expiresAt: new Date("2026-07-31T00:00:00.000Z"),
      id: "token-1",
      tenantId,
      userId,
    };
    const service = new AuthRegistrationService(
      new FakeIdentityLookup(),
      repository,
      new PasswordPolicyService(),
      new PasswordHashingService({ memoryCost: 4096, timeCost: 1 }),
      new SecureTokenService(16),
      new FakeNotificationService(),
      () => new Date("2026-07-30T00:00:00.000Z"),
    );

    await expect(service.confirmEmailVerification({ token: "valid-token" })).resolves.toEqual({
      status: "accepted",
    });
    expect(repository.verifiedTokenId).toBe("token-1");
    expect(repository.audits).toContainEqual({
      action: "auth.email_verification.completed",
      outcome: "SUCCESS",
      tenantId,
    });
  });

  it("expires old verification tokens without revealing validity", async () => {
    const repository = new FakeRegistrationRepository();
    repository.tokenRecord = {
      expiresAt: new Date("2026-07-29T00:00:00.000Z"),
      id: "token-1",
      tenantId,
      userId,
    };
    const service = new AuthRegistrationService(
      new FakeIdentityLookup(),
      repository,
      new PasswordPolicyService(),
      new PasswordHashingService({ memoryCost: 4096, timeCost: 1 }),
      new SecureTokenService(16),
      new FakeNotificationService(),
      () => new Date("2026-07-30T00:00:00.000Z"),
    );

    await expect(service.confirmEmailVerification({ token: "expired-token" })).resolves.toEqual({
      status: "accepted",
    });
    expect(repository.expiredTokenId).toBe("token-1");
    expect(repository.verifiedTokenId).toBeNull();
    expect(repository.audits).toContainEqual({
      action: "auth.email_verification.rejected",
      outcome: "FAILURE",
      tenantId,
    });
  });
});
