-- CreateTable
CREATE TABLE "workflows" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "paused_at" TIMESTAMPTZ(3),
    "paused_reason" VARCHAR(500),
    "active_version_number" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "pk_workflows" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "state" "config_publication_state" NOT NULL DEFAULT 'draft',
    "triggers" JSONB NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pk_workflow_versions" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_workflows__tenant_id_key"
  ON "workflows"("tenant_id", "key");

CREATE INDEX "idx_workflows__tenant_id_deleted_at"
  ON "workflows"("tenant_id", "deleted_at");

CREATE INDEX "idx_workflows__tenant_id_enabled_priority"
  ON "workflows"("tenant_id", "enabled", "priority");

CREATE UNIQUE INDEX "uq_workflow_versions__tenant_workflow_version"
  ON "workflow_versions"("tenant_id", "workflow_id", "version_number");

CREATE INDEX "idx_workflow_versions__tenant_workflow_state"
  ON "workflow_versions"("tenant_id", "workflow_id", "state");

-- AddForeignKey
ALTER TABLE "workflows"
  ADD CONSTRAINT "fk_workflows__tenants__tenant_id"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflow_versions"
  ADD CONSTRAINT "fk_workflow_versions__tenants__tenant_id"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflow_versions"
  ADD CONSTRAINT "fk_workflow_versions__workflows__workflow_id"
  FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
