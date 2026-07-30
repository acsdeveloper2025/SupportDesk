-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "tenant_state" AS ENUM ('active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "tenant_domain_state" AS ENUM ('pending', 'verified', 'revoked');

-- CreateEnum
CREATE TYPE "user_state" AS ENUM ('active', 'invited', 'locked', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "role_scope" AS ENUM ('own', 'organization', 'group', 'tenant', 'platform');

-- CreateEnum
CREATE TYPE "session_state" AS ENUM ('active', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "refresh_token_state" AS ENUM ('active', 'rotated', 'revoked', 'expired', 'reused');

-- CreateEnum
CREATE TYPE "audit_outcome" AS ENUM ('success', 'failure', 'denied');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "public_id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "state" "tenant_state" NOT NULL DEFAULT 'active',
    "default_locale" VARCHAR(20) NOT NULL DEFAULT 'en-US',
    "default_time_zone" VARCHAR(100) NOT NULL DEFAULT 'UTC',
    "registration_enabled" BOOLEAN NOT NULL DEFAULT false,
    "failed_login_lockout_threshold" INTEGER NOT NULL DEFAULT 5,
    "failed_login_window_minutes" INTEGER NOT NULL DEFAULT 15,
    "lockout_duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "password_expires_days" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "pk_tenants" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "namespace" VARCHAR(100) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pk_tenant_settings" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_domains" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "state" "tenant_domain_state" NOT NULL DEFAULT 'pending',
    "verified_at" TIMESTAMPTZ(3),
    "verification_token_hash" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pk_tenant_domains" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "public_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "email_normalized" VARCHAR(320) NOT NULL,
    "email_verified_at" TIMESTAMPTZ(3),
    "password_hash" VARCHAR(255) NOT NULL,
    "password_changed_at" TIMESTAMPTZ(3),
    "password_expires_at" TIMESTAMPTZ(3),
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "failed_login_window_started_at" TIMESTAMPTZ(3),
    "locked_until" TIMESTAMPTZ(3),
    "state" "user_state" NOT NULL DEFAULT 'invited',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "pk_users" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "display_name" VARCHAR(200),
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "profile_picture_placeholder" VARCHAR(100),
    "time_zone" VARCHAR(100) NOT NULL DEFAULT 'UTC',
    "language" VARCHAR(20) NOT NULL DEFAULT 'en',
    "locale" VARCHAR(20) NOT NULL DEFAULT 'en-US',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pk_user_profiles" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "preferences" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pk_user_preferences" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(500),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "pk_roles" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" VARCHAR(150) NOT NULL,
    "description" VARCHAR(500),
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pk_permissions" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "pk_user_roles" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "scope" "role_scope" NOT NULL DEFAULT 'tenant',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_role_permissions" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "state" "session_state" NOT NULL DEFAULT 'active',
    "remember_me" BOOLEAN NOT NULL DEFAULT false,
    "device_name" VARCHAR(150),
    "user_agent" TEXT,
    "ip_address" INET,
    "correlation_id" VARCHAR(100),
    "last_seen_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoke_reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pk_sessions" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "family_id" UUID NOT NULL,
    "parent_token_id" UUID,
    "state" "refresh_token_state" NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "rotated_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "revoke_reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_refresh_tokens" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "actor_user_id" UUID,
    "action" VARCHAR(150) NOT NULL,
    "outcome" "audit_outcome" NOT NULL,
    "target_type" VARCHAR(100),
    "target_id" UUID,
    "ip_address" INET,
    "user_agent" TEXT,
    "correlation_id" VARCHAR(100),
    "metadata" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_audit_events" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenants__public_id" ON "tenants"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenants__slug" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "idx_tenants__state" ON "tenants"("state");

-- CreateIndex
CREATE INDEX "idx_tenant_settings__tenant_id_namespace_active" ON "tenant_settings"("tenant_id", "namespace", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_settings__tenant_id_namespace_version" ON "tenant_settings"("tenant_id", "namespace", "version");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_domains__domain" ON "tenant_domains"("domain");

-- CreateIndex
CREATE INDEX "idx_tenant_domains__tenant_id_state" ON "tenant_domains"("tenant_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "uq_users__public_id" ON "users"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_users__email_normalized" ON "users"("email_normalized");

-- CreateIndex
CREATE INDEX "idx_users__state" ON "users"("state");

-- CreateIndex
CREATE INDEX "idx_users__email_normalized_state" ON "users"("email_normalized", "state");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_profiles__user_id" ON "user_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_preferences__user_id" ON "user_preferences"("user_id");

-- CreateIndex
CREATE INDEX "idx_roles__tenant_id_deleted_at" ON "roles"("tenant_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_roles__id_tenant_id" ON "roles"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_roles__tenant_id_key" ON "roles"("tenant_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_roles__tenant_id_name" ON "roles"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_permissions__key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "idx_user_roles__tenant_id_user_id_revoked_at" ON "user_roles"("tenant_id", "user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "idx_user_roles__tenant_id_role_id" ON "user_roles"("tenant_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_roles__tenant_id_user_id_role_id" ON "user_roles"("tenant_id", "user_id", "role_id");

-- CreateIndex
CREATE INDEX "idx_role_permissions__tenant_id_permission_id" ON "role_permissions"("tenant_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_role_permissions__tenant_id_role_id_permission_id_scope" ON "role_permissions"("tenant_id", "role_id", "permission_id", "scope");

-- CreateIndex
CREATE INDEX "idx_sessions__user_id_state" ON "sessions"("user_id", "state");

-- CreateIndex
CREATE INDEX "idx_sessions__tenant_id_user_id_state" ON "sessions"("tenant_id", "user_id", "state");

-- CreateIndex
CREATE INDEX "idx_sessions__expires_at" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_refresh_tokens__token_hash" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens__session_id_state" ON "refresh_tokens"("session_id", "state");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens__family_id_state" ON "refresh_tokens"("family_id", "state");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens__expires_at" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "idx_audit_events__tenant_id_occurred_at" ON "audit_events"("tenant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "idx_audit_events__actor_user_id_occurred_at" ON "audit_events"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "idx_audit_events__action_outcome" ON "audit_events"("action", "outcome");

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "fk_tenant_settings__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_domains" ADD CONSTRAINT "fk_tenant_domains__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "fk_user_profiles__users__user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "fk_user_preferences__users__user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "fk_roles__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles__users__user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles__roles__role_id_tenant_id" FOREIGN KEY ("role_id", "tenant_id") REFERENCES "roles"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "fk_role_permissions__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "fk_role_permissions__roles__role_id_tenant_id" FOREIGN KEY ("role_id", "tenant_id") REFERENCES "roles"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "fk_role_permissions__permissions__permission_id" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "fk_sessions__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "fk_sessions__users__user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "fk_refresh_tokens__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "fk_refresh_tokens__users__user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "fk_refresh_tokens__sessions__session_id" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "fk_refresh_tokens__refresh_tokens__parent_token_id" FOREIGN KEY ("parent_token_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "fk_audit_events__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "fk_audit_events__users__actor_user_id" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

