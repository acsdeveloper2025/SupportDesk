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
import { PasswordPolicyService } from "./validation/password-policy.service";

@Module({
  controllers: [AuthController],
  exports: [
    AuthNotificationService,
    AuthRegistrationService,
    PasswordHashingService,
    PasswordPolicyService,
    SecureTokenService,
  ],
  imports: [DatabaseModule, IdentityModule],
  providers: [
    AuthNotificationService,
    AuthRegistrationService,
    PasswordHashingService,
    PasswordPolicyService,
    SecureTokenService,
    {
      provide: AuthRegistrationRepository,
      useClass: PrismaAuthRegistrationRepository,
    },
    {
      provide: "IdentityLookupService",
      useExisting: IdentityLookupService,
    },
  ],
})
export class AuthModule {}
