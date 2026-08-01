INSERT INTO "permissions" ("id", "key", "description", "is_system", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'sla.read', 'Read SLA policies, schedules, targets, timers, and basic metrics.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'sla.update', 'Create, update, and publish SLA policies and business schedules.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
