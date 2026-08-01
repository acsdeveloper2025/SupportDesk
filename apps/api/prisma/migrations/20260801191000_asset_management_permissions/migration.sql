-- Insert Asset Management (CMDB) permissions into permissions table
INSERT INTO "permissions" ("id", "key", "description", "is_system", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'asset.type.read', 'Read asset types including system types', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.type.create', 'Create custom asset types', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.type.update', 'Update custom asset types and custom field schemas', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.type.delete', 'Delete custom asset types', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.category.read', 'Read asset categories', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.category.create', 'Create asset categories', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.category.update', 'Update asset categories', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.category.delete', 'Delete asset categories', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.location.read', 'Read asset locations', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.location.create', 'Create asset locations', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.location.update', 'Update asset locations', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.location.delete', 'Delete asset locations', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.read', 'Read asset records and search assets', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.create', 'Create asset records', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.update', 'Update asset records', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.delete', 'Delete asset records', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.transition', 'Transition asset lifecycle state', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.assign', 'Assign assets to users, departments, or locations', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.unassign', 'Remove asset assignments', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.relationship.create', 'Create asset relationships', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.relationship.delete', 'Remove asset relationships', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.history.read', 'Read asset lifecycle and assignment history', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.ticket.link', 'Link assets to tickets and create tickets from assets', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.ticket.unlink', 'Unlink assets from tickets', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.kb.link', 'Associate knowledge base articles with asset types', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.kb.unlink', 'Remove knowledge base article associations from asset types', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.attachment.create', 'Attach files to asset records', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.attachment.read', 'Read and download asset attachments', true, NOW(), NOW()),
  (gen_random_uuid(), 'asset.attachment.delete', 'Delete asset attachments', true, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;

-- Grant all asset permissions to tenant_admin, manager, agent system roles
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
  AND p."key" LIKE 'asset.%'
ON CONFLICT ("tenant_id", "role_id", "permission_id", "scope") DO NOTHING;

-- Grant read-only asset permissions to requester, approver, auditor, read_only system roles
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
    'asset.type.read',
    'asset.category.read',
    'asset.location.read',
    'asset.read',
    'asset.history.read',
    'asset.attachment.read'
  )
ON CONFLICT ("tenant_id", "role_id", "permission_id", "scope") DO NOTHING;
