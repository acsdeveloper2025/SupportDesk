import { Inject, Injectable, Optional } from "@nestjs/common";

import { PasswordHashingService } from "../security/password-hashing.service";
import { PasswordPolicyService } from "../validation/password-policy.service";
import { AuthPasswordRepository } from "./auth-password.repository";

export interface ChangePasswordRequest {
  correlationId?: string;
  currentPassword?: string;
  currentSessionId?: string;
  newPassword?: string;
}

export type ChangePasswordResult =
  | {
      status: "changed";
    }
  | {
      status: "denied";
    }
  | {
      errors: string[];
      status: "validation_failed";
    };

@Injectable()
export class AuthPasswordService {
  private readonly now: () => Date;

  constructor(
    @Inject(AuthPasswordRepository)
    private readonly repository: AuthPasswordRepository,
    @Inject(PasswordHashingService)
    private readonly passwordHashing: PasswordHashingService,
    @Inject(PasswordPolicyService)
    private readonly passwordPolicy: PasswordPolicyService,
    @Optional()
    @Inject("AuthPasswordClock")
    now?: () => Date,
  ) {
    this.now = now ?? (() => new Date());
  }

  async changePassword(input: ChangePasswordRequest): Promise<ChangePasswordResult> {
    const currentSessionId = normalizeOptionalString(input.currentSessionId);
    const currentPassword = typeof input.currentPassword === "string" ? input.currentPassword : "";
    const newPassword = typeof input.newPassword === "string" ? input.newPassword : "";

    if (!currentSessionId || !currentPassword) {
      await this.repository.recordAuthAuditEvent({
        action: "auth.password_change.rejected",
        correlationId: input.correlationId,
        metadata: {
          reason: "authentication_required",
        },
        outcome: "DENIED",
      });

      return {
        status: "denied",
      };
    }

    const identity = await this.repository.findPasswordChangeIdentity(currentSessionId);

    if (!identity) {
      await this.repository.recordAuthAuditEvent({
        action: "auth.password_change.rejected",
        correlationId: input.correlationId,
        metadata: {
          reason: "session_unavailable",
        },
        outcome: "DENIED",
      });

      return {
        status: "denied",
      };
    }

    const currentPasswordMatches = await this.passwordHashing.verifyPassword(
      identity.passwordHash,
      currentPassword,
    );

    if (!currentPasswordMatches) {
      await this.repository.recordAuthAuditEvent({
        action: "auth.password_change.rejected",
        actorUserId: identity.userId,
        correlationId: input.correlationId,
        metadata: {
          reason: "current_password_invalid",
        },
        outcome: "DENIED",
        tenantId: identity.tenantId,
      });

      return {
        status: "denied",
      };
    }

    const passwordAlreadyUsed = await this.passwordHashing.verifyPassword(
      identity.passwordHash,
      newPassword,
    );
    const validation = this.passwordPolicy.validate(newPassword, {
      email: identity.emailNormalized,
      passwordAlreadyUsed,
    });

    if (!validation.valid) {
      return {
        errors: validation.errors,
        status: "validation_failed",
      };
    }

    const passwordChangedAt = this.now();
    const passwordExpiresAt =
      identity.passwordExpiresDays === null
        ? null
        : addDays(passwordChangedAt, identity.passwordExpiresDays);

    await this.repository.completePasswordChange({
      passwordChangedAt,
      passwordExpiresAt,
      passwordHash: await this.passwordHashing.hashPassword(newPassword),
      tenantId: identity.tenantId,
      userId: identity.userId,
    });
    await this.repository.recordAuthAuditEvent({
      action: "auth.password_change.completed",
      actorUserId: identity.userId,
      correlationId: input.correlationId,
      outcome: "SUCCESS",
      tenantId: identity.tenantId,
    });

    return {
      status: "changed",
    };
  }
}

function normalizeOptionalString(value: string | undefined): string | null {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : null;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60_000);
}
