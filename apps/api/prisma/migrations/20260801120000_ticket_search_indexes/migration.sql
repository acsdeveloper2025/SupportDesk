-- Ticket search & advanced filtering indexes (Issue #24 / E05-I09).
-- Btree composites support tenant-scoped filter/sort paths.
-- pg_trgm GIN indexes accelerate case-insensitive partial text search.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "idx_tickets__tenant_id_assigned_group_id" ON "tickets"("tenant_id", "assigned_group_id");
CREATE INDEX "idx_tickets__tenant_id_priority" ON "tickets"("tenant_id", "priority");
CREATE INDEX "idx_tickets__tenant_id_created_at" ON "tickets"("tenant_id", "created_at");
CREATE INDEX "idx_tickets__tenant_id_updated_at" ON "tickets"("tenant_id", "updated_at");
CREATE INDEX "idx_tickets__tenant_id_due_date" ON "tickets"("tenant_id", "due_date");

CREATE INDEX "idx_tickets__public_ref_trgm" ON "tickets" USING gin ("public_ref" gin_trgm_ops);
CREATE INDEX "idx_tickets__title_trgm" ON "tickets" USING gin ("title" gin_trgm_ops);
CREATE INDEX "idx_tickets__description_trgm" ON "tickets" USING gin ("description" gin_trgm_ops);
