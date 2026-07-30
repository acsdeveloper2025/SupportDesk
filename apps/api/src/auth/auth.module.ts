import { Module } from "@nestjs/common";

import { PasswordHashingService } from "./security/password-hashing.service";
import { SecureTokenService } from "./security/secure-token.service";
import { PasswordPolicyService } from "./validation/password-policy.service";

@Module({
  exports: [PasswordHashingService, PasswordPolicyService, SecureTokenService],
  providers: [PasswordHashingService, PasswordPolicyService, SecureTokenService],
})
export class AuthModule {}
