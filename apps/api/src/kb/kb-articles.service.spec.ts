/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NotFoundException } from "@nestjs/common";
import { KbArticleVisibility } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../database/prisma.service";
import type { KbArticlesRepository } from "./kb-articles.repository";
import { KbArticlesService } from "./kb-articles.service";
import type { KbCategoriesRepository } from "./kb-categories.repository";

describe("KbArticlesService", () => {
  let service: KbArticlesService;
  let repository: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findBySlug: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
    archive: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    incrementViews: ReturnType<typeof vi.fn>;
    recordFeedback: ReturnType<typeof vi.fn>;
    getVersions: ReturnType<typeof vi.fn>;
    getVersion: ReturnType<typeof vi.fn>;
    linkTicket: ReturnType<typeof vi.fn>;
    unlinkTicket: ReturnType<typeof vi.fn>;
  };
  let categoriesRepository: {
    findById: ReturnType<typeof vi.fn>;
  };
  let prisma: {
    auditEvent: {
      create: ReturnType<typeof vi.fn>;
    };
    outboxEvent: {
      create: ReturnType<typeof vi.fn>;
    };
    ticket: {
      findFirst: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    repository = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      list: vi.fn(),
      search: vi.fn(),
      update: vi.fn(),
      publish: vi.fn(),
      archive: vi.fn(),
      delete: vi.fn(),
      incrementViews: vi.fn().mockResolvedValue(undefined),
      recordFeedback: vi.fn().mockResolvedValue(undefined),
      getVersions: vi.fn(),
      getVersion: vi.fn(),
      linkTicket: vi.fn(),
      unlinkTicket: vi.fn(),
    };
    categoriesRepository = {
      findById: vi.fn(),
    };
    prisma = {
      auditEvent: {
        create: vi.fn().mockResolvedValue({ id: "aud-1" }),
      },
      outboxEvent: {
        create: vi.fn().mockResolvedValue({ id: "out-1" }),
      },
      ticket: {
        findFirst: vi.fn(),
      },
    };
    service = new KbArticlesService(
      repository as unknown as KbArticlesRepository,
      categoriesRepository as unknown as KbCategoriesRepository,
      prisma as unknown as PrismaService,
    );
  });

  describe("createArticle", () => {
    it("creates article draft and records audit event", async () => {
      categoriesRepository.findById.mockResolvedValue({ id: "cat-1" });
      repository.findBySlug.mockResolvedValue(null);
      repository.create.mockResolvedValue({
        id: "art-1",
        title: "SSO Guide",
        slug: "sso-guide",
        categoryId: "cat-1",
        visibility: KbArticleVisibility.PUBLIC,
      });

      const result = await service.createArticle("ten-1", "usr-1", {
        categoryId: "cat-1",
        title: "SSO Guide",
        content: "Markdown content",
      });

      expect(result.id).toBe("art-1");
      expect(prisma.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "kb.article.created",
            tenantId: "ten-1",
          }),
        }),
      );
    });

    it("throws if category is not found", async () => {
      categoriesRepository.findById.mockResolvedValue(null);

      await expect(
        service.createArticle("ten-1", "usr-1", {
          categoryId: "cat-1",
          title: "SSO Guide",
          content: "Content",
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("publishArticle", () => {
    it("publishes article, creates version snapshot, outbox event, and audit event", async () => {
      repository.findById.mockResolvedValue({ id: "art-1", title: "SSO Guide" });
      repository.publish.mockResolvedValue({
        id: "art-1",
        title: "SSO Guide",
        slug: "sso-guide",
        categoryId: "cat-1",
        versionNumber: 1,
        publishedAt: new Date(),
        authorId: "usr-1",
      });

      const published = await service.publishArticle("ten-1", "art-1", "usr-publisher");

      expect(published.id).toBe("art-1");
      expect(prisma.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: "kb.article.published",
            aggregateId: "art-1",
          }),
        }),
      );
      expect(prisma.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "kb.article.published",
            actorUserId: "usr-publisher",
          }),
        }),
      );
    });
  });
});
