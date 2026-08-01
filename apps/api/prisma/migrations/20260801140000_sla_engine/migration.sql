-- AlterEnum: add SLA notification event types
ALTER TYPE "notification_event_type" ADD VALUE IF NOT EXISTS 'sla.warning';
ALTER TYPE "notification_event_type" ADD VALUE IF NOT EXISTS 'sla.breached';

-- CreateEnum
CREATE TYPE "config_publication_state" AS ENUM ('draft', 'published', 'retired');

-- CreateEnum
CREATE TYPE "sla_target_type" AS ENUM ('response', 'resolution');

-- CreateEnum
CREATE TYPE "sla_target_state" AS ENUM ('running', 'paused', 'met', 'breached', 'cancelled');

-- CreateTable
CREATE TABLE "business_schedules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "active_version_number" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "pk_business_schedules" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_schedule_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "state" "config_publication_state" NOT NULL DEFAULT 'draft',
    "time_zone" VARCHAR(100) NOT NULL,
    "weekly_hours" JSONB NOT NULL,
    "holidays" JSONB NOT NULL DEFAULT '[]',
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pk_business_schedule_versions" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "active_version_number" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "pk_sla_policies" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policy_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "state" "config_publication_state" NOT NULL DEFAULT 'draft',
    "priority" INTEGER NOT NULL,
    "schedule_key" VARCHAR(100) NOT NULL DEFAULT 'default',
    "match_priorities" JSONB NOT NULL DEFAULT '[]',
    "match_types" JSONB NOT NULL DEFAULT '[]',
    "match_channels" JSONB NOT NULL DEFAULT '[]',
    "response_minutes" INTEGER NOT NULL,
    "resolution_minutes" INTEGER NOT NULL,
    "pause_on_pending" BOOLEAN NOT NULL DEFAULT TRUE,
    "pause_on_hold" BOOLEAN NOT NULL DEFAULT FALSE,
    "restart_resolution_on_reopen" BOOLEAN NOT NULL DEFAULT FALSE,
    "warning_threshold_percent" INTEGER NOT NULL DEFAULT 80,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pk_sla_policy_versions" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_targets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "type" "sla_target_type" NOT NULL,
    "state" "sla_target_state" NOT NULL DEFAULT 'running',
    "policy_version_id" UUID NOT NULL,
    "schedule_version_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "paused_at" TIMESTAMPTZ(3),
    "accumulated_pause_ms" BIGINT NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ(3),
    "breached_at" TIMESTAMPTZ(3),
    "warning_notified_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pk_sla_targets" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_evaluations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "target_id" UUID,
    "policy_version_id" UUID NOT NULL,
    "schedule_version_id" UUID NOT NULL,
    "reason" VARCHAR(100) NOT NULL,
    "inputs" JSONB NOT NULL,
    "computed_due_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_sla_evaluations" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_business_schedules__tenant_id_key"
  ON "business_schedules"("tenant_id", "key");

CREATE INDEX "idx_business_schedules__tenant_id"
  ON "business_schedules"("tenant_id");

CREATE UNIQUE INDEX "uq_business_schedule_versions__tenant_schedule_version"
  ON "business_schedule_versions"("tenant_id", "schedule_id", "version_number");

CREATE INDEX "idx_business_schedule_versions__tenant_schedule_state"
  ON "business_schedule_versions"("tenant_id", "schedule_id", "state");

CREATE UNIQUE INDEX "uq_sla_policies__tenant_id_key"
  ON "sla_policies"("tenant_id", "key");

CREATE INDEX "idx_sla_policies__tenant_id"
  ON "sla_policies"("tenant_id");

CREATE UNIQUE INDEX "uq_sla_policy_versions__tenant_policy_version"
  ON "sla_policy_versions"("tenant_id", "policy_id", "version_number");

CREATE INDEX "idx_sla_policy_versions__tenant_state_priority"
  ON "sla_policy_versions"("tenant_id", "state", "priority");

-- Unique published priority per tenant (one published policy version may own a priority)
CREATE UNIQUE INDEX "uq_sla_policy_versions__tenant_published_priority"
  ON "sla_policy_versions"("tenant_id", "priority")
  WHERE "state" = 'published';

CREATE INDEX "idx_sla_targets__tenant_id_state_due_at"
  ON "sla_targets"("tenant_id", "state", "due_at");

CREATE INDEX "idx_sla_targets__tenant_id_ticket_id_type"
  ON "sla_targets"("tenant_id", "ticket_id", "type");

-- One active (running/paused) target per ticket/type
CREATE UNIQUE INDEX "uq_sla_targets__active_per_ticket_type"
  ON "sla_targets"("tenant_id", "ticket_id", "type")
  WHERE "state" IN ('running', 'paused');

CREATE INDEX "idx_sla_evaluations__tenant_id_ticket_id_created_at"
  ON "sla_evaluations"("tenant_id", "ticket_id", "created_at");

-- AddForeignKey
ALTER TABLE "business_schedules"
  ADD CONSTRAINT "fk_business_schedules__tenants__tenant_id"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_schedule_versions"
  ADD CONSTRAINT "fk_business_schedule_versions__tenants__tenant_id"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_schedule_versions"
  ADD CONSTRAINT "fk_bs_versions__business_schedules__schedule_id"
  FOREIGN KEY ("schedule_id") REFERENCES "business_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sla_policies"
  ADD CONSTRAINT "fk_sla_policies__tenants__tenant_id"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sla_policy_versions"
  ADD CONSTRAINT "fk_sla_policy_versions__tenants__tenant_id"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sla_policy_versions"
  ADD CONSTRAINT "fk_sla_policy_versions__sla_policies__policy_id"
  FOREIGN KEY ("policy_id") REFERENCES "sla_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sla_targets"
  ADD CONSTRAINT "fk_sla_targets__tenants__tenant_id"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sla_targets"
  ADD CONSTRAINT "fk_sla_targets__tickets__ticket_id"
  FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sla_targets"
  ADD CONSTRAINT "fk_sla_targets__sla_policy_versions__policy_version_id"
  FOREIGN KEY ("policy_version_id") REFERENCES "sla_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sla_targets"
  ADD CONSTRAINT "fk_sla_targets__schedule_versions__schedule_version_id"
  FOREIGN KEY ("schedule_version_id") REFERENCES "business_schedule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sla_evaluations"
  ADD CONSTRAINT "fk_sla_evaluations__tenants__tenant_id"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sla_evaluations"
  ADD CONSTRAINT "fk_sla_evaluations__tickets__ticket_id"
  FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sla_evaluations"
  ADD CONSTRAINT "fk_sla_evaluations__sla_targets__target_id"
  FOREIGN KEY ("target_id") REFERENCES "sla_targets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sla_evaluations"
  ADD CONSTRAINT "fk_sla_evaluations__sla_policy_versions__policy_version_id"
  FOREIGN KEY ("policy_version_id") REFERENCES "sla_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sla_evaluations"
  ADD CONSTRAINT "fk_sla_evaluations__schedule_versions__schedule_version_id"
  FOREIGN KEY ("schedule_version_id") REFERENCES "business_schedule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
