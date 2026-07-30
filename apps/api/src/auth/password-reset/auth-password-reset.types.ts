import type { TenantLookupInput } from "../../identity/identity.types";
import type { PasswordPolicyErrorCode } from "../validation/password-policy.service";

export interface PasswordResetRequest {
  correlationId?: string;
  email?: string;
  tenant?: TenantLookupInput;
  tenantId?: string;
  userAgent?: string;
}

export interface ConfirmPasswordResetRequest {
  correlationId?: string;
  password?: string;
  token?: string;
  userAgent?: string;
}

export type PasswordResetResult =
  | {
      status: "accepted";
    }
  | {
      errors: PasswordPolicyErrorCode[];
      status: "validation_failed";
    };
