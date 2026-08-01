-- CreateEnum
CREATE TYPE "notification_event_type" AS ENUM (
  'ticket.assigned',
  'ticket.reassigned',
  'ticket.status_changed',
  'comment.created.public',
  'comment.created.internal',
  'attachment.uploaded',
  'auth.session.revoked',
  'settings.security.updated'
);

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('in_app', 'email');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "event_type" "notification_event_type" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT,
    "resource_type" VARCHAR(100),
    "resource_id" UUID,
    "actor_user_id" UUID,
    "payload" JSONB,
    "read_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pk_notifications" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_type" "notification_event_type" NOT NULL,
    "channel" "notification_channel" NOT NULL DEFAULT 'in_app',
    "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pk_notification_preferences" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_notifications__tenant_id_recipient_user_id_created_at"
  ON "notifications"("tenant_id", "recipient_user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_notifications__tenant_id_recipient_user_id_read_at"
  ON "notifications"("tenant_id", "recipient_user_id", "read_at");

-- CreateIndex
CREATE INDEX "idx_notifications__tenant_id_recipient_user_id_event_type"
  ON "notifications"("tenant_id", "recipient_user_id", "event_type");

-- CreateIndex
CREATE INDEX "idx_notifications__tenant_id_recipient_user_id_archived_at"
  ON "notifications"("tenant_id", "recipient_user_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_notification_preferences__tenant_user_event_channel"
  ON "notification_preferences"("tenant_id", "user_id", "event_type", "channel");

-- CreateIndex
CREATE INDEX "idx_notification_preferences__tenant_id_user_id"
  ON "notification_preferences"("tenant_id", "user_id");

-- AddForeignKey
ALTER TABLE "notifications"
  ADD CONSTRAINT "fk_notifications__tenants__tenant_id"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications"
  ADD CONSTRAINT "fk_notifications__users__recipient_user_id"
  FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications"
  ADD CONSTRAINT "fk_notifications__users__actor_user_id"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences"
  ADD CONSTRAINT "fk_notification_preferences__tenants__tenant_id"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences"
  ADD CONSTRAINT "fk_notification_preferences__users__user_id"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
