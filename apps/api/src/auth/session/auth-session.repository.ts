import { Inject, Injectable } from "@nestjs/common";
import {
  AuditOutcome,
  Prisma,
  SessionState,
  TenantDomainState,
  TenantState,
  UserState,
} from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import type { TenantLookupInput } from "../../identity/identity.types";
import type { AuthSessionView } from "./auth-session.types";

export interface LoginCandidate {
  emailVerified: boolean;
  failedLoginCount: number;
  failedLoginWindowMinutes: number;
  failedLoginWindowStartedAt: Date | null;
  lockoutDurationMinutes: number;
  lockoutThreshold: number;
  lockedUntil: Date | null;
  passwordExpiresAt: Date | null;
  passwordHash: string;
  state: string;
  tenantId: string;
  userId: string;
}

export interface FailedLoginAttemptInput {
  failedLoginWindowMinutes: number;
  lockoutDurationMinutes: number;
  lockoutThreshold: number;
  now: Date;
  userId: string;
}

export interface ActiveSessionRecord {
  expiresAt: Date;
  id: string;
  tenantId: string;
  userId: string;
}

export interface CreateSessionInput {
  correlationId?: string;
  deviceName?: string;
  expiresAt: Date;
  ipAddress?: string;
  rememberMe: boolean;
  tenantId: string;
  userAgent?: string;
  userId: string;
}

export interface AuthSessionAuditInput {
  action: string;
  actorUserId?: string | null;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  outcome: keyof typeof AuditOutcome;
  tenantId?: string | null;
}

export abstract class AuthSessionRepository {
  abstract resolveTenantId(input: TenantLookupInput | undefined): Promise<string | null>;

  abstract findLoginCandidate(
    tenantId: string,
    emailNormalized: string,
  ): Promise<LoginCandidate | null>;

  abstract createSession(input: CreateSessionInput): Promise<AuthSessionView>;

  abstract recordFailedLoginAttempt(
    input: FailedLoginAttemptInput,
  ): Promise<{ justLocked: boolean; lockedUntil: Date | null }>;

  abstract clearFailedLoginAttempts(userId: string): Promise<void>;

  abstract findActiveSession(sessionId: string): Promise<ActiveSessionRecord | null>;

  abstract listUserSessions(tenantId: string, userId: string): Promise<AuthSessionView[]>;

  abstract revokeSession(sessionId: string): Promise<void>;

  abstract recordAuthAuditEvent(input: AuthSessionAuditInput): Promise<void>;
}

@Injectable()
export class PrismaAuthSessionRepository implements AuthSessionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolveTenantId(input: TenantLookupInput | undefined): Promise<string | null> {
    const slug = input?.slug?.trim().toLowerCase();
    const tenantId = input?.tenantId?.trim();
    const publicId = input?.publicId?.trim();
    const domain = input?.domain?.trim().toLowerCase();

    if (tenantId || publicId || slug) {
      const tenant = await this.prisma.tenant.findFirst({
        select: {
          id: true,
        },
        where: {
          deletedAt: null,
          id: tenantId || undefined,
          publicId: publicId || undefined,
          slug: slug || undefined,
          state: TenantState.ACTIVE,
        },
      });

      return tenant?.id ?? null;
    }

    if (!domain) {
      return null;
    }

    const tenantDomain = await this.prisma.tenantDomain.findFirst({
      select: {
        tenantId: true,
      },
      where: {
        domain,
        state: TenantDomainState.VERIFIED,
        tenant: {
          deletedAt: null,
          state: TenantState.ACTIVE,
        },
      },
    });

