import { Inject, Injectable, Optional } from "@nestjs/common";
import { AuthTokenState, UserState } from "@prisma/client";

import type { IdentityLookupService } from "../../identity/identity-lookup.service";
import { AuthNotificationService } from "../registration/auth-notification.service";
import { hashIdentifier } from "../registration/auth-registration.repository";
import { PasswordHashingService } from "../security/password-hashing.service";
import { SecureTokenService } from "../security/secure-token.service";
import { PasswordPolicyService } from "../validation/password-policy.service";
import { AuthPasswordResetRepository } from "./auth-password-reset.repository";
import type {
  ConfirmPasswordResetRequest,
  PasswordResetRequest,
  PasswordResetResult,
} from "./auth-password-reset.types";

const accepted: PasswordResetResult = {
  status: "accepted",
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class AuthPasswordResetService {
  private readonly now: () => Date;

  constructor(
    @Inject("IdentityLookupService")
    private readonly identityLookup: Pick<IdentityLookupService, "resolveTenant">,
    @Inject(AuthPasswordResetRepository)
    private readonly repository: AuthPasswordResetRepository,
    @Inject(PasswordPolicyService)
    private readonly passwordPolicy: PasswordPolicyService,
    @Inject(PasswordHashingService)
    private readonly passwordHashing: PasswordHashingService,
    @Inject(SecureTokenService)
    private readonly secureTokens: SecureTokenService,
    @Inject(AuthNotificationService)
    private readonly notifications: Pick<AuthNotificationService, "deliverPasswordReset">,
    @Optional()
    @Inject("AuthPasswordResetClock")
    now?: () => Date,
  ) {
    this.now = now ?? (() => new Date());
  }

  async requestPasswordReset(input: PasswordResetRequest): Promise<PasswordResetResult> {
    const emailNormalized = normalizeEmail(input.email);

    if (!emailNormalized || !input.tenant) {
      await this.repository.recordAuthAuditEvent({
        action: "auth.password_reset.request_rejected",
        metadata: {
          reason: "request_invalid",
        },
        outcome: "FAILURE",
      });

      return accepted;
    }

    const tenantResolution = await this.identityLookup.resolveTenant(input.tenant);
    const emailHash = hashIdentifier(emailNormalized);

    if (tenantResolution.status !== "found") {
      await this.repository.recordAuthAuditEvent({
        action: "auth.password_reset.request_rejected",
        metadata: {
          emailHash,
          reason: "tenant_unavailable",
        },
        outcome: "DENIED",
      });

      return accepted;
    }

    const tenantId = tenantResolution.tenant.id;
    const candidate = await this.repository.findPasswordResetCandidate(tenantId, emailNormalized);

    if (!candidate) {
      await this.repository.recordAuthAuditEvent({
        action: "auth.password_reset.request_rejected",
        metadata: {
          emailHash,
          reason: "identity_unavailable",
        },
        outcome: "DENIED",
        tenantId,
      });

      return accepted;
    }

    const resetToken = this.secureTokens.generateToken();
    const expiresAt = addMinutes(
      this.now(),
      readPositiveInteger("PASSWORD_RESET_TOKEN_TTL_MINUTES", 60),
    );

    try {
      await this.repository.createPasswordResetToken({
        correlationId: input.correlationId,
        emailHash,
        expiresAt,
        tenantId,
        tokenHash: resetToken.tokenHash,
        userId: candidate.id,
      });
      await this.notifications.deliverPasswordReset({
        email: candidate.emailNormalized,
        expiresAt,
        tenantId,
        token: resetToken.token,
        userId: candidate.id,
      });
      await this.repository.recordAuthAuditEvent({
        action: "auth.password_reset.requested",
        actorUserId: candidate.id,
        correlationId: input.correlationId,
        metadata: {
          emailHash,
        },
        outcome: "SUCCESS",
        tenantId,
      });
    } catch {
      await this.repository.recordAuthAuditEvent({
        action: "auth.password_reset.request_rejected",
        metadata: {
          emailHash,
          reason: "request_write_failed",
        },
        outcome: "FAILURE",
        tenantId,
      });
    }

    return accepted;
  }

  async confirmPasswordReset(input: ConfirmPasswordResetRequest): Promise<PasswordResetResult> {
    const password = typeof input.password === "string" ? input.password : "";
    const initialPasswordValidation = this.passwordPolicy.validate(password);

    if (!initialPasswordValidation.valid) {
      return {
        errors: initialPasswordValidation.errors,
        status: "validation_failed",
      };
    }

    const token = normalizeOptionalString(input.token);

    if (!token) {
      await this.repository.recordAuthAuditEvent({
        action: "auth.password_reset.rejected",
        metadata: {
          reason: "token_missing",
        },
        outcome: "FAILURE",
      });

      return accepted;
    }

    const tokenRecord = await this.repository.findPasswordResetTokenByHash(
      this.secureTokens.hashToken(token),
    );

    if (!tokenRecord) {
      await this.repository.recordAuthAuditEvent({
        action: "auth.password_reset.rejected",
        metadata: {
          reason: "token_unavailable",
        },
        outcome: "FAILURE",
      });

      return accepted;
    }

    if (tokenRecord.state !== AuthTokenState.ACTIVE) {
      await this.repository.recordAuthAuditEvent({
        action: "auth.password_reset.replay_detected",
        actorUserId: tokenRecord.userId,
        metadata: {
          reason: "token_not_active",
        },
        outcome: "DENIED",
        tenantId: tokenRecord.tenantId,
      });

      return accepted;
    }

    if (tokenRecord.expiresAt.getTime() <= this.now().getTime()) {
      await this.repository.markPasswordResetTokenExpired(tokenRecord.id);
      await this.repository.recordAuthAuditEvent({
        action: "auth.password_reset.rejected",
        actorUserId: tokenRecord.userId,
        metadata: {
          reason: "token_expired",
        },
        outcome: "FAILURE",
        tenantId: tokenRecord.tenantId,
      });

      return accepted;
    }

    if (tokenRecord.userState !== UserState.ACTIVE) {
      await this.repository.recordAuthAuditEvent({
        action: "auth.password_reset.rejected",
        actorUserId: tokenRecord.userId,
        metadata: {
          reason: "identity_unavailable",
        },
        outcome: "DENIED",
        tenantId: tokenRecord.tenantId,
      });

      return accepted;
    }

    const passwordAlreadyUsed = await this.passwordHashing.verifyPassword(
      tokenRecord.passwordHash,
      password,
    );
    const passwordValidation = this.passwordPolicy.validate(password, {
      email: tokenRecord.emailNormalized,
      passwordAlreadyUsed,
    });

    if (!passwordValidation.valid) {
      return {
        errors: passwordValidation.errors,
        status: "validation_failed",
      };
    }

    const passwordChangedAt = this.now();

    await this.repository.completePasswordReset({
      passwordChangedAt,
      passwordExpiresAt:
        tokenRecord.passwordExpiresDays === null
          ? null
          : addDays(passwordChangedAt, tokenRecord.passwordExpiresDays),
      passwordHash: await this.passwordHashing.hashPassword(password),
      tenantId: tokenRecord.tenantId,
      tokenId: tokenRecord.id,
      userId: tokenRecord.userId,
    });
    await this.repository.recordAuthAuditEvent({
      action: "auth.password_reset.completed",
      actorUserId: tokenRecord.userId,
      correlationId: input.correlationId,
      outcome: "SUCCESS",
      tenantId: tokenRecord.tenantId,
    });

    return accepted;
  }
}

function normalizeEmail(email: string | undefined): string | null {
  const normalized = email?.trim().toLowerCase();

  return normalized && emailPattern.test(normalized) ? normalized : null;
}

function normalizeOptionalString(value: string | undefined): string | null {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : null;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60_000);
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);

  return Number.isInteger(value) && value > 0 ? value : fallback;
}
