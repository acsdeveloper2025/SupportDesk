-- Insert Service Catalog permissions into permissions table
INSERT INTO "permissions" ("id", "key", "description", "is_system", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'catalog.category.read', 'Read service catalog categories', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.category.create', 'Create service catalog categories', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.category.update', 'Update service catalog categories', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.category.delete', 'Delete service catalog categories', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.service.read', 'Read published and draft catalog services', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.service.create', 'Create catalog services', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.service.update', 'Update catalog services', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.service.publish', 'Publish or retire catalog services', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.service.delete', 'Delete catalog services', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.form.read', 'Read catalog service request forms', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.form.update', 'Update catalog service request forms and bump versions', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.template.read', 'Read request templates', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.template.create', 'Create request templates', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.template.update', 'Update request templates', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.template.delete', 'Delete request templates', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.request.create', 'Submit service requests', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.request.read', 'Read own service requests', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.request.read_all', 'Read all tenant service requests', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.request.update', 'Update editable service requests', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.request.cancel', 'Cancel service requests', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.request.fulfill', 'Start fulfillment of approved service requests', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.request.generate_ticket', 'Generate tickets from service requests', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.request.complete', 'Complete service requests', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.approval.decide', 'Decide on service request approval steps', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.request.attachment.create', 'Attach files to service requests', true, NOW(), NOW()),
  (gen_random_uuid(), 'catalog.request.attachment.delete', 'Remove attachments from service requests', true, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;

-- Grant all catalog permissions to tenant_admin, manager, agent system roles
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
WHERE r."key" IN ('tenant_admin', 'manager', 'agent')
  AND p."key" LIKE 'catalog.%'
ON CONFLICT ("tenant_id", "role_id", "permission_id", "scope") DO NOTHING;

-- Grant catalog read and self-service request permissions to requester, approver, auditor, read_only system roles
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
WHERE r."key" IN ('requester', 'approver', 'auditor', 'read_only')
  AND p."key" IN (
    'catalog.category.read',
    'catalog.service.read',
    'catalog.form.read',
    'catalog.template.read',
    'catalog.request.create',
    'catalog.request.read',
    'catalog.request.attachment.create'
  )
ON CONFLICT ("tenant_id", "role_id", "permission_id", "scope") DO NOTHING;

-- Grant request self-service (update/cancel own requests) to the requester role
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
WHERE r."key" = 'requester'
  AND p."key" IN ('catalog.request.update', 'catalog.request.cancel')
ON CONFLICT ("tenant_id", "role_id", "permission_id", "scope") DO NOTHING;

-- Grant approval decision rights to approver and manager system roles
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
WHERE r."key" IN ('approver', 'manager')
  AND p."key" = 'catalog.approval.decide'
ON CONFLICT ("tenant_id", "role_id", "permission_id", "scope") DO NOTHING;
