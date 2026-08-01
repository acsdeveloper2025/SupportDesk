/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../database/prisma.service";
import type { CatalogCategoriesRepository } from "./catalog-categories.repository";
import { CatalogCategoriesService, slugify } from "./catalog-categories.service";

describe("CatalogCategoriesService", () => {
  let service: CatalogCategoriesService;
  let repository: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findBySlug: ReturnType<typeof vi.fn>;
    listRootCategories: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
    slugExists: ReturnType<typeof vi.fn>;
    listDescendantIds: ReturnType<typeof vi.fn>;
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
      list: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      slugExists: vi.fn(),
      listDescendantIds: vi.fn(),
    };
    prisma = {
      auditEvent: {
        create: vi.fn().mockResolvedValue({ id: "aud-1" }),
      },
    };
    service = new CatalogCategoriesService(
      repository as unknown as CatalogCategoriesRepository,
      prisma as unknown as PrismaService,
    );
  });

  describe("slugify", () => {
    it("slugifies names into clean kebab-case", () => {
      expect(slugify("Software & Applications!  ")).toBe("software-applications");
    });
  });

  describe("createCategory", () => {
    it("creates a category and logs an audit event", async () => {
      repository.slugExists.mockResolvedValue(false);
      repository.findById.mockResolvedValue(null);
      repository.create.mockResolvedValue({
        id: "cat-1",
        tenantId: "ten-1",
        name: "Software",
        slug: "software",
        parentId: null,
      });

      const res = await service.createCategory("ten-1", { name: "Software" }, "usr-1");

      expect(res.id).toBe("cat-1");
      expect(prisma.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "catalog.category.created",
            tenantId: "ten-1",
          }),
        }),
      );
    });

    it("throws on duplicate slug", async () => {
      repository.slugExists.mockResolvedValue(true);

      await expect(service.createCategory("ten-1", { name: "Software" }, "usr-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws when the parent category is missing", async () => {
      repository.slugExists.mockResolvedValue(false);
      repository.findById.mockResolvedValue(null);

      await expect(
        service.createCategory("ten-1", { name: "Child", parentId: "parent-1" }, "usr-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getCategory", () => {
    it("looks up by id when given a UUID", async () => {
      repository.findById.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });

      const res = await service.getCategory("ten-1", "11111111-1111-4111-8111-111111111111");

      expect(res.id).toBe("11111111-1111-4111-8111-111111111111");
      expect(repository.findBySlug).not.toHaveBeenCalled();
    });

    it("looks up by slug otherwise", async () => {
      repository.findBySlug.mockResolvedValue({ id: "cat-1" });

      await service.getCategory("ten-1", "software");

      expect(repository.findBySlug).toHaveBeenCalledWith("ten-1", "software");
    });

    it("throws when not found", async () => {
      repository.findBySlug.mockResolvedValue(null);

      await expect(service.getCategory("ten-1", "nope")).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateCategory", () => {
    it("rejects moving a category under itself", async () => {
      repository.findById.mockResolvedValue({ id: "cat-1", name: "Old", slug: "old" });

      await expect(
        service.updateCategory("ten-1", "cat-1", { parentId: "cat-1" }, "usr-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects moving a category under its own descendant", async () => {
      repository.findById.mockResolvedValue({ id: "cat-1", name: "Old", slug: "old" });
      repository.listDescendantIds.mockResolvedValue(["child-1"]);

      await expect(
        service.updateCategory("ten-1", "cat-1", { parentId: "child-1" }, "usr-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("updates and logs an audit event", async () => {
      repository.findById.mockResolvedValue({ id: "cat-1", name: "Old", slug: "old" });
      repository.update.mockResolvedValue({
        id: "cat-1",
        name: "New",
        slug: "new",
        parentId: null,
      });

      const res = await service.updateCategory("ten-1", "cat-1", { name: "New" }, "usr-1");

      expect(res.name).toBe("New");
      expect(prisma.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "catalog.category.updated" }),
        }),
      );
    });
  });

  describe("deleteCategory", () => {
    it("rejects deletion with children", async () => {
      repository.findById.mockResolvedValue({ id: "cat-1", children: [{ id: "child-1" }] });

      await expect(service.deleteCategory("ten-1", "cat-1", "usr-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects deletion with services", async () => {
      repository.findById.mockResolvedValue({
        id: "cat-1",
        children: [],
        _count: { serviceItems: 2 },
      });

      await expect(service.deleteCategory("ten-1", "cat-1", "usr-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("soft-deletes and logs an audit event", async () => {
      repository.findById.mockResolvedValue({
        id: "cat-1",
        children: [],
        _count: { serviceItems: 0 },
      });
      repository.softDelete.mockResolvedValue({ id: "cat-1" });

      const res = await service.deleteCategory("ten-1", "cat-1", "usr-1");

      expect(repository.softDelete).toHaveBeenCalledWith("ten-1", "cat-1");
      expect(prisma.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "catalog.category.deleted" }),
        }),
      );
      expect(res.id).toBe("cat-1");
    });
  });
});
