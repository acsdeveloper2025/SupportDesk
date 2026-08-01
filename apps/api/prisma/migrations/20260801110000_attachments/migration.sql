-- CreateEnum
CREATE TYPE "virus_scan_status" AS ENUM ('pending', 'clean', 'infected');

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "stored_filename" VARCHAR(100) NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "extension" VARCHAR(20) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "virus_scan_status" "virus_scan_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "pk_attachments" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_attachments__tenant_id_ticket_id_sha256" ON "attachments"("tenant_id", "ticket_id", "sha256");

-- CreateIndex
CREATE INDEX "idx_attachments__tenant_id_ticket_id_created_at" ON "attachments"("tenant_id", "ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_attachments__tenant_id_virus_scan_status" ON "attachments"("tenant_id", "virus_scan_status");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "fk_attachments__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "fk_attachments__tickets__ticket_id" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "fk_attachments__users__uploaded_by" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
