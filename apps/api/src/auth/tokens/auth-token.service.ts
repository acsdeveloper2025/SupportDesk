import { randomUUID } from "node:crypto";

import { Inject, Injectable, Optional } from "@nestjs/common";
import { SignJWT } from "jose";

import { SecureTokenService } from "../security/secure-token.service";
import { AuthTokenRepository } from "./auth-token.repository";

export interface AuthTokenConfig {
  accessTokenTtlMinutes: number;
  issuer: string;
  refreshTokenTtlMinutes: number;
  rememberMeRefreshTokenTtlMinutes?: number;
  secret: string;
}

export interface IssueTokenPairInput {
  passwordChangeRequired: boolean;
  rememberMe: boolean;
  sessionId: string;
  tenantId: string;
  userId: string;
}

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export type RefreshTokenResult =
  | ({
      status: "refreshed";
    } & TokenPair)
  | {
      status: "denied";
    };

@Injectable()
export class AuthTokenService {
  private readonly config: AuthTokenConfig;
  private readonly now: () => Date;

  constructor(
    @Inject(AuthTokenRepository) private readonly repository: AuthTokenRepository,
    @Inject(SecureTokenService)
    private readonly secureTokens: SecureTokenService,
    @Optional() @Inject("AuthTokenConfig") config?: Partial<AuthTokenConfig>,
    @Optional() @Inject("AuthTokenClock") now?: () => Date,
  ) {
    this.now = now ?? (() => new Date());
    this.config = {
      accessTokenTtlMinutes:
        config?.accessTokenTtlMinutes ?? readPositiveInteger("JWT_ACCESS_TOKEN_TTL_MINUTES", 15),
      issuer: config?.issuer ?? process.env.JWT_ISSUER ?? "supportdesk-api",
      refreshTokenTtlMinutes:
        config?.refreshTokenTtlMinutes ?? readPositiveInteger("REFRESH_TOKEN_TTL_MINUTES", 10_080),
      rememberMeRefreshTokenTtlMinutes:
        config?.rememberMeRefreshTokenTtlMinutes ??
        readPositiveInteger("REMEMBER_ME_REFRESH_TOKEN_TTL_MINUTES", 43_200),
      secret: config?.secret ?? process.env.JWT_SECRET ?? "",
    };
  }

  async issueTokenPair(input: IssueTokenPairInput): Promise<TokenPair> {
    const accessTokenExpiresAt = addMinutes(this.now(), this.config.accessTokenTtlMinutes);
    const refreshTokenExpiresAt = addMinutes(
      this.now(),
      input.rememberMe
        ? (this.config.rememberMeRefreshTokenTtlMinutes ?? this.config.refreshTokenTtlMinutes)
        : this.config.refreshTokenTtlMinutes,
    );
    const refreshToken = this.secureTokens.generateToken();

    await this.repository.createRefreshToken({
      expiresAt: refreshTokenExpiresAt,
      familyId: randomUUID(),
      sessionId: input.sessionId,
      tenantId: input.tenantId,
      tokenHash: refreshToken.tokenHash,
      userId: input.userId,
    });

    return {
      accessToken: await this.signAccessToken(input, accessTokenExpiresAt),
      accessTokenExpiresAt,
      refreshToken: refreshToken.token,
      refreshTokenExpiresAt,
    };
  }

  async refreshTokenPair(input: { refreshToken?: string }): Promise<RefreshTokenResult> {
    const rawToken = input.refreshToken?.trim();

    if (!rawToken) {
      return {
        status: "denied",
      };
    }

    const tokenHash = this.secureTokens.hashToken(rawToken);
    const storedToken = await this.repository.findRefreshTokenByHash(tokenHash);

    if (!storedToken) {
      return {
        status: "denied",
      };
    }

    if (storedToken.state !== "ACTIVE") {
      await this.repository.revokeRefreshTokenFamily(storedToken.familyId);
      await this.repository.recordAuthAuditEvent({
        action: "auth.refresh_token.reuse_detected",
        actorUserId: storedToken.userId,
        outcome: "DENIED",
        tenantId: storedToken.tenantId,
      });

      return {
        status: "denied",
      };
    }

    if (
      storedToken.expiresAt.getTime() <= this.now().getTime() ||
      storedToken.session.revokedAt !== null ||
      storedToken.session.expiresAt.getTime() <= this.now().getTime()
    ) {
      return {
        status: "denied",
      };
    }

    await this.repository.markRefreshTokenRotated(storedToken.id);
    const nextRefreshToken = this.secureTokens.generateToken();
    const refreshTokenExpiresAt = addMinutes(
      this.now(),
      storedToken.session.rememberMe
        ? (this.config.rememberMeRefreshTokenTtlMinutes ?? this.config.refreshTokenTtlMinutes)
        : this.config.refreshTokenTtlMinutes,
    );
    await this.repository.createRefreshToken({
      expiresAt: refreshTokenExpiresAt,
      familyId: storedToken.familyId,
      parentTokenId: storedToken.id,
      sessionId: storedToken.session.id,
      tenantId: storedToken.tenantId,
      tokenHash: nextRefreshToken.tokenHash,
      userId: storedToken.userId,
    });
    const accessTokenExpiresAt = addMinutes(this.now(), this.config.accessTokenTtlMinutes);

    return {
      accessToken: await this.signAccessToken(
        {
          passwordChangeRequired:
            storedToken.session.passwordExpiresAt !== null &&
            storedToken.session.passwordExpiresAt.getTime() <= this.now().getTime(),
          rememberMe: storedToken.session.rememberMe,
          sessionId: storedToken.session.id,
          tenantId: storedToken.tenantId,
          userId: storedToken.userId,
        },
        accessTokenExpiresAt,
      ),
      accessTokenExpiresAt,
      refreshToken: nextRefreshToken.token,
      refreshTokenExpiresAt,
      status: "refreshed",
    };
  }

  private async signAccessToken(input: IssueTokenPairInput, expiresAt: Date): Promise<string> {
    if (this.config.secret.length < 32) {
      throw new Error("JWT_SECRET must be at least 32 characters.");
    }

    return new SignJWT({
      pwd_change_required: input.passwordChangeRequired,
      sid: input.sessionId,
      tid: input.tenantId,
      typ: "access",
    })
      .setProtectedHeader({
        alg: "HS256",
      })
      .setIssuedAt(Math.floor(this.now().getTime() / 1000))
      .setIssuer(this.config.issuer)
      .setSubject(input.userId)
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(new TextEncoder().encode(this.config.secret));
  }
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);

  return Number.isInteger(value) && value > 0 ? value : fallback;
}
