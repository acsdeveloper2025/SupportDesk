import { Injectable } from "@nestjs/common";

export type PasswordPolicyErrorCode =
  | "PASSWORD_CONTAINS_IDENTIFIER"
  | "PASSWORD_MISSING_LOWERCASE"
  | "PASSWORD_MISSING_NUMBER"
  | "PASSWORD_MISSING_SYMBOL"
  | "PASSWORD_MISSING_UPPERCASE"
  | "PASSWORD_RECENTLY_USED"
  | "PASSWORD_TOO_LONG"
  | "PASSWORD_TOO_SHORT";

export interface PasswordPolicyOptions {
  email?: string;
  maxLength?: number;
  minLength?: number;
  passwordAlreadyUsed?: boolean;
  requireLowercase?: boolean;
  requireNumber?: boolean;
  requireSymbol?: boolean;
  requireUppercase?: boolean;
}

export interface PasswordPolicyValidationResult {
  errors: PasswordPolicyErrorCode[];
  valid: boolean;
}

@Injectable()
export class PasswordPolicyService {
  validate(password: string, options: PasswordPolicyOptions = {}): PasswordPolicyValidationResult {
    const policy = this.createPolicy(options);
    const errors: PasswordPolicyErrorCode[] = [];

    if (password.length < policy.minLength) {
      errors.push("PASSWORD_TOO_SHORT");
    }

    if (password.length > policy.maxLength) {
      errors.push("PASSWORD_TOO_LONG");
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push("PASSWORD_MISSING_UPPERCASE");
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push("PASSWORD_MISSING_LOWERCASE");
    }

    if (policy.requireNumber && !/[0-9]/.test(password)) {
      errors.push("PASSWORD_MISSING_NUMBER");
    }

    if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
      errors.push("PASSWORD_MISSING_SYMBOL");
    }

    if (containsIdentifier(password, policy.email)) {
      errors.push("PASSWORD_CONTAINS_IDENTIFIER");
    }

    if (policy.passwordAlreadyUsed) {
      errors.push("PASSWORD_RECENTLY_USED");
    }

    return {
      errors,
      valid: errors.length === 0,
    };
  }

  private createPolicy(options: PasswordPolicyOptions): Required<PasswordPolicyOptions> {
    return {
      email: options.email ?? "",
      maxLength: options.maxLength ?? readPositiveInteger("PASSWORD_MAX_LENGTH", 128),
      minLength: options.minLength ?? readPositiveInteger("PASSWORD_MIN_LENGTH", 12),
      passwordAlreadyUsed: options.passwordAlreadyUsed ?? false,
      requireLowercase: options.requireLowercase ?? readBoolean("PASSWORD_REQUIRE_LOWERCASE", true),
      requireNumber: options.requireNumber ?? readBoolean("PASSWORD_REQUIRE_NUMBER", true),
      requireSymbol: options.requireSymbol ?? readBoolean("PASSWORD_REQUIRE_SYMBOL", true),
      requireUppercase: options.requireUppercase ?? readBoolean("PASSWORD_REQUIRE_UPPERCASE", true),
    };
  }
}

function containsIdentifier(password: string, email: string): boolean {
  const normalizedPassword = password.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();
  const localPart = normalizedEmail.split("@")[0] ?? "";
  const identifiers = [normalizedEmail, localPart].filter((value) => value.length >= 3);

  return identifiers.some((identifier) => normalizedPassword.includes(identifier));
}

function readBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);

  return Number.isInteger(value) && value > 0 ? value : fallback;
}
