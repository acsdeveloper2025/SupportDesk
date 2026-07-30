import { jwtVerify } from "jose";
import { describe, expect, it } from "vitest";

import { SecureTokenService } from "../security/secure-token.service";
import type {
  AuthTokenRepository,
  CreateRefreshTokenInput,
  RefreshTokenRecord,
} from "./auth-token.repository";
import { AuthTokenService } from "./auth-token.service";

const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const sessionId = "33333333-3333-4333-8333-333333333333";
const secret = "test-secret-that-is-long-enough-for-hs256";

class FakeTokenRepository implements AuthTokenRepository {
  createdRefresh: Array<CreateRefreshTokenInput & { familyId: string }> = [];
  rotatedTokenId: string | null = null;
  revokedFamilyId: string | null = null;
  audits: Array<{ action: string; outcome: string; tenantId: string | null }> = [];
  refreshRecord: RefreshTokenRecord | null = null;
  replayRecord: RefreshTokenRecord | null = null;

  createRefreshToken(input: CreateRefreshTokenInput) {
    const familyId = input.familyId ?? "55555555-5555-4555-8555-555555555555";
    this.createdRefresh.push({
      ...input,
      familyId,
    });

    return Promise.resolve({
      familyId,
      id: "44444444-4444-4444-8444-444444444444",
    });
  }

  findRefreshTokenByHash(tokenHash: string) {
    if (this.refreshRecord?.tokenHash === tokenHash) {
      return Promise.resolve(this.refreshRecord);
    }

    if (this.replayRecord?.tokenHash === tokenHash) {
      return Promise.resolve(this.replayRecord);
    }

    return Promise.resolve(null);
  }

  markRefreshTokenRotated(tokenId: string) {
    this.rotatedTokenId = tokenId;

    return Promise.resolve();
  }

  revokeRefreshTokenFamily(familyId: string) {
    this.revokedFamilyId = familyId;

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

describe("AuthTokenService", () => {
  it("issues minimal signed access tokens and stores only hashed refresh tokens", async () => {
    const repository = new FakeTokenRepository();
    const service = new AuthTokenService(repository, new SecureTokenService(16), {
      accessTokenTtlMinutes: 15,
      issuer: "supportdesk-test",
      refreshTokenTtlMinutes: 60,
      secret,
    });

    const result = await service.issueTokenPair({
      passwordChangeRequired: true,
      rememberMe: false,
      sessionId,
      tenantId,
      userId,
    });

    expect(result.refreshToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(repository.createdRefresh[0]?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(repository.createdRefresh[0]?.tokenHash).not.toBe(result.refreshToken);

    const verified = await jwtVerify(result.accessToken, new TextEncoder().encode(secret), {
      issuer: "supportdesk-test",
    });
    expect(verified.payload).toMatchObject({
      sid: sessionId,
      sub: userId,
      tid: tenantId,
      typ: "access",
      pwd_change_required: true,
    });
  });

  it("rotates a valid refresh token and creates a child token in the same family", async () => {
    const secureTokens = new SecureTokenService(16);
    const rawRefreshToken = "refresh-token";
    const repository = new FakeTokenRepository();
    repository.refreshRecord = {
      expiresAt: new Date("2026-07-31T00:00:00.000Z"),
      familyId: "55555555-5555-4555-8555-555555555555",
      id: "old-token",
      session: {
        expiresAt: new Date("2026-07-31T00:00:00.000Z"),
        id: sessionId,
        passwordExpiresAt: new Date("2026-07-29T00:00:00.000Z"),
        rememberMe: false,
        revokedAt: null,
        tenantId,
        userId,
      },
      state: "ACTIVE",
      tenantId,
      tokenHash: secureTokens.hashToken(rawRefreshToken),
      userId,
    };
    const service = new AuthTokenService(
      repository,
      secureTokens,
      {
        accessTokenTtlMinutes: 15,
        issuer: "supportdesk-test",
        refreshTokenTtlMinutes: 60,
        secret,
      },
      () => new Date("2026-07-30T00:00:00.000Z"),
    );

    const result = await service.refreshTokenPair({ refreshToken: rawRefreshToken });

    expect(result.status).toBe("refreshed");
    expect(repository.rotatedTokenId).toBe("old-token");
    expect(repository.createdRefresh[0]).toMatchObject({
      familyId: "55555555-5555-4555-8555-555555555555",
      parentTokenId: "old-token",
    });
    expect(result.status).toBe("refreshed");

    if (result.status === "refreshed") {
      const verified = await jwtVerify(result.accessToken, new TextEncoder().encode(secret), {
        currentDate: new Date("2026-07-30T00:00:00.000Z"),
        issuer: "supportdesk-test",
      });

      expect(verified.payload["pwd_change_required"]).toBe(true);
    }
  });

  it("preserves remember-me refresh token lifetime during rotation", async () => {
    const secureTokens = new SecureTokenService(16);
    const rawRefreshToken = "remember-me-refresh-token";
    const repository = new FakeTokenRepository();
    repository.refreshRecord = {
      expiresAt: new Date("2026-07-31T00:00:00.000Z"),
      familyId: "55555555-5555-4555-8555-555555555555",
      id: "old-token",
      session: {
        expiresAt: new Date("2026-08-29T00:00:00.000Z"),
        id: sessionId,
        passwordExpiresAt: null,
        rememberMe: true,
        revokedAt: null,
        tenantId,
        userId,
      },
      state: "ACTIVE",
      tenantId,
      tokenHash: secureTokens.hashToken(rawRefreshToken),
      userId,
    };
    const service = new AuthTokenService(
      repository,
      secureTokens,
      {
        accessTokenTtlMinutes: 15,
        issuer: "supportdesk-test",
        refreshTokenTtlMinutes: 60,
        rememberMeRefreshTokenTtlMinutes: 43_200,
        secret,
      },
      () => new Date("2026-07-30T00:00:00.000Z"),
    );

    const result = await service.refreshTokenPair({ refreshToken: rawRefreshToken });

    expect(result).toMatchObject({
      refreshTokenExpiresAt: new Date("2026-08-29T00:00:00.000Z"),
      status: "refreshed",
    });
    expect(repository.createdRefresh[0]?.expiresAt).toEqual(new Date("2026-08-29T00:00:00.000Z"));
  });

  it("revokes a token family when a rotated refresh token is replayed", async () => {
    const secureTokens = new SecureTokenService(16);
    const rawRefreshToken = "replayed-token";
    const repository = new FakeTokenRepository();
    repository.replayRecord = {
      expiresAt: new Date("2026-07-31T00:00:00.000Z"),
      familyId: "55555555-5555-4555-8555-555555555555",
      id: "old-token",
      session: {
        expiresAt: new Date("2026-07-31T00:00:00.000Z"),
        id: sessionId,
        passwordExpiresAt: null,
        rememberMe: false,
        revokedAt: null,
        tenantId,
        userId,
      },
      state: "ROTATED",
      tenantId,
      tokenHash: secureTokens.hashToken(rawRefreshToken),
      userId,
    };
    const service = new AuthTokenService(repository, secureTokens, {
      accessTokenTtlMinutes: 15,
      issuer: "supportdesk-test",
      refreshTokenTtlMinutes: 60,
      secret,
    });

    await expect(service.refreshTokenPair({ refreshToken: rawRefreshToken })).resolves.toEqual({
      status: "denied",
    });
    expect(repository.revokedFamilyId).toBe("55555555-5555-4555-8555-555555555555");
    expect(repository.audits).toContainEqual({
      action: "auth.refresh_token.reuse_detected",
      outcome: "DENIED",
      tenantId,
    });
  });
});
