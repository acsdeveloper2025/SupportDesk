import { Inject, Injectable } from "@nestjs/common";
import { RefreshTokenState, SessionState, TenantState, UserState } from "@prisma/client";

import { type AuditEventInput, buildAuditEventData } from "../../audit/audit-event";
import { PrismaService } from "../../database/prisma.service";

export interface PasswordChangeIdentity {
  emailNormalized: string;
  passwordExpiresDays: number | null;
  passwordHash: string;
  tenantId: string;
  userId: string;
}

export interface CompletePasswordChangeInput {
  passwordChangedAt: Date;
  passwordExpiresAt: Date | null;
  passwordHash: string;
  tenantId: string;
  userId: string;
}

export type AuthPasswordAuditInput = AuditEventInput;

export abstract class AuthPasswordRepository {
  abstract findPasswordChangeIdentity(sessionId: string): Promise<PasswordChangeIdentity | null>;

  abstract completePasswordChange(input: CompletePasswordChangeInput): Promise<void>;

  abstract recordAuthAuditEvent(input: AuthPasswordAuditInput): Promise<void>;
}

@Injectable()
export class PrismaAuthPasswordRepository implements AuthPasswordRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findPasswordChangeIdentity(sessionId: string): Promise<PasswordChangeIdentity | null> {
    const session = await this.prisma.session.findFirst({
      select: {
        tenant: {
          select: {
            passwordExpiresDays: true,
          },
        },
        tenantId: true,
        user: {
          select: {
            emailNormalized: true,
            id: true,
            passwordHash: true,
          },
        },
      },
      where: {
        expiresAt: {
          gt: new Date(),
        },
        id: sessionId,
        revokedAt: null,
        state: SessionState.ACTIVE,
        tenant: {
          deletedAt: null,
          state: TenantState.ACTIVE,
        },
        user: {
          deletedAt: null,
          state: UserState.ACTIVE,
        },
      },
    });

    return session
      ? {
          emailNormalized: session.user.emailNormalized,
          passwordExpiresDays: session.tenant.passwordExpiresDays,
          passwordHash: session.user.passwordHash,
          tenantId: session.tenantId,
          userId: session.user.id,
        }
      : null;
  }

  async completePasswordChange(input: CompletePasswordChangeInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
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
          revokeReason: "password_change",
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
          revokeReason: "password_change",
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

  async recordAuthAuditEvent(input: AuthPasswordAuditInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: buildAuditEventData(input),
    });
  }
}
