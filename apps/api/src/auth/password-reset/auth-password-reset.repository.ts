import { Inject, Injectable } from "@nestjs/common";
import {
  AuditOutcome,
  AuthTokenPurpose,
  AuthTokenState,
  Prisma,
  RefreshTokenState,
  SessionState,
  TenantState,
  UserState,
} from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";

export interface PasswordResetCandidate {
  emailNormalized: string;
  id: string;
  tenantId: string;
}

export interface CreatePasswordResetTokenInput {
  correlationId?: string;
  emailHash: string;
  expiresAt: Date;
  tenantId: string;
  tokenHash: string;
  userId: string;
}

export interface PasswordResetTokenRecord {
  emailNormalized: string;
  expiresAt: Date;
  id: string;
  passwordExpiresDays: number | null;
  passwordHash: string;
  state: string;
  tenantId: string;
  userId: string;
  userState: string;
}

export interface CompletePasswordResetInput {
  passwordChangedAt: Date;
  passwordExpiresAt: Date | null;
  passwordHash: string;
  tenantId: string;
  tokenId: string;
  userId: string;
}

export interface AuthPasswordResetAuditInput {
  action: string;
  actorUserId?: string | null;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  outcome: keyof typeof AuditOutcome;
  tenantId?: string | null;
}

export abstract class AuthPasswordResetRepository {
  abstract findPasswordResetCandidate(
    tenantId: string,
    emailNormalized: string,
  ): Promise<PasswordResetCandidate | null>;

  abstract createPasswordResetToken(input: CreatePasswordResetTokenInput): Promise<void>;

  abstract findPasswordResetTokenByHash(
    tokenHash: string,
  ): Promise<PasswordResetTokenRecord | null>;

  abstract markPasswordResetTokenExpired(tokenId: string): Promise<void>;

  abstract completePasswordReset(input: CompletePasswordResetInput): Promise<void>;

  abstract recordAuthAuditEvent(input: AuthPasswordResetAuditInput): Promise<void>;
}

@Injectable()
export class PrismaAuthPasswordResetRepository implements AuthPasswordResetRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findPasswordResetCandidate(
    tenantId: string,
    emailNormalized: string,
  ): Promise<PasswordResetCandidate | null> {
    const user = await this.prisma.user.findFirst({
      select: {
        emailNormalized: true,
        id: true,
      },
      where: {
        deletedAt: null,
        emailNormalized,
        emailVerifiedAt: {
          not: null,
        },
        roles: {
          some: {
            revokedAt: null,
            role: {
              deletedAt: null,
            },
            tenant: {
              deletedAt: null,
              state: TenantState.ACTIVE,
            },
            tenantId,
          },
        },
        state: UserState.ACTIVE,
      },
    });

    return user
      ? {
          emailNormalized: user.emailNormalized,
          id: user.id,
          tenantId,
        }
      : null;
  }

  async createPasswordResetToken(input: CreatePasswordResetTokenInput): Promise<void> {
    await this.prisma.authToken.create({
      data: {
        correlationId: input.correlationId,
        expiresAt: input.expiresAt,
        metadata: {
          emailHash: input.emailHash,
        },
        purpose: AuthTokenPurpose.PASSWORD_RESET,
        state: AuthTokenState.ACTIVE,
        tenantId: input.tenantId,
        tokenHash: input.tokenHash,
        userId: input.userId,
      },
    });
  }

  async findPasswordResetTokenByHash(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
    const token = await this.prisma.authToken.findFirst({
      select: {
        expiresAt: true,
        id: true,
        state: true,
        tenant: {
          select: {
            passwordExpiresDays: true,
          },
        },
        tenantId: true,
        user: {
          select: {
            emailNormalized: true,
            passwordHash: true,
            state: true,
          },
        },
        userId: true,
      },
      where: {
        purpose: AuthTokenPurpose.PASSWORD_RESET,
        tokenHash,
      },
    });

    return token
      ? {
          emailNormalized: token.user.emailNormalized,
          expiresAt: token.expiresAt,
          id: token.id,
          passwordExpiresDays: token.tenant.passwordExpiresDays,
          passwordHash: token.user.passwordHash,
          state: token.state,
          tenantId: token.tenantId,
          userId: token.userId,
          userState: token.user.state,
        }
      : null;
  }

  async markPasswordResetTokenExpired(tokenId: string): Promise<void> {
    await this.prisma.authToken.update({
      data: {
        state: AuthTokenState.EXPIRED,
      },
      where: {
        id: tokenId,
      },
    });
  }

  async completePasswordReset(input: CompletePasswordResetInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.authToken.update({
        data: {
          state: AuthTokenState.USED,
          usedAt: input.passwordChangedAt,
        },
        where: {
          id: input.tokenId,
        },
      });
      await tx.user.update({
        data: {
          failedLoginCount: 0,
          failedLoginWindowStartedAt: null,
          lockedUntil: null,
          passwordChangedAt: input.passwordChangedAt,
          passwordExpiresAt: input.passwordExpiresAt,
          passwordHash: input.passwordHash,
        },
        where: {
          id: input.userId,
        },
      });
      await tx.session.updateMany({
        data: {
          revokeReason: "password_reset",
          revokedAt: input.passwordChangedAt,
          state: SessionState.REVOKED,
        },
        where: {
          state: SessionState.ACTIVE,
          tenantId: input.tenantId,
          userId: input.userId,
        },
      });
      await tx.refreshToken.updateMany({
        data: {
          revokeReason: "password_reset",
          revokedAt: input.passwordChangedAt,
          state: RefreshTokenState.REVOKED,
        },
        where: {
          state: {
            in: [RefreshTokenState.ACTIVE, RefreshTokenState.ROTATED],
          },
          tenantId: input.tenantId,
          userId: input.userId,
        },
      });
    });
  }

  async recordAuthAuditEvent(input: AuthPasswordResetAuditInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        action: input.action,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        outcome: AuditOutcome[input.outcome],
        tenantId: input.tenantId,
      },
    });
  }
}
