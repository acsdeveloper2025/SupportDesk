import type { Request } from "express";

import type {
  TenantUserPermission,
  TenantUserProfile,
  TenantUserRole,
} from "../../identity/identity.types";

export interface AuthenticatedRequestContext {
  email: string;
  emailNormalized: string;
  emailVerified: boolean;
  passwordChangeRequired: boolean;
  permissions: TenantUserPermission[];
  preferences: Record<string, unknown>;
  profile: TenantUserProfile;
  publicId: string;
  roles: TenantUserRole[];
  sessionId: string;
  tenantId: string;
  userId: string;
}

export type AuthenticatedRequest = Request & {
  auth?: AuthenticatedRequestContext;
};

export function getAuthenticatedRequestContext(
  request: Request,
): AuthenticatedRequestContext | undefined {
  return (request as AuthenticatedRequest).auth;
}

export function setAuthenticatedRequestContext(
  request: Request,
  context: AuthenticatedRequestContext,
): void {
  (request as AuthenticatedRequest).auth = context;
}
