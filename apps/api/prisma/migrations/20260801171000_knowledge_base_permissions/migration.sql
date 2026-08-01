-- Insert Knowledge Base permissions into permissions table
INSERT INTO "permissions" ("id", "key", "description", "is_system", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'kb.category.read', 'Read knowledge base categories', true, NOW(), NOW()),
  (gen_random_uuid(), 'kb.category.create', 'Create knowledge base categories', true, NOW(), NOW()),
  (gen_random_uuid(), 'kb.category.update', 'Update knowledge base categories', true, NOW(), NOW()),
  (gen_random_uuid(), 'kb.category.delete', 'Delete knowledge base categories', true, NOW(), NOW()),
  (gen_random_uuid(), 'kb.article.read', 'Read public knowledge base articles', true, NOW(), NOW()),
  (gen_random_uuid(), 'kb.article.read_internal', 'Read internal knowledge base articles', true, NOW(), NOW()),
  (gen_random_uuid(), 'kb.article.create', 'Create knowledge base article drafts', true, NOW(), NOW()),
  (gen_random_uuid(), 'kb.article.update', 'Update knowledge base articles', true, NOW(), NOW()),
  (gen_random_uuid(), 'kb.article.publish', 'Publish knowledge base articles and versions', true, NOW(), NOW()),
  (gen_random_uuid(), 'kb.article.archive', 'Archive knowledge base articles', true, NOW(), NOW()),
  (gen_random_uuid(), 'kb.article.delete', 'Delete knowledge base articles', true, NOW(), NOW()),
  (gen_random_uuid(), 'kb.article.link_ticket', 'Link or unlink knowledge base articles to tickets', true, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;

-- Grant all KB permissions to tenant_admin, manager, agent system roles
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
  AND p."key" LIKE 'kb.%'
ON CONFLICT ("tenant_id", "role_id", "permission_id", "scope") DO NOTHING;

-- Grant public article read to requester, approver, auditor, read_only system roles
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
  AND p."key" IN ('kb.category.read', 'kb.article.read')
ON CONFLICT ("tenant_id", "role_id", "permission_id", "scope") DO NOTHING;
