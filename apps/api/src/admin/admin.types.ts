export interface GlobalSettingDto {
  key: string;
  value: Record<string, unknown>;
  description?: string;
}

export interface FeatureFlagDto {
  id?: string;
  tenantId?: string | null;
  key: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  rules?: Record<string, unknown>;
}

export interface MaintenanceWindowDto {
  id?: string;
  title: string;
  description?: string;
  isPlatformWide: boolean;
  tenantId?: string | null;
  startsAt: string;
  endsAt: string;
  status?: string;
  allowAdminAccess?: boolean;
}

export interface TenantQuotaDto {
  maxUsers?: number;
  maxStorageBytes?: number;
  maxTicketsPerMonth?: number;
  customDomainAllowed?: boolean;
}

export interface UpdateTenantDto {
  name?: string;
  slug?: string;
  status?: string;
  plan?: string;
  settings?: Record<string, unknown>;
  quotas?: TenantQuotaDto;
}

export interface CreateTenantDto {
  name: string;
  slug: string;
  plan?: string;
  adminEmail: string;
  adminName: string;
  settings?: Record<string, unknown>;
}

export interface InviteUserDto {
  email: string;
  fullName: string;
  roleKeys: string[];
}

export interface UpdateUserDto {
  fullName?: string;
  roleKeys?: string[];
  isActive?: boolean;
  isLocked?: boolean;
}

export interface RoleDto {
  key: string;
  name: string;
  description?: string;
  permissionKeys: string[];
}

export interface SystemHealthSummary {
  status: "HEALTHY" | "DEGRADED" | "CRITICAL";
  timestamp: string;
  version: string;
  uptimeSeconds: number;
  components: {
    database: { status: "UP" | "DOWN"; latencyMs: number };
    outboxQueue: { status: "UP" | "DOWN"; pendingCount: number; failedCount: number };
    scheduler: { status: "UP" | "DOWN"; activeSchedules: number };
    workers: { status: "UP" | "DOWN"; activeWorkers: number };
    cache: { status: "UP" | "DOWN"; hitRatePct: number };
    storage: { status: "UP" | "DOWN"; usedBytes: number };
    migrations: { status: "UP" | "DOWN"; appliedCount: number; pendingCount: number };
  };
}

export interface DiagnosticResult {
  category: "ENVIRONMENT" | "CONFIGURATION" | "DEPENDENCIES" | "SECURITY" | "DATABASE";
  name: string;
  status: "PASS" | "WARN" | "FAIL";
  message: string;
  details?: Record<string, unknown>;
}

export interface EffectivePermission {
  key: string;
  description: string;
  grantedViaRoles: string[];
  scope: string;
}
