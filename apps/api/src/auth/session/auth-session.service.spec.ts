import { describe, expect, it } from "vitest";

import { PasswordHashingService } from "../security/password-hashing.service";
import type { AuthSessionRepository, LoginCandidate } from "./auth-session.repository";
import { AuthSessionService } from "./auth-session.service";

const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

class FakeSessionRepository implements AuthSessionRepository {
  audits: Array<{ action: string; outcome: string; tenantId: string | null }> = [];
  candidate: LoginCandidate | null = null;
  createdSession: {
    rememberMe: boolean;
    userId: string;
    tenantId: string;
    expiresAt: Date;
  } | null = null;
  revokedSessionId: string | null = null;

  resolveTenantId() {
    return Promise.resolve(tenantId);
  }

  findLoginCandidate() {
    return Promise.resolve(this.candidate);
  }

  createSession(input: { rememberMe: boolean; userId: string; tenantId: string; expiresAt: Date }) {
    this.createdSession = input;

    return Promise.resolve({
      deviceName: "Browser",
      expiresAt: input.expiresAt,
      id: "33333333-3333-4333-8333-333333333333",
      lastSeenAt: null,
      rememberMe: input.rememberMe,
      state: "ACTIVE",
    });
  }

  findActiveSession(sessionId: string) {
    return Promise.resolve(
      sessionId === "33333333-3333-4333-8333-333333333333"
        ? {
            expiresAt: new Date("2026-07-31T00:00:00.000Z"),
            id: sessionId,
            tenantId,
            userId,
          }
        : null,
    );
  }

  listUserSessions() {
    return Promise.resolve([
      {
        deviceName: "Browser",
        expiresAt: new Date("2026-07-31T00:00:00.000Z"),
        id: "33333333-3333-4333-8333-333333333333",
        lastSeenAt: null,
        rememberMe: false,
        state: "ACTIVE",
      },
    ]);
  }

