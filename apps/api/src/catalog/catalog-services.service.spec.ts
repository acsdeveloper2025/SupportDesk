/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../database/prisma.service";
import type { KbArticlesRepository } from "../kb/kb-articles.repository";
import type { CatalogCategoriesRepository } from "./catalog-categories.repository";
import type { CatalogServicesRepository } from "./catalog-services.repository";
import { CatalogServicesService } from "./catalog-services.service";

describe("CatalogServicesService", () => {
  let service: CatalogServicesService;
  let repository: {
    createWithForm: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findBySlug: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    listPublished: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
    slugExists: ReturnType<typeof vi.fn>;
    countRequests: ReturnType<typeof vi.fn>;
    findForm: ReturnType<typeof vi.fn>;
    replaceForm: ReturnType<typeof vi.fn>;
  };
  let categoriesRepository: {
    findById: ReturnType<typeof vi.fn>;
  };
  let kbArticlesRepository: {
    searchForSuggestions: ReturnType<typeof vi.fn>;
  };
  let prisma: {
    auditEvent: {
      create: ReturnType<typeof vi.fn>;
    };
    slaPolicy: {
      findFirst: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    repository = {
      createWithForm: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      list: vi.fn(),
      listPublished: vi.fn(),
      update: vi.fn(),
      publish: vi.fn(),
      softDelete: vi.fn(),
      slugExists: vi.fn(),
      countRequests: vi.fn(),
      findForm: vi.fn(),
      replaceForm: vi.fn(),
    };
    categoriesRepository = { findById: vi.fn() };
    kbArticlesRepository = { searchForSuggestions: vi.fn() };
    prisma = {
      auditEvent: { create: vi.fn().mockResolvedValue({ id: "aud-1" }) },
      slaPolicy: { findFirst: vi.fn() },
    };
    service = new CatalogServicesService(
      repository as unknown as CatalogServicesRepository,
      categoriesRepository as unknown as CatalogCategoriesRepository,
      kbArticlesRepository as unknown as KbArticlesRepository,
      prisma as unknown as PrismaService,
    );
  });

  describe("createService", () => {
    it("creates a service with a default form when none is provided", async () => {
      repository.slugExists.mockResolvedValue(false);
      categoriesRepository.findById.mockResolvedValue({ id: "cat-1" });
      repository.createWithForm.mockImplementation(
        (_t: string, dto: { name: string }, slug: string, formSchema: unknown) => ({
          id: "svc-1",
          name: dto.name,
          slug,
          kind: "BUSINESS",
          approvalMode: "NONE",
          form: formSchema,
        }),
      );

      const res = await service.createService(
        "ten-1",
        { categoryId: "cat-1", name: "Software Request" },
        "usr-1",
      );

      expect(res.slug).toBe("software-request");
      expect(res.form).toBeDefined();
      expect(repository.createWithForm).toHaveBeenCalledWith(
        "ten-1",
        expect.anything(),
        "software-request",
        expect.objectContaining({ fields: expect.any(Array) }),
      );
      expect(prisma.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "catalog.service.created" }),
        }),
      );
    });

    it("throws when the category is missing", async () => {
      repository.slugExists.mockResolvedValue(false);
      categoriesRepository.findById.mockResolvedValue(null);

      await expect(
        service.createService("ten-1", { categoryId: "cat-9", name: "X" }, "usr-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws when the SLA policy is missing", async () => {
      repository.slugExists.mockResolvedValue(false);
      categoriesRepository.findById.mockResolvedValue({ id: "cat-1" });
      prisma.slaPolicy.findFirst.mockResolvedValue(null);

      await expect(
        service.createService(
          "ten-1",
          { categoryId: "cat-1", name: "X", slaPolicyId: "sla-1" },
          "usr-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getService", () => {
    it("finds by id for UUIDs and by slug otherwise", async () => {
      repository.findById.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
      await service.getService("ten-1", "11111111-1111-4111-8111-111111111111");
      expect(repository.findBySlug).not.toHaveBeenCalled();

      repository.findBySlug.mockResolvedValue({ id: "svc-1" });
      await service.getService("ten-1", "software-request");
      expect(repository.findBySlug).toHaveBeenCalledWith("ten-1", "software-request");
    });

    it("throws when not found", async () => {
      repository.findBySlug.mockResolvedValue(null);
      await expect(service.getService("ten-1", "nope")).rejects.toThrow(NotFoundException);
    });
  });

  describe("publishService", () => {
    it("requires a form before publishing", async () => {
      repository.findById.mockResolvedValue({ id: "svc-1", state: "DRAFT", form: null });

      await expect(
        service.publishService("ten-1", "svc-1", "usr-1", undefined, "PUBLISHED"),
      ).rejects.toThrow(BadRequestException);
    });

    it("publishes a service with a form and logs an audit event", async () => {
      repository.findById.mockResolvedValue({ id: "svc-1", state: "DRAFT", form: { id: "f-1" } });
      repository.publish.mockResolvedValue({ id: "svc-1", state: "PUBLISHED" });

      const res = await service.publishService("ten-1", "svc-1", "usr-1", undefined, "PUBLISHED");

      expect(res.state).toBe("PUBLISHED");
      expect(prisma.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "catalog.service.published" }),
        }),
      );
    });

    it("rejects already-published services", async () => {
      repository.findById.mockResolvedValue({
        id: "svc-1",
        state: "PUBLISHED",
        form: { id: "f-1" },
      });

      await expect(
        service.publishService("ten-1", "svc-1", "usr-1", undefined, "PUBLISHED"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("deleteService", () => {
    it("rejects deletion of services with requests", async () => {
      repository.findById.mockResolvedValue({ id: "svc-1" });
      repository.countRequests.mockResolvedValue(1);

      await expect(service.deleteService("ten-1", "svc-1", "usr-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("soft-deletes and logs an audit event", async () => {
      repository.findById.mockResolvedValue({ id: "svc-1" });
      repository.countRequests.mockResolvedValue(0);
      repository.softDelete.mockResolvedValue({ id: "svc-1" });

      await service.deleteService("ten-1", "svc-1", "usr-1");

      expect(repository.softDelete).toHaveBeenCalledWith("ten-1", "svc-1");
      expect(prisma.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "catalog.service.deleted" }),
        }),
      );
    });
  });

  describe("suggestions", () => {
    it("searches KB articles by service tags and name", async () => {
      repository.findById.mockResolvedValue({
        id: "svc-1",
        name: "VPN Access",
        suggestedKbTags: ["vpn", "security"],
      });
      kbArticlesRepository.searchForSuggestions.mockResolvedValue([
        {
          id: "a-1",
          title: "How to use VPN",
          slug: "how-to-use-vpn",
          summary: "Guide",
          category: { id: "c-1", name: "Network", slug: "network" },
          articleTags: [{ tag: { name: "vpn" } }],
        },
      ]);

      const res = await service.suggestions("ten-1", "svc-1", false, 5);

      expect(res).toHaveLength(1);
      expect(res[0]?.tags).toContain("vpn");
      expect(kbArticlesRepository.searchForSuggestions).toHaveBeenCalledWith(
        "ten-1",
        ["vpn", "security"],
        ["VPN Access", "vpn", "security"],
        false,
        5,
      );
    });
  });
});
