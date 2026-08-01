-- CreateEnum
CREATE TYPE "ticket_status" AS ENUM ('new', 'open', 'pending', 'on_hold', 'solved', 'closed');

-- CreateEnum
CREATE TYPE "ticket_priority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "ticket_channel" AS ENUM ('web', 'email', 'api', 'chat');

-- CreateEnum
CREATE TYPE "ticket_type" AS ENUM ('question', 'incident', 'problem', 'feature_request');

-- CreateEnum
CREATE TYPE "comment_visibility" AS ENUM ('public', 'internal');

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "public_ref" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ticket_status" NOT NULL DEFAULT 'new',
    "priority" "ticket_priority" NOT NULL DEFAULT 'medium',
    "channel" "ticket_channel" NOT NULL DEFAULT 'web',
    "type" "ticket_type" NOT NULL DEFAULT 'question',
    "requester_user_id" UUID NOT NULL,
    "assignee_user_id" UUID,
    "assigned_group_id" UUID,
    "solved_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "due_date" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "pk_tickets" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "comment_visibility" NOT NULL DEFAULT 'public',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "pk_comments" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_tickets__tenant_id_public_ref" ON "tickets"("tenant_id", "public_ref");

-- CreateIndex
CREATE INDEX "idx_tickets__tenant_id_status" ON "tickets"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "idx_tickets__tenant_id_assignee_user_id" ON "tickets"("tenant_id", "assignee_user_id");

-- CreateIndex
CREATE INDEX "idx_tickets__tenant_id_requester_user_id" ON "tickets"("tenant_id", "requester_user_id");

-- CreateIndex
CREATE INDEX "idx_comments__tenant_id_ticket_id_created_at" ON "comments"("tenant_id", "ticket_id", "created_at");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "fk_tickets__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "fk_tickets__users__requester_user_id" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "fk_tickets__users__assignee_user_id" FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "fk_comments__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "fk_comments__tickets__ticket_id" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "fk_comments__users__author_user_id" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
