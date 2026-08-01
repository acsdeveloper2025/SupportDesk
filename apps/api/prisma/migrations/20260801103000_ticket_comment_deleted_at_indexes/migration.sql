-- CreateIndex
CREATE INDEX "idx_tickets__tenant_id_deleted_at" ON "tickets"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_comments__tenant_id_deleted_at" ON "comments"("tenant_id", "deleted_at");
