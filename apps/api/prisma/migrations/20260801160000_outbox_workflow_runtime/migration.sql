-- CreateEnum
CREATE TYPE "outbox_state" AS ENUM ('pending', 'claimed', 'processed', 'failed', 'dead_lettered');

-- CreateEnum
CREATE TYPE "execution_state" AS ENUM ('running', 'succeeded', 'skipped_conditions', 'failed', 'partial_failed', 'dead_lettered', 'skipped_depth_cap');

-- CreateEnum
CREATE TYPE "action_attempt_state" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'dead_lettered');

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_type" VARCHAR(150) NOT NULL,
    "aggregate_type" VARCHAR(100) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "dedupe_key" VARCHAR(255) NOT NULL,
    "payload" JSONB NOT NULL,
    "correlation_id" VARCHAR(100) NOT NULL,
    "causation_id" VARCHAR(100),
    "automation_depth" INTEGER NOT NULL DEFAULT 0,
    "state" "outbox_state" NOT NULL DEFAULT 'pending',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_owner" VARCHAR(100),
    "lease_expires_at" TIMESTAMPTZ(3),
    "last_error" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "pk_outbox_events" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_executions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "outbox_event_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "workflow_version_id" UUID NOT NULL,
    "workflow_version_number" INTEGER NOT NULL,
    "trigger_event_type" VARCHAR(150) NOT NULL,
    "priority" INTEGER NOT NULL,
    "automation_depth" INTEGER NOT NULL,
    "condition_result" JSONB,
    "state" "execution_state" NOT NULL DEFAULT 'running',
    "last_error" JSONB,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "pk_workflow_executions" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_action_attempts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "execution_id" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "action_type" VARCHAR(100) NOT NULL,
    "params_snapshot" JSONB NOT NULL,
    "state" "action_attempt_state" NOT NULL DEFAULT 'pending',
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "result_ref" JSONB,
    "last_error" JSONB,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "pk_workflow_action_attempts" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_intents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_type" VARCHAR(100) NOT NULL,
    "source_id" VARCHAR(255) NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "channel" VARCHAR(50) NOT NULL,
    "template_key" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupe_key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_notification_intents" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_outbox_events__tenant_id_dedupe_key" ON "outbox_events"("tenant_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "idx_outbox_events__state_available_at_tenant_id" ON "outbox_events"("state", "available_at", "tenant_id");

-- CreateIndex
CREATE INDEX "idx_outbox_events__tenant_id_aggregate" ON "outbox_events"("tenant_id", "aggregate_type", "aggregate_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_workflow_executions__tenant_outbox_event_version" ON "workflow_executions"("tenant_id", "outbox_event_id", "workflow_version_id");

-- CreateIndex
CREATE INDEX "idx_workflow_executions__tenant_id_workflow_id_started_at" ON "workflow_executions"("tenant_id", "workflow_id", "started_at");

-- CreateIndex
CREATE INDEX "idx_workflow_executions__tenant_id_state" ON "workflow_executions"("tenant_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "uq_workflow_action_attempts__tenant_execution_ordinal" ON "workflow_action_attempts"("tenant_id", "execution_id", "ordinal");

-- CreateIndex
CREATE INDEX "idx_workflow_action_attempts__tenant_id_execution_id" ON "workflow_action_attempts"("tenant_id", "execution_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_notification_intents__tenant_id_dedupe_key" ON "notification_intents"("tenant_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "idx_notification_intents__tenant_recipient_created" ON "notification_intents"("tenant_id", "recipient_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "fk_outbox_events__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "fk_workflow_executions__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "fk_workflow_executions__outbox_events__outbox_event_id" FOREIGN KEY ("outbox_event_id") REFERENCES "outbox_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "fk_workflow_executions__workflows__workflow_id" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "fk_workflow_executions__workflow_versions__workflow_version_id" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_action_attempts" ADD CONSTRAINT "fk_workflow_action_attempts__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_action_attempts" ADD CONSTRAINT "fk_workflow_action_attempts__executions__execution_id" FOREIGN KEY ("execution_id") REFERENCES "workflow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_intents" ADD CONSTRAINT "fk_notification_intents__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_intents" ADD CONSTRAINT "fk_notification_intents__users__recipient_user_id" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