  revokeSession(sessionId: string) {
    this.revokedSessionId = sessionId;

    return Promise.resolve();
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

const fakeTokenService = {
  issueTokenPair: () =>
    Promise.resolve({
      accessToken: "access-token",
      accessTokenExpiresAt: new Date("2026-07-30T00:15:00.000Z"),
      refreshToken: "refresh-token",
      refreshTokenExpiresAt: new Date("2026-07-31T00:00:00.000Z"),
    }),
};

describe("AuthSessionService", () => {
  it("creates a tenant-scoped session for a verified user with a matching password", async () => {
    const hashing = new PasswordHashingService({ memoryCost: 4096, timeCost: 1 });
    const repository = new FakeSessionRepository();
    repository.candidate = {
      emailVerified: true,
      lockedUntil: null,
      passwordExpiresAt: null,
      passwordHash: await hashing.hashPassword("CorrectHorse9!Battery"),
      state: "ACTIVE",
      tenantId,
      userId,
    };
    const service = new AuthSessionService(
      repository,
      hashing,
      fakeTokenService,
      () => new Date("2026-07-30T00:00:00.000Z"),
    );

    const result = await service.login({
      email: " Agent@Acme.test ",
      password: "CorrectHorse9!Battery",
      rememberMe: false,
      tenant: { slug: "acme" },
      tenantId,
    });

    expect(result).toEqual({
      session: {
        deviceName: "Browser",
        expiresAt: new Date("2026-07-30T12:00:00.000Z"),
        id: "33333333-3333-4333-8333-333333333333",
        lastSeenAt: null,
        rememberMe: false,
        state: "ACTIVE",
      },
      status: "authenticated",
      tokens: {
        accessToken: "access-token",
        accessTokenExpiresAt: new Date("2026-07-30T00:15:00.000Z"),
        refreshToken: "refresh-token",
        refreshTokenExpiresAt: new Date("2026-07-31T00:00:00.000Z"),
      },
    });
    expect(repository.createdSession).toMatchObject({
      rememberMe: false,
      tenantId,
      userId,
    });
    expect(repository.audits).toContainEqual({
      action: "auth.login.completed",
      outcome: "SUCCESS",
      tenantId,
    });
  });

  it("uses the longer remember-me session lifetime", async () => {
    const hashing = new PasswordHashingService({ memoryCost: 4096, timeCost: 1 });
    const repository = new FakeSessionRepository();
    repository.candidate = {
      emailVerified: true,
      lockedUntil: null,
      passwordExpiresAt: null,
      passwordHash: await hashing.hashPassword("CorrectHorse9!Battery"),
      state: "ACTIVE",
      tenantId,
      userId,
    };
    const service = new AuthSessionService(
      repository,
      hashing,
      fakeTokenService,
      () => new Date("2026-07-30T00:00:00.000Z"),
    );

    await service.login({
      email: "agent@acme.test",
      password: "CorrectHorse9!Battery",
      rememberMe: true,
      tenantId,
    });

    expect(repository.createdSession?.expiresAt).toEqual(new Date("2026-08-29T00:00:00.000Z"));
  });

  it("requires a password change when the tenant credential has expired", async () => {
    const hashing = new PasswordHashingService({ memoryCost: 4096, timeCost: 1 });
    const repository = new FakeSessionRepository();
    repository.candidate = {
      emailVerified: true,
      lockedUntil: null,
      passwordExpiresAt: new Date("2026-07-29T23:59:59.000Z"),
      passwordHash: await hashing.hashPassword("CorrectHorse9!Battery"),
      state: "ACTIVE",
      tenantId,
      userId,
    };
    const service = new AuthSessionService(
      repository,
      hashing,
      fakeTokenService,
      () => new Date("2026-07-30T00:00:00.000Z"),
    );

    const result = await service.login({
      email: "agent@acme.test",
      password: "CorrectHorse9!Battery",
      tenantId,
    });

    expect(result).toMatchObject({
      status: "password_change_required",
    });
    expect(repository.createdSession).not.toBeNull();
    expect(repository.audits).toContainEqual({
      action: "auth.login.password_change_required",
      outcome: "SUCCESS",
      tenantId,
    });
  });

  it("denies invalid passwords without revealing which credential failed", async () => {
    const hashing = new PasswordHashingService({ memoryCost: 4096, timeCost: 1 });
    const repository = new FakeSessionRepository();
    repository.candidate = {
      emailVerified: true,
      lockedUntil: null,
      passwordExpiresAt: null,
      passwordHash: await hashing.hashPassword("CorrectHorse9!Battery"),
      state: "ACTIVE",
      tenantId,
      userId,
    };
    const service = new AuthSessionService(repository, hashing, fakeTokenService);

    await expect(
      service.login({
        email: "agent@acme.test",
        password: "WrongHorse9!Battery",
        tenantId,
      }),
    ).resolves.toEqual({ status: "denied" });
    expect(repository.createdSession).toBeNull();
    expect(repository.audits).toContainEqual({
      action: "auth.login.rejected",
      outcome: "FAILURE",
      tenantId,
    });
  });

  it("denies unverified or locked accounts", async () => {
    const hashing = new PasswordHashingService({ memoryCost: 4096, timeCost: 1 });
    const repository = new FakeSessionRepository();
    repository.candidate = {
      emailVerified: false,
      lockedUntil: null,
      passwordExpiresAt: null,
      passwordHash: await hashing.hashPassword("CorrectHorse9!Battery"),
      state: "ACTIVE",
      tenantId,
      userId,
    };
    const service = new AuthSessionService(repository, hashing, fakeTokenService);

    await expect(
      service.login({
        email: "agent@acme.test",
        password: "CorrectHorse9!Battery",
        tenantId,
      }),
    ).resolves.toEqual({ status: "denied" });
    expect(repository.createdSession).toBeNull();
  });

  it("revokes the current session and lists active sessions for the current session owner", async () => {
    const service = new AuthSessionService(
      new FakeSessionRepository(),
      new PasswordHashingService({ memoryCost: 4096, timeCost: 1 }),
      fakeTokenService,
      () => new Date("2026-07-30T00:00:00.000Z"),
    );

    await expect(
      service.listSessions({ currentSessionId: "33333333-3333-4333-8333-333333333333" }),
    ).resolves.toEqual({
      sessions: [
        {
          deviceName: "Browser",
          expiresAt: new Date("2026-07-31T00:00:00.000Z"),
          id: "33333333-3333-4333-8333-333333333333",
          lastSeenAt: null,
          rememberMe: false,
          state: "ACTIVE",
        },
      ],
      status: "ok",
    });
    await expect(
      service.logout({ currentSessionId: "33333333-3333-4333-8333-333333333333" }),
    ).resolves.toEqual({ status: "accepted" });
  });
});
