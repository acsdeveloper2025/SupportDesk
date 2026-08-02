-- Create global_settings table
CREATE TABLE "global_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL DEFAULT '{}',
    "description" VARCHAR(500),
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_global_settings" PRIMARY KEY ("id")
);

-- Create feature_flags table
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "rules" JSONB NOT NULL DEFAULT '{}',
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_feature_flags" PRIMARY KEY ("id")
);

-- Create system_maintenance_windows table
CREATE TABLE "system_maintenance_windows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_platform_wide" BOOLEAN NOT NULL DEFAULT true,
    "tenant_id" UUID,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
    "allow_admin_access" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_system_maintenance_windows" PRIMARY KEY ("id")
);

-- Unique constraints & Indexes
CREATE UNIQUE INDEX "uq_global_settings__key" ON "global_settings"("key");
CREATE UNIQUE INDEX "uq_feature_flags__tenant_key" ON "feature_flags"("tenant_id", "key");
CREATE INDEX "idx_feature_flags__key" ON "feature_flags"("key");
CREATE INDEX "idx_maintenance_windows__status_starts_at" ON "system_maintenance_windows"("status", "starts_at");

-- Foreign key constraints
ALTER TABLE "global_settings" ADD CONSTRAINT "fk_global_settings__users__updated_by_user_id" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "feature_flags" ADD CONSTRAINT "fk_feature_flags__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feature_flags" ADD CONSTRAINT "fk_feature_flags__users__created_by_user_id" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "system_maintenance_windows" ADD CONSTRAINT "fk_system_maintenance_windows__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "system_maintenance_windows" ADD CONSTRAINT "fk_system_maintenance_windows__users__created_by_user_id" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
