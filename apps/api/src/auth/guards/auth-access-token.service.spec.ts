import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import type {
  ActiveSessionRecord,
  AuthSessionRepository,
} from "../session/auth-session.repository";
import { AuthAccessTokenService } from "./auth-access-token.service";

const secret = "test-secret-that-is-long-enough-for-hs256";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const sessionId = "33333333-3333-4333-8333-333333333333";

class FakeSessionRepository implements Pick<AuthSessionRepository, "findActiveSession"> {
  session: ActiveSessionRecord | null = {
    expiresAt: new Date("2026-07-31T00:00:00.000Z"),
    id: sessionId,
    tenantId,
    userId,
  };

  findActiveSession(id: string) {
    return Promise.resolve(id === sessionId ? this.session : null);
  }
}

class FakeIdentityLookup {
  status: "found" | "unavailable" = "found";

  loadTenantUserIdentity(input: { tenantId: string; userId?: string }) {
    if (this.status === "unavailable" || input.tenantId !== tenantId || input.userId !== userId) {
      return Promise.resolve({
        status: "unavailable" as const,
      });
    }

    return Promise.resolve({
      identity: {
        email: "agent@acme.test",
        emailNormalized: "agent@acme.test",
        emailVerified: true,
        id: userId,
        permissions: [
          {
            key: "auth.session.read",
            scope: "tenant",
          },
        ],
        preferences: {
          density: "compact",
        },
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
        tenantId,
      },
      status: "found" as const,
    });
  }
}

describe("AuthAccessTokenService", () => {
  it("resolves a valid access token into a tenant-scoped authenticated context", async () => {
    const service = createService();
    const token = await signToken();

    await expect(service.authenticateBearer(`Bearer ${token}`)).resolves.toMatchObject({
      status: "authenticated",
      context: {
        passwordChangeRequired: false,
        permissions: [
          {
            key: "auth.session.read",
            scope: "tenant",
          },
        ],
        sessionId,
        tenantId,
        userId,
      },
    });
  });

  it("denies expired tokens before loading session state", async () => {
    const sessions = new FakeSessionRepository();
    const service = createService({ sessions });
    const token = await signToken({
      expiresAt: new Date("2026-07-29T00:00:00.000Z"),
    });

    await expect(service.authenticateBearer(`Bearer ${token}`)).resolves.toEqual({
      reason: "token_invalid",
      status: "denied",
    });
  });

  it("denies missing bearer credentials and non-access JWTs", async () => {
    const service = createService();
    const refreshToken = await signToken({
      type: "refresh",
    });

    await expect(service.authenticateBearer(undefined)).resolves.toEqual({
      reason: "token_missing",
      status: "denied",
    });
    await expect(service.authenticateBearer(`Bearer ${refreshToken}`)).resolves.toEqual({
      reason: "token_invalid",
      status: "denied",
    });
  });

  it("denies tokens whose session no longer matches the persisted tenant and user", async () => {
    const sessions = new FakeSessionRepository();
    sessions.session = {
      expiresAt: new Date("2026-07-31T00:00:00.000Z"),
      id: sessionId,
      tenantId: "99999999-9999-4999-8999-999999999999",
      userId,
    };
    const service = createService({ sessions });
    const token = await signToken();

    await expect(service.authenticateBearer(`Bearer ${token}`)).resolves.toEqual({
      reason: "session_mismatch",
      status: "denied",
    });
  });

  it("denies active tokens when the tenant user identity cannot be loaded", async () => {
    const identity = new FakeIdentityLookup();
    identity.status = "unavailable";
    const service = createService({ identity });
    const token = await signToken();

    await expect(service.authenticateBearer(`Bearer ${token}`)).resolves.toEqual({
      reason: "identity_unavailable",
      status: "denied",
    });
  });
});

function createService(input?: {
  identity?: FakeIdentityLookup;
  sessions?: FakeSessionRepository;
}) {
  return new AuthAccessTokenService(
    input?.sessions ?? new FakeSessionRepository(),
    input?.identity ?? new FakeIdentityLookup(),
    {
      issuer: "supportdesk-test",
      secret,
    },
    () => new Date("2026-07-30T00:00:00.000Z"),
  );
}

function signToken(input?: { expiresAt?: Date; type?: string }) {
  return new SignJWT({
    pwd_change_required: false,
    sid: sessionId,
    tid: tenantId,
    typ: input?.type ?? "access",
  })
    .setProtectedHeader({
      alg: "HS256",
    })
    .setIssuedAt(Math.floor(new Date("2026-07-30T00:00:00.000Z").getTime() / 1000))
    .setIssuer("supportdesk-test")
    .setSubject(userId)
    .setExpirationTime(
      Math.floor((input?.expiresAt ?? new Date("2026-07-30T00:15:00.000Z")).getTime() / 1000),
    )
    .sign(new TextEncoder().encode(secret));
}
