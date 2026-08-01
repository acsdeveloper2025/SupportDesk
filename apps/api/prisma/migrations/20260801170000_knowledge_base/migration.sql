-- CreateEnum
CREATE TYPE "kb_article_status" AS ENUM ('draft', 'review', 'published', 'archived');

-- CreateEnum
CREATE TYPE "kb_article_visibility" AS ENUM ('public', 'internal');

-- CreateTable kb_categories
CREATE TABLE "kb_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(100),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pk_kb_categories" PRIMARY KEY ("id")
);

-- CreateTable kb_articles
CREATE TABLE "kb_articles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "slug" VARCHAR(300) NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "status" "kb_article_status" NOT NULL DEFAULT 'draft',
    "visibility" "kb_article_visibility" NOT NULL DEFAULT 'public',
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "unhelpful_count" INTEGER NOT NULL DEFAULT 0,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pk_kb_articles" PRIMARY KEY ("id")
);

-- CreateTable kb_article_versions
CREATE TABLE "kb_article_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_kb_article_versions" PRIMARY KEY ("id")
);

-- CreateTable kb_tags
CREATE TABLE "kb_tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_kb_tags" PRIMARY KEY ("id")
);

-- CreateTable kb_article_tags
CREATE TABLE "kb_article_tags" (
    "article_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "pk_kb_article_tags" PRIMARY KEY ("article_id","tag_id")
);

-- CreateTable kb_ticket_links
CREATE TABLE "kb_ticket_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_kb_ticket_links" PRIMARY KEY ("id")
);

-- CreateIndexes & Unique constraints for kb_categories
CREATE UNIQUE INDEX "uq_kb_categories__tenant_id_slug" ON "kb_categories"("tenant_id", "slug");
CREATE INDEX "idx_kb_categories__tenant_id_parent_id" ON "kb_categories"("tenant_id", "parent_id");

-- CreateIndexes & Unique constraints for kb_articles
CREATE UNIQUE INDEX "uq_kb_articles__tenant_id_slug" ON "kb_articles"("tenant_id", "slug");
CREATE INDEX "idx_kb_articles__tenant_category_status" ON "kb_articles"("tenant_id", "category_id", "status");
CREATE INDEX "idx_kb_articles__tenant_visibility_status" ON "kb_articles"("tenant_id", "visibility", "status");

-- CreateIndexes & Unique constraints for kb_article_versions
CREATE UNIQUE INDEX "uq_kb_article_versions__tenant_article_version" ON "kb_article_versions"("tenant_id", "article_id", "version_number");
CREATE INDEX "idx_kb_article_versions__tenant_id_article_id" ON "kb_article_versions"("tenant_id", "article_id");

-- CreateIndexes & Unique constraints for kb_tags
CREATE UNIQUE INDEX "uq_kb_tags__tenant_id_slug" ON "kb_tags"("tenant_id", "slug");

-- CreateIndexes & Unique constraints for kb_ticket_links
CREATE UNIQUE INDEX "uq_kb_ticket_links__tenant_ticket_article" ON "kb_ticket_links"("tenant_id", "ticket_id", "article_id");
CREATE INDEX "idx_kb_ticket_links__tenant_ticket" ON "kb_ticket_links"("tenant_id", "ticket_id");
CREATE INDEX "idx_kb_ticket_links__tenant_article" ON "kb_ticket_links"("tenant_id", "article_id");

-- Add Foreign Key constraints
ALTER TABLE "kb_categories" ADD CONSTRAINT "fk_kb_categories__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kb_categories" ADD CONSTRAINT "fk_kb_categories__parents__parent_id" FOREIGN KEY ("parent_id") REFERENCES "kb_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "kb_articles" ADD CONSTRAINT "fk_kb_articles__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kb_articles" ADD CONSTRAINT "fk_kb_articles__categories__category_id" FOREIGN KEY ("category_id") REFERENCES "kb_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kb_articles" ADD CONSTRAINT "fk_kb_articles__users__author_id" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kb_article_versions" ADD CONSTRAINT "fk_kb_article_versions__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kb_article_versions" ADD CONSTRAINT "fk_kb_article_versions__articles__article_id" FOREIGN KEY ("article_id") REFERENCES "kb_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kb_article_versions" ADD CONSTRAINT "fk_kb_article_versions__users__created_by_id" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kb_tags" ADD CONSTRAINT "fk_kb_tags__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kb_article_tags" ADD CONSTRAINT "fk_kb_article_tags__articles__article_id" FOREIGN KEY ("article_id") REFERENCES "kb_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kb_article_tags" ADD CONSTRAINT "fk_kb_article_tags__tags__tag_id" FOREIGN KEY ("tag_id") REFERENCES "kb_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kb_ticket_links" ADD CONSTRAINT "fk_kb_ticket_links__tenants__tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kb_ticket_links" ADD CONSTRAINT "fk_kb_ticket_links__tickets__ticket_id" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kb_ticket_links" ADD CONSTRAINT "fk_kb_ticket_links__articles__article_id" FOREIGN KEY ("article_id") REFERENCES "kb_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kb_ticket_links" ADD CONSTRAINT "fk_kb_ticket_links__users__created_by_id" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
