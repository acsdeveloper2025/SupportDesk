import { Inject, Injectable, Optional } from "@nestjs/common";

import { hashIdentifier } from "../registration/auth-registration.repository";
import { PasswordHashingService } from "../security/password-hashing.service";
import { AuthTokenService } from "../tokens/auth-token.service";
import { AuthSessionRepository, isActiveUserState } from "./auth-session.repository";
import type {
  ListSessionsRequest,
  ListSessionsResult,
  LoginRequest,
  LoginResult,
  LogoutRequest,
  LogoutResult,
} from "./auth-session.types";

const accepted: LogoutResult = {
  status: "accepted",
};

const denied = {
  status: "denied",
} as const;

@Injectable()
export class AuthSessionService {
  private readonly now: () => Date;

  constructor(
    @Inject(AuthSessionRepository) private readonly repository: AuthSessionRepository,
    @Inject(PasswordHashingService)
    private readonly passwordHashing: PasswordHashingService,
    @Inject(AuthTokenService)
    private readonly tokenService: Pick<AuthTokenService, "issueTokenPair">,
    @Optional() @Inject("AuthSessionClock") now?: () => Date,
  ) {
    this.now = now ?? (() => new Date());
  }

  async login(input: LoginRequest): Promise<LoginResult> {
    const emailNormalized = normalizeEmail(input.email);
    const password = typeof input.password === "string" ? input.password : "";
    const tenantId = await this.resolveTenantId(input);

    if (!emailNormalized || !password || !tenantId) {
      await this.auditRejectedLogin(null, input, "request_invalid");

      return denied;
    }

    const candidate = await this.repository.findLoginCandidate(tenantId, emailNormalized);

    if (!candidate) {
      await this.auditRejectedLogin(tenantId, input, "candidate_unavailable");

      return denied;
    }

    if (candidate.lockedUntil !== null && candidate.lockedUntil.getTime() > this.now().getTime()) {
      await this.auditLockedLogin(candidate.userId, tenantId, input, "lockout_active");

      return denied;
    }

    const passwordMatches = await this.passwordHashing.verifyPassword(
      candidate.passwordHash,
      password,
    );

    if (!passwordMatches) {
      const attempt = await this.repository.recordFailedLoginAttempt({
        failedLoginWindowMinutes: candidate.failedLoginWindowMinutes,
        lockoutDurationMinutes: candidate.lockoutDurationMinutes,
        lockoutThreshold: candidate.lockoutThreshold,
        now: this.now(),
        userId: candidate.userId,
      });

      if (attempt.justLocked) {
        await this.auditLockedLogin(candidate.userId, tenantId, input, "threshold_reached");
      } else {
        await this.auditRejectedLogin(tenantId, input, "credentials_denied", candidate.userId);
      }

      return denied;
    }

    if (!candidate.emailVerified || !isActiveUserState(candidate.state)) {
      await this.auditRejectedLogin(tenantId, input, "credentials_denied", candidate.userId);

      return denied;
    }

    await this.repository.clearFailedLoginAttempts(candidate.userId);

    const expiresAt = addMinutes(
      this.now(),
      input.rememberMe
        ? readPositiveInteger("AUTH_REMEMBER_ME_SESSION_TTL_MINUTES", 43_200)
        : readPositiveInteger("AUTH_SESSION_TTL_MINUTES", 720),
    );
    const session = await this.repository.createSession({
      correlationId: input.correlationId,
      deviceName: input.deviceName ?? "Browser",
      expiresAt,
      rememberMe: input.rememberMe ?? false,
      tenantId,
      userAgent: input.userAgent,
      userId: candidate.userId,
    });
    const passwordChangeRequired =
      candidate.passwordExpiresAt !== null &&
      candidate.passwordExpiresAt.getTime() <= this.now().getTime();

    await this.repository.recordAuthAuditEvent({
      action: passwordChangeRequired
        ? "auth.login.password_change_required"
        : "auth.login.succeeded",
      actorUserId: candidate.userId,
      correlationId: input.correlationId,
      ipAddress: input.ipAddress,
      outcome: "SUCCESS",
      targetId: session.id,
      targetType: "session",
      tenantId,
      userAgent: input.userAgent,
    });

    return {
      session,
      status: passwordChangeRequired ? "password_change_required" : "authenticated",
      tokens: await this.tokenService.issueTokenPair({
        passwordChangeRequired,
        rememberMe: input.rememberMe ?? false,
        sessionId: session.id,
        tenantId,
        userId: candidate.userId,
      }),
    };
  }

