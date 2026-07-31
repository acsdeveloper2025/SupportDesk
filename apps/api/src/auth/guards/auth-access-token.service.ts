import { Inject, Injectable, Optional } from "@nestjs/common";
import { jwtVerify } from "jose";

import { IdentityLookupService } from "../../identity/identity-lookup.service";
import { AuthSessionRepository } from "../session/auth-session.repository";
import type { AuthenticatedRequestContext } from "./auth-context";

interface AuthAccessTokenConfig {
  issuer: string;
  secret: string;
}

type DenialReason =
  | "identity_unavailable"
  | "session_mismatch"
  | "session_unavailable"
  | "token_invalid"
  | "token_missing";

export type AuthAccessTokenResult =
  | {
      context: AuthenticatedRequestContext;
      status: "authenticated";
    }
  | {
      reason: DenialReason;
      status: "denied";
    };

@Injectable()
export class AuthAccessTokenService {
  private readonly config: AuthAccessTokenConfig;
  private readonly now: () => Date;

  constructor(
    @Inject(AuthSessionRepository)
    private readonly sessions: Pick<AuthSessionRepository, "findActiveSession">,
    @Inject(IdentityLookupService)
    private readonly identity: Pick<IdentityLookupService, "loadTenantUserIdentity">,
    @Optional() @Inject("AuthAccessTokenConfig") config?: Partial<AuthAccessTokenConfig>,
    @Optional() @Inject("AuthAccessTokenClock") now?: () => Date,
  ) {
    this.config = {
      issuer: config?.issuer ?? process.env.JWT_ISSUER ?? "supportdesk-api",
      secret: config?.secret ?? process.env.JWT_SECRET ?? "",
    };
    this.now = now ?? (() => new Date());
  }

  async authenticateBearer(header: string | undefined): Promise<AuthAccessTokenResult> {
    const token = parseBearerToken(header);

    if (!token) {
      return {
        reason: "token_missing",
        status: "denied",
      };
    }

    const payload = await this.verifyToken(token);

    if (!payload) {
      return {
        reason: "token_invalid",
        status: "denied",
      };
    }

    const session = await this.sessions.findActiveSession(payload.sessionId);

    if (!session || session.expiresAt.getTime() <= this.now().getTime()) {
      return {
        reason: "session_unavailable",
        status: "denied",
      };
    }

    if (session.tenantId !== payload.tenantId || session.userId !== payload.userId) {
      return {
        reason: "session_mismatch",
        status: "denied",
      };
    }

    const identity = await this.identity.loadTenantUserIdentity({
      tenantId: payload.tenantId,
      userId: payload.userId,
    });

    if (identity.status !== "found") {
      return {
        reason: "identity_unavailable",
        status: "denied",
      };
    }

    return {
      context: {
        email: identity.identity.email,
        emailNormalized: identity.identity.emailNormalized,
        emailVerified: identity.identity.emailVerified,
        passwordChangeRequired: payload.passwordChangeRequired,
        permissions: identity.identity.permissions,
        preferences: identity.identity.preferences,
        profile: identity.identity.profile,
        publicId: identity.identity.publicId,
        roles: identity.identity.roles,
        sessionId: payload.sessionId,
        tenantId: payload.tenantId,
        userId: payload.userId,
      },
      status: "authenticated",
    };
  }

  private async verifyToken(token: string): Promise<VerifiedAccessPayload | null> {
    if (this.config.secret.length < 32) {
      return null;
    }

    try {
      const verified = await jwtVerify(token, new TextEncoder().encode(this.config.secret), {
        currentDate: this.now(),
        issuer: this.config.issuer,
      });
      const payload = verified.payload;
      const sessionId = typeof payload["sid"] === "string" ? payload["sid"] : null;
      const tenantId = typeof payload["tid"] === "string" ? payload["tid"] : null;
      const type = payload["typ"];
      const userId = typeof payload.sub === "string" ? payload.sub : null;

      if (!sessionId || !tenantId || !userId || type !== "access") {
        return null;
      }

      return {
        passwordChangeRequired: payload["pwd_change_required"] === true,
        sessionId,
        tenantId,
        userId,
      };
    } catch {
      return null;
    }
  }
}

interface VerifiedAccessPayload {
  passwordChangeRequired: boolean;
  sessionId: string;
  tenantId: string;
  userId: string;
}

function parseBearerToken(header: string | undefined): string | null {
  const normalized = header?.trim();

  if (!normalized) {
    return null;
  }

  const [scheme, token, extra] = normalized.split(/\s+/);

  return scheme?.toLowerCase() === "bearer" && token && !extra ? token : null;
}
