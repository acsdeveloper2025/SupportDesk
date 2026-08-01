-- CreateEnum
CREATE TYPE "asset_lifecycle_state" AS ENUM ('draft', 'in_stock', 'assigned', 'in_repair', 'retired', 'disposed', 'lost', 'archived');

-- CreateEnum
CREATE TYPE "asset_relationship_type" AS ENUM ('parent_child', 'depends_on', 'connected_to', 'installed_on', 'hosted_on', 'license_assigned_to');

-- CreateEnum
CREATE TYPE "asset_assignment_kind" AS ENUM ('user', 'department', 'location');

-- CreateEnum
CREATE TYPE "asset_attachment_kind" AS ENUM ('photo', 'invoice', 'manual', 'warranty', 'other');

-- AlterTable
ALTER TABLE "kb_article_versions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "kb_articles" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "kb_categories" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "kb_tags" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "kb_ticket_links" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "asset_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "custom_fields_schema" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "pk_asset_types" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(100),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "pk_asset_categories" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_locations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "pk_asset_locations" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_ref" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "asset_type_id" UUID NOT NULL,
    "category_id" UUID,
    "serial_number" VARCHAR(200),
    "asset_tag" VARCHAR(100),
    "barcode" VARCHAR(200),
    "manufacturer" VARCHAR(200),
    "model" VARCHAR(200),
    "vendor" VARCHAR(200),
    "purchase_date" DATE,
    "warranty_expires_at" DATE,
    "cost" DECIMAL(12,2),
    "lifecycle_state" "asset_lifecycle_state" NOT NULL DEFAULT 'draft',
    "owner_user_id" UUID,
    "location_id" UUID,
    "assigned_user_id" UUID,
    "assigned_department" VARCHAR(200),
    "notes" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "pk_assets" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "kind" "asset_assignment_kind" NOT NULL,
    "assigned_to_user_id" UUID,
    "assigned_department" VARCHAR(200),
    "assigned_location_id" UUID,
    "assigned_by_user_id" UUID NOT NULL,
    "reason" VARCHAR(500),
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_asset_assignments" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_relationships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_asset_id" UUID NOT NULL,
    "target_asset_id" UUID NOT NULL,
    "type" "asset_relationship_type" NOT NULL,
    "note" VARCHAR(500),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "pk_asset_relationships" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "from_state" VARCHAR(50),
    "to_state" VARCHAR(50),
    "metadata" JSONB,
    "actor_user_id" UUID,
    "comment" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_asset_history" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_ticket_links" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_asset_ticket_links" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_type_kb_links" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_type_id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_asset_type_kb_links" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_attachments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "kind" "asset_attachment_kind" NOT NULL DEFAULT 'other',
    "file_name" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_asset_attachments" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_asset_types__tenant_id_is_system_deleted_at" ON "asset_types"("tenant_id", "is_system", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_asset_types__tenant_id_key" ON "asset_types"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "idx_asset_categories__tenant_id_parent_id" ON "asset_categories"("tenant_id", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_asset_categories__tenant_id_slug" ON "asset_categories"("tenant_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "uq_asset_locations__tenant_id_name" ON "asset_locations"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "idx_assets__tenant_id_lifecycle_state" ON "assets"("tenant_id", "lifecycle_state");

-- CreateIndex
CREATE INDEX "idx_assets__tenant_id_asset_type_id" ON "assets"("tenant_id", "asset_type_id");

-- CreateIndex
CREATE INDEX "idx_assets__tenant_id_category_id" ON "assets"("tenant_id", "category_id");

-- CreateIndex
CREATE INDEX "idx_assets__tenant_id_location_id" ON "assets"("tenant_id", "location_id");

-- CreateIndex
CREATE INDEX "idx_assets__tenant_id_assigned_user_id" ON "assets"("tenant_id", "assigned_user_id");

-- CreateIndex
CREATE INDEX "idx_assets__tenant_id_owner_user_id" ON "assets"("tenant_id", "owner_user_id");

-- CreateIndex
CREATE INDEX "idx_assets__tenant_id_created_at" ON "assets"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_assets__tenant_id_deleted_at" ON "assets"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_assets__name_trgm" ON "assets" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_assets__asset_tag_trgm" ON "assets" USING GIN ("asset_tag" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_assets__serial_number_trgm" ON "assets" USING GIN ("serial_number" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_assets__barcode_trgm" ON "assets" USING GIN ("barcode" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "uq_assets__tenant_id_asset_ref" ON "assets"("tenant_id", "asset_ref");

-- CreateIndex
CREATE UNIQUE INDEX "uq_assets__tenant_id_asset_tag" ON "assets"("tenant_id", "asset_tag");

-- CreateIndex
CREATE INDEX "idx_asset_assignments__tenant_asset_assigned_at" ON "asset_assignments"("tenant_id", "asset_id", "assigned_at");

-- CreateIndex
CREATE INDEX "idx_asset_relationships__tenant_id_target_asset_id" ON "asset_relationships"("tenant_id", "target_asset_id");

-- CreateIndex
CREATE INDEX "idx_asset_relationships__tenant_id_source_asset_id" ON "asset_relationships"("tenant_id", "source_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_asset_relationships__tenant_source_target_type" ON "asset_relationships"("tenant_id", "source_asset_id", "target_asset_id", "type");

-- CreateIndex
CREATE INDEX "idx_asset_history__tenant_asset_created_at" ON "asset_history"("tenant_id", "asset_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_asset_ticket_links__tenant_id_ticket_id" ON "asset_ticket_links"("tenant_id", "ticket_id");

-- CreateIndex
CREATE INDEX "idx_asset_ticket_links__tenant_id_asset_id" ON "asset_ticket_links"("tenant_id", "asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_asset_ticket_links__tenant_asset_ticket" ON "asset_ticket_links"("tenant_id", "asset_id", "ticket_id");

-- CreateIndex
CREATE INDEX "idx_asset_type_kb_links__tenant_type" ON "asset_type_kb_links"("tenant_id", "asset_type_id");

-- CreateIndex
CREATE INDEX "idx_asset_type_kb_links__tenant_article" ON "asset_type_kb_links"("tenant_id", "article_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_asset_type_kb_links__tenant_type_article" ON "asset_type_kb_links"("tenant_id", "asset_type_id", "article_id");

-- CreateIndex
CREATE INDEX "idx_asset_attachments__tenant_asset_created_at" ON "asset_attachments"("tenant_id", "asset_id", "created_at");

-- AddForeignKey
ALTER TABLE "asset_types" ADD CONSTRAINT "fk_asset_types__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_categories" ADD CONSTRAINT "fk_asset_categories__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_categories" ADD CONSTRAINT "fk_asset_categories__parents__parent_id" FOREIGN KEY ("parent_id") REFERENCES "asset_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_locations" ADD CONSTRAINT "fk_asset_locations__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "fk_assets__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "fk_assets__asset_types__asset_type_id" FOREIGN KEY ("asset_type_id") REFERENCES "asset_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "fk_assets__asset_categories__category_id" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "fk_assets__asset_locations__location_id" FOREIGN KEY ("location_id") REFERENCES "asset_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "fk_assets__users__owner_user_id" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "fk_assets__users__assigned_user_id" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "fk_asset_assignments__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "fk_asset_assignments__assets__asset_id" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "fk_asset_assignments__users__assigned_to_user_id" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "fk_asset_assignments__locations__assigned_location_id" FOREIGN KEY ("assigned_location_id") REFERENCES "asset_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "fk_asset_assignments__users__assigned_by_user_id" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_relationships" ADD CONSTRAINT "fk_asset_relationships__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_relationships" ADD CONSTRAINT "fk_asset_relationships__assets__source_asset_id" FOREIGN KEY ("source_asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_relationships" ADD CONSTRAINT "fk_asset_relationships__assets__target_asset_id" FOREIGN KEY ("target_asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_relationships" ADD CONSTRAINT "fk_asset_relationships__users__created_by_user_id" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_history" ADD CONSTRAINT "fk_asset_history__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_history" ADD CONSTRAINT "fk_asset_history__assets__asset_id" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_history" ADD CONSTRAINT "fk_asset_history__users__actor_user_id" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_ticket_links" ADD CONSTRAINT "fk_asset_ticket_links__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_ticket_links" ADD CONSTRAINT "fk_asset_ticket_links__assets__asset_id" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_ticket_links" ADD CONSTRAINT "fk_asset_ticket_links__tickets__ticket_id" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_ticket_links" ADD CONSTRAINT "fk_asset_ticket_links__users__created_by_user_id" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_type_kb_links" ADD CONSTRAINT "fk_asset_type_kb_links__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_type_kb_links" ADD CONSTRAINT "fk_asset_type_kb_links__asset_types__asset_type_id" FOREIGN KEY ("asset_type_id") REFERENCES "asset_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_type_kb_links" ADD CONSTRAINT "fk_asset_type_kb_links__articles__article_id" FOREIGN KEY ("article_id") REFERENCES "kb_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_type_kb_links" ADD CONSTRAINT "fk_asset_type_kb_links__users__created_by_user_id" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_attachments" ADD CONSTRAINT "fk_asset_attachments__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_attachments" ADD CONSTRAINT "fk_asset_attachments__assets__asset_id" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_attachments" ADD CONSTRAINT "fk_asset_attachments__users__uploaded_by_id" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Seed system asset types (tenant_id NULL = available to every tenant).
INSERT INTO "asset_types" ("id", "tenant_id", "key", "name", "description", "is_system", "custom_fields_schema", "created_at", "updated_at", "deleted_at")
VALUES
  (gen_random_uuid(), NULL, 'hardware', 'Hardware', 'Physical computing equipment such as workstations and laptops', true, '[]', NOW(), NOW(), NULL),
  (gen_random_uuid(), NULL, 'software', 'Software', 'Licensed applications and installed software', true, '[]', NOW(), NOW(), NULL),
  (gen_random_uuid(), NULL, 'virtual_asset', 'Virtual Asset', 'Virtual machines and virtualized resources', true, '[]', NOW(), NOW(), NULL),
  (gen_random_uuid(), NULL, 'cloud_resource', 'Cloud Resource', 'Cloud-hosted resources such as instances and services', true, '[]', NOW(), NOW(), NULL),
  (gen_random_uuid(), NULL, 'license', 'License', 'Software and entitlement licenses', true, '[]', NOW(), NOW(), NULL),
  (gen_random_uuid(), NULL, 'peripheral', 'Peripheral', 'External devices such as monitors, keyboards, and mice', true, '[]', NOW(), NOW(), NULL),
  (gen_random_uuid(), NULL, 'network_device', 'Network Device', 'Routers, switches, firewalls, and wireless access points', true, '[]', NOW(), NOW(), NULL),
  (gen_random_uuid(), NULL, 'server', 'Server', 'Physical or virtual server systems', true, '[]', NOW(), NOW(), NULL),
  (gen_random_uuid(), NULL, 'mobile_device', 'Mobile Device', 'Smartphones, tablets, and other mobile endpoints', true, '[]', NOW(), NOW(), NULL)
ON CONFLICT ("tenant_id", "key") DO NOTHING;

-- Enable pg_trgm for asset search trigram indexes (idempotent).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- AlterTable (assignment unassignment tracking)
ALTER TABLE "asset_assignments" ADD COLUMN "unassigned_at" TIMESTAMPTZ(3),
ADD COLUMN "unassigned_by_user_id" UUID;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "fk_asset_assignments__users__unassigned_by_user_id" FOREIGN KEY ("unassigned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