  async logout(input: LogoutRequest): Promise<LogoutResult> {
    const currentSession = await this.resolveCurrentSession(input.currentSessionId);

    if (!currentSession) {
      return accepted;
    }

    const targetSessionId = input.targetSessionId ?? currentSession.id;
    const targetSession =
      targetSessionId === currentSession.id
        ? currentSession
        : await this.repository.findActiveSession(targetSessionId);

    if (
      targetSession &&
      targetSession.tenantId === currentSession.tenantId &&
      targetSession.userId === currentSession.userId
    ) {
      await this.repository.revokeSession(targetSession.id);
      await this.repository.recordAuthAuditEvent({
        action: targetSession.id === currentSession.id ? "auth.logout" : "auth.session.revoked",
        actorUserId: currentSession.userId,
        correlationId: input.correlationId,
        ipAddress: input.ipAddress,
        metadata: {
          reason: targetSession.id === currentSession.id ? "logout" : "user_revoked",
        },
        outcome: "SUCCESS",
        targetId: targetSession.id,
        targetType: "session",
        tenantId: currentSession.tenantId,
        userAgent: input.userAgent,
      });
    }

    return accepted;
  }

  async listSessions(input: ListSessionsRequest): Promise<ListSessionsResult> {
    const currentSession = await this.resolveCurrentSession(input.currentSessionId);

    if (!currentSession) {
      return denied;
    }

    const sessions = await this.repository.listUserSessions(
      currentSession.tenantId,
      currentSession.userId,
    );

    return {
      sessions,
      status: "ok",
    };
  }

  private async resolveTenantId(input: LoginRequest): Promise<string | null> {
    return input.tenantId ?? (await this.repository.resolveTenantId(input.tenant));
  }

  private async resolveCurrentSession(sessionId: string | undefined) {
    const normalizedSessionId = normalizeOptionalString(sessionId);

    if (!normalizedSessionId) {
      return null;
    }

    const session = await this.repository.findActiveSession(normalizedSessionId);

    return session && session.expiresAt.getTime() > this.now().getTime() ? session : null;
  }

  private async auditRejectedLogin(
    tenantId: string | null,
    input: LoginRequest,
    reason: string,
    actorUserId?: string,
  ): Promise<void> {
    await this.repository.recordAuthAuditEvent({
      action: "auth.login.failed",
      actorUserId,
      correlationId: input.correlationId,
      ipAddress: input.ipAddress,
      metadata: {
        ...buildRiskMetadata(input),
        reason,
      },
      outcome: "FAILURE",
      tenantId,
      userAgent: input.userAgent,
    });
  }

  private async auditLockedLogin(
    actorUserId: string,
    tenantId: string,
    input: LoginRequest,
    reason: string,
  ): Promise<void> {
    await this.repository.recordAuthAuditEvent({
      action: "auth.login.locked",
      actorUserId,
      correlationId: input.correlationId,
      ipAddress: input.ipAddress,
      metadata: {
        ...buildRiskMetadata(input),
        reason,
      },
      outcome: "DENIED",
      tenantId,
      userAgent: input.userAgent,
    });
  }
}

function buildRiskMetadata(input: LoginRequest): Record<string, string> {
  return {
    deviceHash: hashIdentifier(input.userAgent ?? "unknown"),
    ipHash: hashIdentifier(input.ipAddress ?? "unknown"),
  };
}

function normalizeEmail(email: string | undefined): string | null {
  const normalized = email?.trim().toLowerCase();

  return normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function normalizeOptionalString(value: string | undefined): string | null {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : null;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);

  return Number.isInteger(value) && value > 0 ? value : fallback;
}
