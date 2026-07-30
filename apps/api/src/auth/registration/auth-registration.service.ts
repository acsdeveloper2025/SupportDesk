import { Inject, Injectable } from "@nestjs/common";

import type { IdentityLookupService } from "../../identity/identity-lookup.service";
import { PasswordHashingService } from "../security/password-hashing.service";
import { SecureTokenService } from "../security/secure-token.service";
import { PasswordPolicyService } from "../validation/password-policy.service";
import { AuthNotificationService } from "./auth-notification.service";
import {
  type AuthAuditEventInput,
  AuthRegistrationRepository,
  hashIdentifier,
} from "./auth-registration.repository";
import type {
  AuthAcceptedResult,
  AuthRegistrationResult,
  ConfirmEmailVerificationRequest,
  RegisterRequest,
} from "./auth-registration.types";

const accepted: AuthAcceptedResult = {
  status: "accepted",
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class AuthRegistrationService {
  constructor(
    @Inject("IdentityLookupService")
    private readonly identityLookup: Pick<IdentityLookupService, "resolveTenant">,
    @Inject(AuthRegistrationRepository)
    private readonly repository: AuthRegistrationRepository,
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly passwordHashing: PasswordHashingService,
    private readonly secureTokens: SecureTokenService,
    private readonly notifications: Pick<AuthNotificationService, "deliverEmailVerification">,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async register(input: RegisterRequest): Promise<AuthRegistrationResult> {
    const emailNormalized = normalizeEmail(input.email);
    const password = typeof input.password === "string" ? input.password : "";

    if (!emailNormalized || !input.tenant) {
      await this.recordAudit(input, {
        action: "auth.registration.rejected",
        metadata: {
          reason: "request_invalid",
        },
        outcome: "FAILURE",
      });

      return {
        errors: ["AUTH_REQUEST_INVALID"],
        status: "validation_failed",
      };
    }

    const passwordValidation = this.passwordPolicy.validate(password, {
      email: emailNormalized,
    });

    if (!passwordValidation.valid) {
      await this.recordAudit(input, {
        action: "auth.registration.rejected",
        metadata: {
          reason: "password_policy_rejected",
        },
        outcome: "DENIED",
      });

      return {
        errors: passwordValidation.errors,
        status: "validation_failed",
      };
    }

    const tenantResolution = await this.identityLookup.resolveTenant(input.tenant);

    if (tenantResolution.status !== "found") {
      await this.recordAudit(input, {
        action: "auth.registration.rejected",
        metadata: {
          emailHash: hashIdentifier(emailNormalized),
          reason: "tenant_unavailable",
        },
        outcome: "DENIED",
      });

      return accepted;
    }

    const tenant = tenantResolution.tenant;
    const emailHash = hashIdentifier(emailNormalized);

    if (!tenant.registrationEnabled) {
      await this.recordAudit(input, {
        action: "auth.registration.rejected",
        metadata: {
          emailHash,
          reason: "registration_disabled",
        },
        outcome: "DENIED",
        tenantId: tenant.id,
      });

      return accepted;
    }

    const existingUser = await this.repository.findTenantUserByEmail(tenant.id, emailNormalized);

    if (existingUser) {
      await this.recordAudit(input, {
        action: "auth.registration.rejected",
        metadata: {
          emailHash,
          reason: "duplicate_identity",
        },
        outcome: "DENIED",
        tenantId: tenant.id,
      });

      return accepted;
    }

    const verificationToken = this.secureTokens.generateToken();
    const expiresAt = addMinutes(
      this.now(),
      readPositiveInteger("EMAIL_VERIFICATION_TOKEN_TTL_MINUTES", 1440),
    );
    const passwordHash = await this.passwordHashing.hashPassword(password);

    try {
      const created = await this.repository.createPendingUserRegistration({
        correlationId: input.correlationId,
        displayName: normalizeOptionalString(input.displayName),
        email: input.email?.trim() ?? emailNormalized,
        emailHash,
        emailNormalized,
        expiresAt,
        firstName: normalizeOptionalString(input.firstName),
        language:
          normalizeOptionalString(input.language) ?? tenant.defaultLocale.split("-")[0] ?? "en",
        lastName: normalizeOptionalString(input.lastName),
        locale: normalizeOptionalString(input.locale) ?? tenant.defaultLocale,
        passwordHash,
        profilePicturePlaceholder: createProfilePlaceholder(input.displayName, emailNormalized),
        tenantId: tenant.id,
        timeZone: normalizeOptionalString(input.timeZone) ?? tenant.defaultTimeZone,
        verificationTokenHash: verificationToken.tokenHash,
      });

      await this.notifications.deliverEmailVerification({
        email: emailNormalized,
        expiresAt,
        tenantId: created.tenantId,
        token: verificationToken.token,
        userId: created.userId,
      });
      await this.recordAudit(input, {
        action: "auth.registration.completed",
        actorUserId: created.userId,
        correlationId: input.correlationId,
        metadata: {
          emailHash,
        },
        outcome: "SUCCESS",
        tenantId: created.tenantId,
      });
    } catch {
      await this.recordAudit(input, {
        action: "auth.registration.rejected",
        metadata: {
          emailHash,
          reason: "registration_write_failed",
        },
        outcome: "FAILURE",
        tenantId: tenant.id,
      });
    }

    return accepted;
  }

  async confirmEmailVerification(
    input: ConfirmEmailVerificationRequest,
  ): Promise<AuthAcceptedResult> {
    const token = normalizeOptionalString(input.token);

    if (!token) {
      await this.recordAudit(input, {
        action: "auth.email_verification.rejected",
        metadata: {
          reason: "token_missing",
        },
        outcome: "FAILURE",
      });

      return accepted;
    }

    const tokenHash = this.secureTokens.hashToken(token);
    const tokenRecord = await this.repository.findActiveEmailVerificationToken(tokenHash);

    if (!tokenRecord) {
      await this.recordAudit(input, {
        action: "auth.email_verification.rejected",
        metadata: {
          reason: "token_unavailable",
        },
        outcome: "FAILURE",
      });

      return accepted;
    }

    if (tokenRecord.expiresAt.getTime() <= this.now().getTime()) {
      await this.repository.markVerificationTokenExpired(tokenRecord.id);
      await this.recordAudit(input, {
        action: "auth.email_verification.rejected",
        actorUserId: tokenRecord.userId,
        metadata: {
          reason: "token_expired",
        },
        outcome: "FAILURE",
        tenantId: tokenRecord.tenantId,
      });

      return accepted;
    }

    const verified = await this.repository.completeEmailVerification(tokenRecord.id);
    await this.recordAudit(input, {
      action: "auth.email_verification.completed",
      actorUserId: verified.userId,
      correlationId: input.correlationId,
      outcome: "SUCCESS",
      tenantId: verified.tenantId,
    });

    return accepted;
  }

  private async recordAudit(
    request: RegisterRequest | ConfirmEmailVerificationRequest,
    event: AuthAuditEventInput,
  ): Promise<void> {
    await this.repository.recordAuthAuditEvent({
      ...event,
      correlationId: event.correlationId ?? request.correlationId,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
    });
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

function readPositiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);

  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function createProfilePlaceholder(displayName: string | undefined, email: string): string {
  const name = normalizeOptionalString(displayName);
  const source = name ?? email.split("@")[0] ?? "user";
  const letters = source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return letters || "U";
}