    return tenantDomain?.tenantId ?? null;
  }

  async findLoginCandidate(
    tenantId: string,
    emailNormalized: string,
  ): Promise<LoginCandidate | null> {
    const user = await this.prisma.user.findFirst({
      select: {
        emailVerifiedAt: true,
        failedLoginCount: true,
        failedLoginWindowStartedAt: true,
        id: true,
        lockedUntil: true,
        passwordExpiresAt: true,
        passwordHash: true,
        state: true,
        roles: {
          select: {
            tenant: {
              select: {
                failedLoginLockoutThreshold: true,
                failedLoginWindowMinutes: true,
                lockoutDurationMinutes: true,
              },
            },
          },
          take: 1,
          where: {
            revokedAt: null,
            tenantId,
          },
        },
      },
      where: {
        deletedAt: null,
        emailNormalized,
        roles: {
          some: {
            revokedAt: null,
            role: {
              deletedAt: null,
            },
            tenantId,
          },
        },
      },
    });

    return user
      ? {
          emailVerified: user.emailVerifiedAt !== null,
          failedLoginCount: user.failedLoginCount,
          failedLoginWindowMinutes: user.roles[0]?.tenant.failedLoginWindowMinutes ?? 15,
          failedLoginWindowStartedAt: user.failedLoginWindowStartedAt,
          lockoutDurationMinutes: user.roles[0]?.tenant.lockoutDurationMinutes ?? 30,
          lockoutThreshold: user.roles[0]?.tenant.failedLoginLockoutThreshold ?? 5,
          lockedUntil: user.lockedUntil,
          passwordExpiresAt: user.passwordExpiresAt,
          passwordHash: user.passwordHash,
          state: user.state,
          tenantId,
          userId: user.id,
        }
      : null;
  }

  async recordFailedLoginAttempt(
    input: FailedLoginAttemptInput,
  ): Promise<{ justLocked: boolean; lockedUntil: Date | null }> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        select: {
          failedLoginCount: true,
          failedLoginWindowStartedAt: true,
          lockedUntil: true,
        },
        where: {
          id: input.userId,
        },
      });
      const windowStartedAt =
        user.failedLoginWindowStartedAt === null ||
        user.failedLoginWindowStartedAt.getTime() <=
          input.now.getTime() - input.failedLoginWindowMinutes * 60_000
          ? input.now
          : user.failedLoginWindowStartedAt;
      const failedLoginCount = windowStartedAt === input.now ? 1 : user.failedLoginCount + 1;
      const justLocked =
        failedLoginCount >= input.lockoutThreshold &&
        (user.lockedUntil === null || user.lockedUntil.getTime() <= input.now.getTime());
      const lockedUntil = justLocked
        ? new Date(input.now.getTime() + input.lockoutDurationMinutes * 60_000)
        : user.lockedUntil;

      await tx.user.update({
        data: {
          failedLoginCount,
          failedLoginWindowStartedAt: windowStartedAt,
          lockedUntil,
        },
        where: {
          id: input.userId,
        },
      });

      return {
        justLocked,
        lockedUntil,
      };
    });
  }

  async clearFailedLoginAttempts(userId: string): Promise<void> {
    await this.prisma.user.update({
      data: {
        failedLoginCount: 0,
        failedLoginWindowStartedAt: null,
        lockedUntil: null,
      },
      where: {
        id: userId,
      },
    });
  }

  async createSession(input: CreateSessionInput): Promise<AuthSessionView> {
    return this.prisma.session.create({
      data: {
        correlationId: input.correlationId,
        deviceName: input.deviceName,
        expiresAt: input.expiresAt,
        ipAddress: input.ipAddress,
        rememberMe: input.rememberMe,
        tenantId: input.tenantId,
        userAgent: input.userAgent,
        userId: input.userId,
      },
      select: sessionViewSelect,
    });
  }

  async findActiveSession(sessionId: string): Promise<ActiveSessionRecord | null> {
    return this.prisma.session.findFirst({
      select: {
        expiresAt: true,
        id: true,
        tenantId: true,
        userId: true,
      },
      where: {
        id: sessionId,
        revokedAt: null,
        state: SessionState.ACTIVE,
      },
    });
  }

  async listUserSessions(tenantId: string, userId: string): Promise<AuthSessionView[]> {
    return this.prisma.session.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: sessionViewSelect,
      where: {
        revokedAt: null,
        state: SessionState.ACTIVE,
        tenantId,
        userId,
      },
    });
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      data: {
        revokeReason: "logout",
        revokedAt: new Date(),
        state: SessionState.REVOKED,
      },
      where: {
        id: sessionId,
        state: SessionState.ACTIVE,
      },
    });
  }

  async recordAuthAuditEvent(input: AuthSessionAuditInput): Promise<void> {
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

const sessionViewSelect = {
  deviceName: true,
  expiresAt: true,
  id: true,
  lastSeenAt: true,
  rememberMe: true,
  state: true,
} as const;

export function isActiveUserState(state: string): boolean {
  return state === UserState.ACTIVE;
}
