-- Insert outbox administration permissions into permissions table
INSERT INTO "permissions" ("id", "key", "description", "is_system", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'admin:outbox:read', 'View transactional outbox backlog, event payloads, and execution state', true, NOW(), NOW()),
  (gen_random_uuid(), 'admin:outbox:replay', 'Replay dead-lettered or failed outbox events', true, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;

-- Grant permissions to tenant_admin system role across active tenants
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
WHERE r."key" = 'tenant_admin'
  AND p."key" IN ('admin:outbox:read', 'admin:outbox:replay')
ON CONFLICT ("tenant_id", "role_id", "permission_id", "scope") DO NOTHING;
