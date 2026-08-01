-- CreateEnum
CREATE TYPE "service_kind" AS ENUM ('business', 'technical');

-- CreateEnum
CREATE TYPE "service_approval_mode" AS ENUM ('none', 'single', 'all', 'any');

-- CreateEnum
CREATE TYPE "service_request_status" AS ENUM ('submitted', 'awaiting_approval', 'approved', 'rejected', 'changes_requested', 'in_fulfillment', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "service_approval_status" AS ENUM ('pending', 'approved', 'rejected', 'changes_requested');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "notification_event_type" ADD VALUE 'request.submitted';
ALTER TYPE "notification_event_type" ADD VALUE 'request.approval_required';
ALTER TYPE "notification_event_type" ADD VALUE 'request.approval_decided';
ALTER TYPE "notification_event_type" ADD VALUE 'request.rejected';
ALTER TYPE "notification_event_type" ADD VALUE 'request.changes_requested';
ALTER TYPE "notification_event_type" ADD VALUE 'request.fulfillment_started';
ALTER TYPE "notification_event_type" ADD VALUE 'request.ticket_created';
ALTER TYPE "notification_event_type" ADD VALUE 'request.completed';
ALTER TYPE "notification_event_type" ADD VALUE 'request.cancelled';

-- CreateTable
CREATE TABLE "service_categories" (
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

    CONSTRAINT "pk_service_categories" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "kind" "service_kind" NOT NULL DEFAULT 'business',
    "state" "config_publication_state" NOT NULL DEFAULT 'draft',
    "approval_mode" "service_approval_mode" NOT NULL DEFAULT 'none',
    "approval_steps" JSONB NOT NULL DEFAULT '[]',
    "sla_policy_id" UUID,
    "default_ticket_type" "ticket_type" NOT NULL DEFAULT 'feature_request',
    "default_priority" "ticket_priority" NOT NULL DEFAULT 'medium',
    "suggested_kb_tags" JSONB NOT NULL DEFAULT '[]',
    "generate_ticket_on_fulfillment" BOOLEAN NOT NULL DEFAULT true,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "pk_service_items" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_request_forms" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "form_version" INTEGER NOT NULL DEFAULT 1,
    "schema" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pk_service_request_forms" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "service_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "field_values" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "pk_request_templates" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "request_ref" VARCHAR(30) NOT NULL,
    "service_id" UUID NOT NULL,
    "service_name" VARCHAR(200) NOT NULL,
    "service_kind" "service_kind" NOT NULL DEFAULT 'business',
    "submitted_form_version" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "requester_user_id" UUID NOT NULL,
    "requested_for_user_id" UUID,
    "status" "service_request_status" NOT NULL DEFAULT 'submitted',
    "priority" "ticket_priority" NOT NULL DEFAULT 'medium',
    "ticket_id" UUID,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ(3),
    "fulfillment_started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancelled_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "pk_service_requests" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_request_approvals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "step_number" INTEGER NOT NULL,
    "approver_role" VARCHAR(100),
    "approver_user_id" UUID,
    "status" "service_approval_status" NOT NULL DEFAULT 'pending',
    "decided_by_user_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "decision_comment" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_service_request_approvals" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_request_attachments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_service_request_attachments" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_request_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "from_status" "service_request_status",
    "to_status" "service_request_status",
    "actor_user_id" UUID,
    "comment" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_service_request_history" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_service_categories__tenant_id_parent_id" ON "service_categories"("tenant_id", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_service_categories__tenant_id_slug" ON "service_categories"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "idx_service_items__tenant_id_state_kind" ON "service_items"("tenant_id", "state", "kind");

-- CreateIndex
CREATE INDEX "idx_service_items__tenant_id_category_state" ON "service_items"("tenant_id", "category_id", "state");

-- CreateIndex
CREATE INDEX "idx_service_items__tenant_id_sla_policy_id" ON "service_items"("tenant_id", "sla_policy_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_service_items__tenant_id_slug" ON "service_items"("tenant_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "uq_service_request_forms__service_id" ON "service_request_forms"("service_id");

-- CreateIndex
CREATE INDEX "idx_service_request_forms__tenant_id_service_id" ON "service_request_forms"("tenant_id", "service_id");

-- CreateIndex
CREATE INDEX "idx_request_templates__tenant_id_service_id" ON "request_templates"("tenant_id", "service_id");

-- CreateIndex
CREATE INDEX "idx_request_templates__tenant_id_is_default" ON "request_templates"("tenant_id", "is_default");

-- CreateIndex
CREATE INDEX "idx_service_requests__tenant_id_status_created_at" ON "service_requests"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "idx_service_requests__tenant_id_requester_created_at" ON "service_requests"("tenant_id", "requester_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_service_requests__tenant_id_request_ref" ON "service_requests"("tenant_id", "request_ref");

-- CreateIndex
CREATE UNIQUE INDEX "uq_service_requests__tenant_id_ticket_id" ON "service_requests"("tenant_id", "ticket_id");

-- CreateIndex
CREATE INDEX "idx_service_request_approvals__tenant_request_status" ON "service_request_approvals"("tenant_id", "request_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_service_request_approvals__tenant_request_step" ON "service_request_approvals"("tenant_id", "request_id", "step_number");

-- CreateIndex
CREATE INDEX "idx_service_request_attachments__tenant_request" ON "service_request_attachments"("tenant_id", "request_id");

-- CreateIndex
CREATE INDEX "idx_service_request_history__tenant_request_created_at" ON "service_request_history"("tenant_id", "request_id", "created_at");

-- AddForeignKey
ALTER TABLE "service_categories" ADD CONSTRAINT "fk_service_categories__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_categories" ADD CONSTRAINT "fk_service_categories__parents__parent_id" FOREIGN KEY ("parent_id") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_items" ADD CONSTRAINT "fk_service_items__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_items" ADD CONSTRAINT "fk_service_items__categories__category_id" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_items" ADD CONSTRAINT "fk_service_items__sla_policies__sla_policy_id" FOREIGN KEY ("sla_policy_id") REFERENCES "sla_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_forms" ADD CONSTRAINT "fk_service_request_forms__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_forms" ADD CONSTRAINT "fk_service_request_forms__services__service_id" FOREIGN KEY ("service_id") REFERENCES "service_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_templates" ADD CONSTRAINT "fk_request_templates__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_templates" ADD CONSTRAINT "fk_request_templates__services__service_id" FOREIGN KEY ("service_id") REFERENCES "service_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_templates" ADD CONSTRAINT "fk_request_templates__users__created_by_id" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "fk_service_requests__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "fk_service_requests__services__service_id" FOREIGN KEY ("service_id") REFERENCES "service_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "fk_service_requests__users__requester_user_id" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "fk_service_requests__users__requested_for_user_id" FOREIGN KEY ("requested_for_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "fk_service_requests__tickets__ticket_id" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_approvals" ADD CONSTRAINT "fk_service_request_approvals__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_approvals" ADD CONSTRAINT "fk_service_request_approvals__requests__request_id" FOREIGN KEY ("request_id") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_approvals" ADD CONSTRAINT "fk_service_request_approvals__users__decided_by_user_id" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_attachments" ADD CONSTRAINT "fk_service_request_attachments__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_attachments" ADD CONSTRAINT "fk_service_request_attachments__requests__request_id" FOREIGN KEY ("request_id") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_attachments" ADD CONSTRAINT "fk_service_request_attachments__users__uploaded_by_id" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_history" ADD CONSTRAINT "fk_service_request_history__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_history" ADD CONSTRAINT "fk_service_request_history__requests__request_id" FOREIGN KEY ("request_id") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_history" ADD CONSTRAINT "fk_service_request_history__users__actor_user_id" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

