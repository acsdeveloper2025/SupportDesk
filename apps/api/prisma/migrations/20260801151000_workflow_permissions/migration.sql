INSERT INTO "permissions" ("id", "key", "description", "is_system", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'workflow.read', 'Read workflow definitions and versions.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'workflow.create', 'Create workflow drafts.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'workflow.update', 'Update workflow drafts and soft-delete workflows.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'workflow.publish', 'Publish workflow versions.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'workflow.pause', 'Pause and resume published workflows.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
