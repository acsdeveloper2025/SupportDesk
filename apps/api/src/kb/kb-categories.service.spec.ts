/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../database/prisma.service";
import type { KbCategoriesRepository } from "./kb-categories.repository";
import { KbCategoriesService, slugify } from "./kb-categories.service";

describe("KbCategoriesService", () => {
  let service: KbCategoriesService;
  let repository: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findBySlug: ReturnType<typeof vi.fn>;
    listRootCategories: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let prisma: {
    auditEvent: {
      create: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    repository = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      listRootCategories: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    prisma = {
      auditEvent: {
        create: vi.fn().mockResolvedValue({ id: "aud-1" }),
      },
    };
    service = new KbCategoriesService(
      repository as unknown as KbCategoriesRepository,
      prisma as unknown as PrismaService,
    );
  });

  describe("slugify", () => {
    it("slugifies titles into clean kebab-case", () => {
      expect(slugify("Getting Started with SupportDesk!  ")).toBe(
        "getting-started-with-supportdesk",
      );
    });
  });

  describe("createCategory", () => {
    it("creates category and logs audit event", async () => {
      repository.findBySlug.mockResolvedValue(null);
      repository.create.mockResolvedValue({
        id: "cat-1",
        tenantId: "ten-1",
        name: "General",
        slug: "general",
        parentId: null,
      });

      const res = await service.createCategory("ten-1", { name: "General" }, "usr-1");

      expect(res.id).toBe("cat-1");
      expect(prisma.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "kb.category.created",
            tenantId: "ten-1",
          }),
        }),
      );
    });

    it("throws if slug already exists", async () => {
      repository.findBySlug.mockResolvedValue({ id: "existing" });

      await expect(
        service.createCategory("ten-1", { name: "General", slug: "general" }, "usr-1"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("deleteCategory", () => {
    it("prevents deletion if category has subcategories", async () => {
      repository.findById.mockResolvedValue({
        id: "cat-1",
        name: "Parent",
        children: [{ id: "cat-2" }],
      });

      await expect(service.deleteCategory("ten-1", "cat-1", "usr-1")).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
