-- Seed canonical ticketing permissions implemented by the Ticket/Comment APIs.
-- Naming convention: resource[.subresource].action (no aliases).
INSERT INTO "permissions" ("id", "key", "description", "is_system", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'ticket.create', 'Create tickets in the tenant.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ticket.read', 'Read tickets within the granted scope.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ticket.update', 'Update ticket fields within the granted scope.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ticket.assign', 'Assign or unassign tickets within the granted scope.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ticket.transition', 'Transition ticket status within the granted scope.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ticket.comment.public.create', 'Create public comments on tickets.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ticket.comment.internal.create', 'Create internal comments on tickets.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ticket.comment.read', 'Read public comments on tickets.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ticket.comment.internal.read', 'Read internal comments on tickets.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ticket.comment.update', 'Update own comments on tickets.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ticket.comment.delete', 'Soft-delete own comments on tickets.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
