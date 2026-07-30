import type { TenantLookupInput } from "../../identity/identity.types";
import type { PasswordPolicyErrorCode } from "../validation/password-policy.service";

export interface RegisterRequest {
  correlationId?: string;
  displayName?: string;
  email?: string;
  firstName?: string;
  language?: string;
  lastName?: string;
  locale?: string;
  password?: string;
  tenant?: TenantLookupInput;
  timeZone?: string;
  userAgent?: string;
}

export interface ConfirmEmailVerificationRequest {
  correlationId?: string;
  token?: string;
  userAgent?: string;
}

export type AuthAcceptedResult = {
  status: "accepted";
};

export type AuthRegistrationResult =
  | AuthAcceptedResult
  | {
      errors: PasswordPolicyErrorCode[] | ["AUTH_REQUEST_INVALID"];
      status: "validation_failed";
    };
