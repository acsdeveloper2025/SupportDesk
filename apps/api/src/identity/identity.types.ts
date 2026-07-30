export interface TenantLookupInput {
  domain?: string;
  publicId?: string;
  slug?: string;
  tenantId?: string;
}

export interface TenantSecurityPolicy {
  failedLoginLockoutThreshold: number;
  failedLoginWindowMinutes: number;
  lockoutDurationMinutes: number;
  passwordExpiresDays: number | null;
}

export interface AuthTenantContext {
  id: string;
  publicId: string;
  slug: string;
  name: string;
  defaultLocale: string;
  defaultTimeZone: string;
  registrationEnabled: boolean;
  securityPolicy: TenantSecurityPolicy;
  settings: Record<string, unknown>;
}

export interface TenantUserIdentityInput {
  email?: string;
  tenantId: string;
  userId?: string;
}

export interface TenantUserProfile {
  displayName: string | null;
  firstName: string | null;
  language: string;
  lastName: string | null;
  locale: string;
  profilePicturePlaceholder: string | null;
  timeZone: string;
}

export interface TenantUserRole {
  id: string;
  key: string;
  name: string;
}

export interface TenantUserPermission {
  key: string;
  scope: string;
}

export interface TenantUserIdentity {
  id: string;
  publicId: string;
  tenantId: string;
  email: string;
  emailNormalized: string;
  emailVerified: boolean;
  profile: TenantUserProfile;
  preferences: Record<string, unknown>;
  roles: TenantUserRole[];
  permissions: TenantUserPermission[];
}

export type TenantResolution =
  | {
      status: "found";
      tenant: AuthTenantContext;
    }
  | {
      status: "unavailable";
    };

export type TenantUserIdentityResolution =
  | {
      status: "found";
      identity: TenantUserIdentity;
    }
  | {
      status: "unavailable";
    };
