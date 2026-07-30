import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { IdentityModule } from "../identity/identity.module";
import { IdentityLookupService } from "../identity/identity-lookup.service";
import { AuthController } from "./auth.controller";
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
    AuthRegistrationService,
    AuthSessionService,
    AuthTokenService,
    PasswordHashingService,
    PasswordPolicyService,
    SecureTokenService,
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
