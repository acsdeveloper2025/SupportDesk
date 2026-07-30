import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { RefreshTokenState, SessionState } from "@prisma/client";

import { type AuditEventInput, buildAuditEventData } from "../../audit/audit-event";
import { PrismaService } from "../../database/prisma.service";

export interface RefreshTokenSessionRecord {
  expiresAt: Date;
  id: string;
  passwordExpiresAt: Date | null;
  rememberMe: boolean;
  revokedAt: Date | null;
  tenantId: string;
  userId: string;
}

export interface RefreshTokenRecord {
  expiresAt: Date;
  familyId: string;
  id: string;
  session: RefreshTokenSessionRecord;
  state: string;
  tenantId: string;
  tokenHash: string;
  userId: string;
}

export interface CreateRefreshTokenInput {
  expiresAt: Date;
  familyId?: string;
  parentTokenId?: string | null;
  sessionId: string;
  tenantId: string;
  tokenHash: string;
  userId: string;
}

export type AuthTokenAuditInput = AuditEventInput;

export abstract class AuthTokenRepository {
  abstract createRefreshToken(
    input: CreateRefreshTokenInput,
  ): Promise<{ familyId: string; id: string }>;

  abstract findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;

  abstract markRefreshTokenRotated(tokenId: string): Promise<void>;

  abstract revokeRefreshTokenFamily(familyId: string): Promise<void>;

  abstract recordAuthAuditEvent(input: AuthTokenAuditInput): Promise<void>;
}

@Injectable()
export class PrismaAuthTokenRepository implements AuthTokenRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createRefreshToken(
    input: CreateRefreshTokenInput,
  ): Promise<{ familyId: string; id: string }> {
    const familyId = input.familyId ?? randomUUID();

    return this.prisma.refreshToken.create({
      data: {
        expiresAt: input.expiresAt,
        familyId,
        parentTokenId: input.parentTokenId,
        sessionId: input.sessionId,
        state: RefreshTokenState.ACTIVE,
        tenantId: input.tenantId,
        tokenHash: input.tokenHash,
        userId: input.userId,
      },
      select: {
        familyId: true,
        id: true,
      },
    });
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const token = await this.prisma.refreshToken.findUnique({
      include: {
        session: {
          select: {
            expiresAt: true,
            id: true,
            rememberMe: true,
            revokedAt: true,
            tenantId: true,
            user: {
              select: {
                passwordExpiresAt: true,
              },
            },
            userId: true,
          },
        },
      },
      where: {
        tokenHash,
      },
    });

    return token
      ? {
          ...token,
          session: {
            ...token.session,
            passwordExpiresAt: token.session.user.passwordExpiresAt,
          },
        }
      : null;
  }

  async markRefreshTokenRotated(tokenId: string): Promise<void> {
    await this.prisma.refreshToken.update({
      data: {
        rotatedAt: new Date(),
        state: RefreshTokenState.ROTATED,
        usedAt: new Date(),
      },
      where: {
        id: tokenId,
      },
    });
  }

  async revokeRefreshTokenFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      data: {
        revokedAt: new Date(),
        state: RefreshTokenState.REVOKED,
      },
      where: {
        familyId,
        state: {
          in: [RefreshTokenState.ACTIVE, RefreshTokenState.ROTATED],
        },
      },
    });
    await this.prisma.session.updateMany({
      data: {
        revokeReason: "refresh_token_reuse",
        revokedAt: new Date(),
        state: SessionState.REVOKED,
      },
      where: {
        refreshTokens: {
          some: {
            familyId,
          },
        },
      },
    });
  }

  async recordAuthAuditEvent(input: AuthTokenAuditInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: buildAuditEventData(input),
    });
  }
}
