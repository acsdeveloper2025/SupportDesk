-- Insert Enterprise Reports & Analytics permissions into permissions table
INSERT INTO "permissions" ("id", "key", "description", "is_system", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'report.read', 'Read executive and domain report analytics', true, NOW(), NOW()),
  (gen_random_uuid(), 'report.ticket.read', 'Read ticket analytics and aging reports', true, NOW(), NOW()),
  (gen_random_uuid(), 'report.sla.read', 'Read SLA compliance and breach analytics', true, NOW(), NOW()),
  (gen_random_uuid(), 'report.workflow.read', 'Read workflow execution and automation metrics', true, NOW(), NOW()),
  (gen_random_uuid(), 'report.asset.read', 'Read asset inventory and lifecycle reports', true, NOW(), NOW()),
  (gen_random_uuid(), 'report.catalog.read', 'Read service catalog request analytics', true, NOW(), NOW()),
  (gen_random_uuid(), 'report.kb.read', 'Read knowledge base article usage analytics', true, NOW(), NOW()),
  (gen_random_uuid(), 'report.agent.read', 'Read agent productivity statistics', true, NOW(), NOW()),
  (gen_random_uuid(), 'report.saved.read', 'Read saved report definitions', true, NOW(), NOW()),
  (gen_random_uuid(), 'report.saved.create', 'Create custom saved reports', true, NOW(), NOW()),
  (gen_random_uuid(), 'report.saved.update', 'Update custom saved reports', true, NOW(), NOW()),
  (gen_random_uuid(), 'report.saved.delete', 'Delete custom saved reports', true, NOW(), NOW()),
  (gen_random_uuid(), 'report.schedule.read', 'Read scheduled report jobs', true, NOW(), NOW()),
  (gen_random_uuid(), 'report.schedule.create', 'Create scheduled report jobs', true, NOW(), NOW()),
  (gen_random_uuid(), 'report.schedule.update', 'Update scheduled report jobs', true, NOW(), NOW()),
  (gen_random_uuid(), 'report.schedule.delete', 'Delete scheduled report jobs', true, NOW(), NOW()),
  (gen_random_uuid(), 'report.export.create', 'Request report data export', true, NOW(), NOW()),
  (gen_random_uuid(), 'report.export.read', 'Read report export history', true, NOW(), NOW()),
  (gen_random_uuid(), 'report.export.download', 'Download exported report files', true, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;

-- Grant all report permissions to tenant_admin, manager system roles
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
WHERE r."key" IN ('tenant_admin', 'manager')
  AND p."key" LIKE 'report.%'
ON CONFLICT ("tenant_id", "role_id", "permission_id", "scope") DO NOTHING;

-- Grant standard read and export permissions to agent, auditor, read_only system roles
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
WHERE r."key" IN ('agent', 'auditor', 'read_only')
  AND p."key" IN (
    'report.read',
    'report.ticket.read',
    'report.sla.read',
    'report.workflow.read',
    'report.asset.read',
    'report.catalog.read',
    'report.kb.read',
    'report.agent.read',
    'report.saved.read',
    'report.schedule.read',
    'report.export.create',
    'report.export.read',
    'report.export.download'
  )
ON CONFLICT ("tenant_id", "role_id", "permission_id", "scope") DO NOTHING;
