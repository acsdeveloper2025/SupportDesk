INSERT INTO "permissions" ("id", "key", "description", "is_system", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'notification.preference.read', 'Read notification preferences for self or tenant.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'notification.preference.update', 'Update notification preferences for self or tenant.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
