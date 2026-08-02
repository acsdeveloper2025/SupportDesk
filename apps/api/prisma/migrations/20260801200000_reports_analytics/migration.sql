-- CreateTable saved_reports
CREATE TABLE "saved_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "report_type" VARCHAR(100) NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_saved_reports" PRIMARY KEY ("id")
);

-- CreateTable scheduled_reports
CREATE TABLE "scheduled_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "saved_report_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "report_type" VARCHAR(100) NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "frequency" VARCHAR(50) NOT NULL,
    "cron_expression" VARCHAR(100),
    "export_format" VARCHAR(20) NOT NULL DEFAULT 'csv',
    "recipient_user_ids" JSONB NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMPTZ(3),
    "next_run_at" TIMESTAMPTZ(3),
    "last_status" VARCHAR(50),
    "last_error" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_scheduled_reports" PRIMARY KEY ("id")
);

-- CreateTable report_exports
CREATE TABLE "report_exports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "report_type" VARCHAR(100) NOT NULL,
    "export_format" VARCHAR(20) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "file_name" VARCHAR(255) NOT NULL,
    "file_size_bytes" BIGINT,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "error_details" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "pk_report_exports" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX "idx_saved_reports__tenant_report_type" ON "saved_reports"("tenant_id", "report_type");
CREATE INDEX "idx_saved_reports__tenant_created_by" ON "saved_reports"("tenant_id", "created_by_id");

CREATE INDEX "idx_scheduled_reports__tenant_enabled" ON "scheduled_reports"("tenant_id", "enabled");
CREATE INDEX "idx_scheduled_reports__tenant_next_run_at" ON "scheduled_reports"("tenant_id", "next_run_at");

CREATE INDEX "idx_report_exports__tenant_created_by_created_at" ON "report_exports"("tenant_id", "created_by_id", "created_at");
CREATE INDEX "idx_report_exports__tenant_status" ON "report_exports"("tenant_id", "status");

-- AddForeignKeys
ALTER TABLE "saved_reports" ADD CONSTRAINT "fk_saved_reports__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_reports" ADD CONSTRAINT "fk_saved_reports__users__created_by_id" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scheduled_reports" ADD CONSTRAINT "fk_scheduled_reports__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "fk_scheduled_reports__users__created_by_id" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "fk_scheduled_reports__saved_reports__saved_report_id" FOREIGN KEY ("saved_report_id") REFERENCES "saved_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "report_exports" ADD CONSTRAINT "fk_report_exports__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_exports" ADD CONSTRAINT "fk_report_exports__users__created_by_id" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
