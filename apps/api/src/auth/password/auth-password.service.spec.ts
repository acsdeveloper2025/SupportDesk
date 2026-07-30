import { describe, expect, it } from "vitest";

import { PasswordHashingService } from "../security/password-hashing.service";
import { PasswordPolicyService } from "../validation/password-policy.service";
import type {
  AuthPasswordAuditInput,
  AuthPasswordRepository,
  CompletePasswordChangeInput,
  PasswordChangeIdentity,
} from "./auth-password.repository";
import { AuthPasswordService } from "./auth-password.service";

const sessionId = "33333333-3333-4333-8333-333333333333";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

class FakePasswordRepository implements AuthPasswordRepository {
  audits: AuthPasswordAuditInput[] = [];
  completed: CompletePasswordChangeInput | null = null;
  identity: PasswordChangeIdentity | null = null;

  findPasswordChangeIdentity() {
    return Promise.resolve(this.identity);
  }

  completePasswordChange(input: CompletePasswordChangeInput) {
    this.completed = input;

    return Promise.resolve();
  }

  recordAuthAuditEvent(input: AuthPasswordAuditInput) {
    this.audits.push(input);

    return Promise.resolve();
  }
}

describe("AuthPasswordService", () => {
  it("denies a password change when the current password is wrong", async () => {
    const hashing = new PasswordHashingService({ memoryCost: 4096, timeCost: 1 });
    const repository = new FakePasswordRepository();
    repository.identity = {
      emailNormalized: "agent@acme.test",
      passwordExpiresDays: 90,
      passwordHash: await hashing.hashPassword("CorrectHorse9!Battery"),
      tenantId,
      userId,
    };
    const service = new AuthPasswordService(repository, hashing, new PasswordPolicyService());

    await expect(
      service.changePassword({
        currentPassword: "WrongHorse9!Battery",
        currentSessionId: sessionId,
        newPassword: "NewCorrectHorse9!Battery",
      }),
    ).resolves.toEqual({ status: "denied" });

    expect(repository.completed).toBeNull();
    expect(repository.audits).toContainEqual(
      expect.objectContaining({
        action: "auth.password_change.rejected",
        outcome: "DENIED",
        tenantId,
      }),
    );
  });

  it("changes an authenticated password and sets the tenant policy expiry", async () => {
    const hashing = new PasswordHashingService({ memoryCost: 4096, timeCost: 1 });
    const repository = new FakePasswordRepository();
    const oldPasswordHash = await hashing.hashPassword("CorrectHorse9!Battery");
    repository.identity = {
      emailNormalized: "agent@acme.test",
      passwordExpiresDays: 90,
      passwordHash: oldPasswordHash,
      tenantId,
      userId,
    };
    const service = new AuthPasswordService(
      repository,
      hashing,
      new PasswordPolicyService(),
      () => new Date("2026-07-30T00:00:00.000Z"),
    );

    await expect(
      service.changePassword({
        correlationId: "corr-1",
        currentPassword: "CorrectHorse9!Battery",
        currentSessionId: sessionId,
        ipAddress: "203.0.113.12",
        newPassword: "NewCorrectHorse9!Battery",
        userAgent: "Password Test Browser",
      }),
    ).resolves.toEqual({ status: "changed" });

    expect(repository.completed?.passwordChangedAt).toEqual(new Date("2026-07-30T00:00:00.000Z"));
    expect(repository.completed?.passwordExpiresAt).toEqual(new Date("2026-10-28T00:00:00.000Z"));
    expect(repository.completed?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(repository.completed?.passwordHash).not.toBe(oldPasswordHash);
    expect(repository.completed).toMatchObject({
      tenantId,
      userId,
    });
    expect(repository.audits).toContainEqual(
      expect.objectContaining({
        action: "auth.password_change.completed",
        ipAddress: "203.0.113.12",
        outcome: "SUCCESS",
        tenantId,
        userAgent: "Password Test Browser",
      }),
    );
  });

  it("rejects reuse of the current password through the password policy", async () => {
    const hashing = new PasswordHashingService({ memoryCost: 4096, timeCost: 1 });
    const repository = new FakePasswordRepository();
    repository.identity = {
      emailNormalized: "agent@acme.test",
      passwordExpiresDays: null,
      passwordHash: await hashing.hashPassword("CorrectHorse9!Battery"),
      tenantId,
      userId,
    };
    const service = new AuthPasswordService(repository, hashing, new PasswordPolicyService());

    const result = await service.changePassword({
      currentPassword: "CorrectHorse9!Battery",
      currentSessionId: sessionId,
      newPassword: "CorrectHorse9!Battery",
    });

    expect(result).toEqual({
      errors: ["PASSWORD_RECENTLY_USED"],
      status: "validation_failed",
    });
    expect(repository.completed).toBeNull();
  });
});
