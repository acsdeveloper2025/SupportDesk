import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { DatabaseModule } from "../database/database.module";
import { IdentityModule } from "../identity/identity.module";
import { IdentityLookupService } from "../identity/identity-lookup.service";
import { AuthController } from "./auth.controller";
import { AuthAccessTokenGuard } from "./guards/auth-access-token.guard";
import { AuthAccessTokenService } from "./guards/auth-access-token.service";
import {
  AuthPasswordRepository,
  PrismaAuthPasswordRepository,
} from "./password/auth-password.repository";
import { AuthPasswordService } from "./password/auth-password.service";
import {
  AuthPasswordResetRepository,
  PrismaAuthPasswordResetRepository,
} from "./password-reset/auth-password-reset.repository";
import { AuthPasswordResetService } from "./password-reset/auth-password-reset.service";
import { AuthRateLimitGuard } from "./rate-limit/auth-rate-limit.guard";
import {
  AuthRateLimitService,
  AuthRateLimitStore,
  InMemoryAuthRateLimitStore,
} from "./rate-limit/auth-rate-limit.service";
import { AuthRateLimitAuditService } from "./rate-limit/auth-rate-limit-audit.service";
import { AuthNotificationService } from "./registration/auth-notification.service";
import {
  AuthRegistrationRepository,
  PrismaAuthRegistrationRepository,
} from "./registration/auth-registration.repository";
import { AuthRegistrationService } from "./registration/auth-registration.service";
import { PasswordHashingService } from "./security/password-hashing.service";
import { SecureTokenService } from "./security/secure-token.service";
import {
  AuthSessionRepository,
  PrismaAuthSessionRepository,
} from "./session/auth-session.repository";
import { AuthSessionService } from "./session/auth-session.service";
import { AuthTokenRepository, PrismaAuthTokenRepository } from "./tokens/auth-token.repository";
import { AuthTokenService } from "./tokens/auth-token.service";
import { PasswordPolicyService } from "./validation/password-policy.service";

@Module({
  controllers: [AuthController],
  exports: [
    AuthNotificationService,
    AuthAccessTokenService,
    AuthPasswordService,
    AuthPasswordResetService,
    AuthRateLimitService,
    AuthRegistrationService,
    AuthSessionService,
    AuthTokenService,
    PasswordHashingService,
    PasswordPolicyService,
    SecureTokenService,
  ],
  imports: [DatabaseModule, IdentityModule],
  providers: [
    AuthNotificationService,
    AuthAccessTokenGuard,
    AuthAccessTokenService,
    AuthPasswordService,
    AuthPasswordResetService,
    AuthRateLimitAuditService,
    AuthRateLimitService,
    AuthRegistrationService,
    AuthSessionService,
    AuthTokenService,
    PasswordHashingService,
    PasswordPolicyService,
    SecureTokenService,
    InMemoryAuthRateLimitStore,
    {
      provide: APP_GUARD,
      useClass: AuthRateLimitGuard,
    },
    {
      provide: AuthRateLimitStore,
      useExisting: InMemoryAuthRateLimitStore,
    },
    {
      provide: AuthPasswordRepository,
      useClass: PrismaAuthPasswordRepository,
    },
    {
      provide: AuthPasswordResetRepository,
      useClass: PrismaAuthPasswordResetRepository,
    },
    {
      provide: AuthRegistrationRepository,
      useClass: PrismaAuthRegistrationRepository,
    },
    {
      provide: AuthSessionRepository,
      useClass: PrismaAuthSessionRepository,
    },
    {
      provide: AuthTokenRepository,
      useClass: PrismaAuthTokenRepository,
    },
    {
      provide: "IdentityLookupService",
      useExisting: IdentityLookupService,
    },
  ],
})
export class AuthModule {}
