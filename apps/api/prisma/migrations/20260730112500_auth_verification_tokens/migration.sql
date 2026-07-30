-- CreateEnum
CREATE TYPE "auth_token_purpose" AS ENUM ('email_verification', 'password_reset');

-- CreateEnum
CREATE TYPE "auth_token_state" AS ENUM ('active', 'used', 'revoked', 'expired');

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "auth_token_purpose" NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "state" "auth_token_state" NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "revoke_reason" VARCHAR(255),
    "correlation_id" VARCHAR(100),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_auth_tokens" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_auth_tokens__token_hash" ON "auth_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_auth_tokens__tenant_id_user_id_purpose_state" ON "auth_tokens"("tenant_id", "user_id", "purpose", "state");

-- CreateIndex
CREATE INDEX "idx_auth_tokens__expires_at" ON "auth_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "fk_auth_tokens__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "fk_auth_tokens__users__user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

