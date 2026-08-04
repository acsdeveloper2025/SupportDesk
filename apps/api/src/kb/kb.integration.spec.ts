import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { KbArticleStatus, KbArticleVisibility } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AppModule } from "../app.module";
import { cleanDatabase } from "../common/testing/clean-database";
import { PrismaService } from "../database/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import { KbArticlesService } from "./kb-articles.service";
import { KbCategoriesService } from "./kb-categories.service";

const databaseUrl = process.env.DATABASE_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration("Knowledge Base Integration Tests", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let categoriesService: KbCategoriesService;
  let articlesService: KbArticlesService;

  let tenant1Id: string;
  let tenant2Id: string;
  let user1Id: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    categoriesService = moduleRef.get(KbCategoriesService);
    articlesService = moduleRef.get(KbArticlesService);
    const rbacService = moduleRef.get(RbacService);
    vi.spyOn(rbacService, "can").mockResolvedValue(true);
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    const t1 = await prisma.tenant.create({
      data: {
        slug: `kb-t1-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        name: "KB Tenant 1",
      },
    });
    tenant1Id = t1.id;

    const t2 = await prisma.tenant.create({
      data: {
        slug: `kb-t2-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        name: "KB Tenant 2",
      },
    });
    tenant2Id = t2.id;

    const u1 = await prisma.user.create({
      data: {
        email: `kb-u1-${Date.now()}@example.com`,
        emailNormalized: `kb-u1-${Date.now()}@example.com`,
        passwordHash: "hash",
        state: "ACTIVE",
      },
    });
    user1Id = u1.id;
  });

  it("supports category tree creation, article lifecycle, versioning, search, ticket linking, and tenant isolation", async () => {
    // 1. Create root category and nested category in Tenant 1
    const rootCat = await categoriesService.createCategory(
      tenant1Id,
      { name: "Documentation", icon: "book" },
      user1Id,
    );
    expect(rootCat.slug).toBe("documentation");

    const nestedCat = await categoriesService.createCategory(
      tenant1Id,
      { name: "API Guides", parentId: rootCat.id },
      user1Id,
    );
    expect(nestedCat.parentId).toBe(rootCat.id);

    // 2. Create article draft in nested category
    const article = await articlesService.createArticle(tenant1Id, user1Id, {
      categoryId: nestedCat.id,
      title: "OAuth 2.0 Integration Guide",
      content: "# OAuth 2.0\nFollow these steps to connect your identity provider...",
      summary: "Step-by-step OAuth 2.0 configuration guide.",
      tags: ["oauth", "security", "sso"],
      visibility: KbArticleVisibility.PUBLIC,
    });
    expect(article.status).toBe(KbArticleStatus.DRAFT);
    expect(article.versionNumber).toBe(1);

    // 3. Publish article -> increments version & creates version snapshot & outbox event
    const published = await articlesService.publishArticle(tenant1Id, article.id, user1Id);
    expect(published.status).toBe(KbArticleStatus.PUBLISHED);
    expect(published.publishedAt).toBeDefined();

    // Check version snapshot
    const versions = await articlesService.getVersions(tenant1Id, article.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.versionNumber).toBe(1);
    expect(versions[0]?.title).toBe("OAuth 2.0 Integration Guide");

    // Check outbox event
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { tenantId: tenant1Id, aggregateId: article.id },
    });
    expect(outboxEvents.length).toBeGreaterThan(0);
    expect(outboxEvents[0]?.eventType).toBe("kb.article.published");

    // 4. Update published article & re-publish -> version 2
    await articlesService.updateArticle(
      tenant1Id,
      article.id,
      {
        content: "# OAuth 2.0 Updated\nNew instructions...",
      },
      user1Id,
    );

    const republished = await articlesService.publishArticle(tenant1Id, article.id, user1Id);
    expect(republished.versionNumber).toBe(2);

    const versions2 = await articlesService.getVersions(tenant1Id, article.id);
    expect(versions2).toHaveLength(2);

    // 5. Search article
    const searchRes = await articlesService.searchArticles(tenant1Id, { q: "OAuth" }, true);
    expect(searchRes.items).toHaveLength(1);
    expect(searchRes.items[0]?.id).toBe(article.id);

    // 6. Link to Ticket
    const ticket = await prisma.ticket.create({
      data: {
        tenantId: tenant1Id,
        publicRef: "TICK-KB-1",
        title: "SSO issue",
        description: "User needs OAuth instructions",
        requesterUserId: user1Id,
      },
    });

    const link = await articlesService.linkTicket(
      tenant1Id,
      article.id,
      { ticketId: ticket.id },
      user1Id,
    );
    expect(link.ticketId).toBe(ticket.id);

    // 7. Tenant Isolation Negative Test: Tenant 2 cannot access Tenant 1 category or article
    await expect(categoriesService.getCategory(tenant2Id, rootCat.id)).rejects.toThrow();

    await expect(articlesService.getArticle(tenant2Id, article.id, true)).rejects.toThrow();

    const tenant2Search = await articlesService.searchArticles(tenant2Id, { q: "OAuth" }, true);
    expect(tenant2Search.items).toHaveLength(0);
  });
});
