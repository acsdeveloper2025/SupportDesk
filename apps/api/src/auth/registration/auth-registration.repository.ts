import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { AuditOutcome, AuthTokenPurpose, AuthTokenState, Prisma, UserState } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";

export interface PendingUserRegistrationInput {
  correlationId?: string;
  displayName: string | null;
  email: string;
  emailHash: string;
  emailNormalized: string;
  expiresAt: Date;
  firstName: string | null;
  language: string;
  lastName: string | null;
  locale: string;
  passwordHash: string;
  profilePicturePlaceholder: string | null;
  tenantId: string;
  timeZone: string;
  verificationTokenHash: string;
}

export interface PendingUserRegistrationRecord {
  tenantId: string;
  userId: string;
}

export interface VerificationTokenRecord {
  expiresAt: Date;
  id: string;
  tenantId: string;
  userId: string;
}

export interface AuthAuditEventInput {
  action: string;
  actorUserId?: string | null;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  outcome: keyof typeof AuditOutcome;
  tenantId?: string | null;
}

export abstract class AuthRegistrationRepository {
  abstract findTenantUserByEmail(
    tenantId: string,
    emailNormalized: string,
  ): Promise<{ id: string } | null>;

  abstract createPendingUserRegistration(
    input: PendingUserRegistrationInput,
  ): Promise<PendingUserRegistrationRecord>;

  abstract findActiveEmailVerificationToken(
    tokenHash: string,
  ): Promise<VerificationTokenRecord | null>;

  abstract markVerificationTokenExpired(tokenId: string): Promise<void>;

  abstract completeEmailVerification(tokenId: string): Promise<PendingUserRegistrationRecord>;

  abstract recordAuthAuditEvent(input: AuthAuditEventInput): Promise<void>;
}

@Injectable()
export class PrismaAuthRegistrationRepository implements AuthRegistrationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findTenantUserByEmail(
    tenantId: string,
    emailNormalized: string,
  ): Promise<{ id: string } | null> {
    return this.prisma.user.findFirst({
      select: {
        id: true,
      },
      where: {
        emailNormalized,
        roles: {
          some: {
            revokedAt: null,
            tenantId,
          },
        },
      },
    });
  }

  async createPendingUserRegistration(
    input: PendingUserRegistrationInput,
  ): Promise<PendingUserRegistrationRecord> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          emailNormalized: input.emailNormalized,
          passwordHash: input.passwordHash,
          profile: {
            create: {
              displayName: input.displayName,
              firstName: input.firstName,
              language: input.language,
              lastName: input.lastName,
              locale: input.locale,
              profilePicturePlaceholder: input.profilePicturePlaceholder,
              timeZone: input.timeZone,
            },
          },
          preferences: {
            create: {
              preferences: {},
            },
          },
          state: UserState.INVITED,
        },
        select: {
          id: true,
        },
      });
      const role =
        (await tx.role.findFirst({
          select: {
            id: true,
          },
          where: {
            deletedAt: null,
            key: "requester",
            tenantId: input.tenantId,
          },
        })) ??
        (await tx.role.create({
          data: {
            isSystem: true,
            key: "requester",
            name: "Requester",
            tenantId: input.tenantId,
          },
          select: {
            id: true,
          },
        }));

      await tx.userRole.create({
        data: {
          roleId: role.id,
          tenantId: input.tenantId,
          userId: user.id,
        },
      });
      await tx.authToken.create({
        data: {
          correlationId: input.correlationId,
          expiresAt: input.expiresAt,
          metadata: {
            emailHash: input.emailHash,
          },
          purpose: AuthTokenPurpose.EMAIL_VERIFICATION,
          state: AuthTokenState.ACTIVE,
          tenantId: input.tenantId,
          tokenHash: input.verificationTokenHash,
          userId: user.id,
        },
      });

      return {
        tenantId: input.tenantId,
        userId: user.id,
      };
    });
  }

  async findActiveEmailVerificationToken(
    tokenHash: string,
  ): Promise<VerificationTokenRecord | null> {
    return this.prisma.authToken.findFirst({
      select: {
        expiresAt: true,
        id: true,
        tenantId: true,
        userId: true,
      },
      where: {
        purpose: AuthTokenPurpose.EMAIL_VERIFICATION,
        state: AuthTokenState.ACTIVE,
        tokenHash,
      },
    });
  }

  async markVerificationTokenExpired(tokenId: string): Promise<void> {
    await this.prisma.authToken.update({
      data: {
        state: AuthTokenState.EXPIRED,
      },
      where: {
        id: tokenId,
      },
    });
  }

  async completeEmailVerification(tokenId: string): Promise<PendingUserRegistrationRecord> {
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.authToken.update({
        data: {
          state: AuthTokenState.USED,
          usedAt: new Date(),
        },
        select: {
          tenantId: true,
          userId: true,
        },
        where: {
          id: tokenId,
        },
      });

      await tx.user.update({
        data: {
          emailVerifiedAt: new Date(),
          state: UserState.ACTIVE,
        },
        where: {
          id: token.userId,
        },
      });

      return token;
    });
  }

  async recordAuthAuditEvent(input: AuthAuditEventInput): Promise<void> {
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

export function hashIdentifier(identifier: string): string {
  return createHash("sha256").update(identifier, "utf8").digest("hex");
}
