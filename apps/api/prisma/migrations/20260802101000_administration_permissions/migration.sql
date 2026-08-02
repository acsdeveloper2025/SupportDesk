-- Insert Enterprise Administration & Platform Management permissions into permissions table
INSERT INTO "permissions" ("id", "key", "description", "is_system", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'admin.global.read', 'Read global platform settings and system state', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.global.update', 'Update global platform settings and system configuration', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.tenant.read', 'Read tenant registry details and configurations', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.tenant.create', 'Provision new tenant workspaces', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.tenant.update', 'Update tenant profile, quotas, and settings', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.tenant.lifecycle', 'Transition tenant lifecycle states (activate, deactivate, suspend)', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.user.read', 'Read user directory, profiles, and active sessions', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.user.invite', 'Invite new users to tenant workspaces', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.user.update', 'Update user profiles, statuses, and role memberships', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.user.lockout', 'Lock and unlock user accounts', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.user.session', 'Inspect active user sessions and force logout', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.role.manage', 'Create, modify, assign, and delete roles and permissions', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.permission.read', 'Inspect permission matrix and calculate user effective permissions', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.workflow.manage', 'Monitor, pause, and inspect workflow engine executions', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.workflow.retry', 'Manually retry failed or hung workflow execution steps', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.outbox.manage', 'Monitor outbox queue health and dead-letter events', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.outbox.replay', 'Replay or retry failed transactional outbox events', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.sla.manage', 'Administer SLA policies, business schedules, and holiday calendars', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.notification.manage', 'Manage notification templates, delivery queues, and failed dispatches', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.audit.read', 'Explore platform audit trail and security logs', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.security.read', 'Inspect security dashboard, failed login activity, and lockouts', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.health.read', 'Inspect system component health, queue statuses, and storage metrics', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.diagnostics.read', 'Execute system diagnostics and environment validation', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin.feature_flag.manage', 'Manage global and tenant feature flags and rollout rules', true, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;

-- Grant all admin permissions to tenant_admin system role
INSERT INTO "role_permissions" ("id", "tenant_id", "role_id", "permission_id", "scope", "created_at")
SELECT
  gen_random_uuid(),
  r."tenant_id",
  r."id",
  p."id",
  'tenant'::"role_scope",
  NOW()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."key" IN ('tenant_admin', 'super_admin')
  AND p."key" LIKE 'admin.%'
ON CONFLICT ("tenant_id", "role_id", "permission_id", "scope") DO NOTHING;
