import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { VirusScanStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RbacService } from "../../rbac/rbac.service";
import { AttachmentEntity } from "../domain/attachment.entity";
import { TicketAggregate } from "../domain/ticket.aggregate";
import type { TicketsRepository } from "../tickets.repository";
import type { AttachmentsRepository } from "./attachments.repository";
import { AttachmentsService } from "./attachments.service";
import type { LocalAttachmentStorage } from "./local-attachment-storage";
import type { VirusScanner } from "./virus-scanner";

describe("AttachmentsService", () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const ticketId = "22222222-2222-4222-8222-222222222222";
  const userId = "33333333-3333-4333-8333-333333333333";

  let attachmentsRepository: Record<string, ReturnType<typeof vi.fn>>;
  let ticketsRepository: Record<string, ReturnType<typeof vi.fn>>;
  let storage: Record<string, ReturnType<typeof vi.fn>>;
  let virusScanner: Record<string, ReturnType<typeof vi.fn>>;
  let rbacService: Record<string, ReturnType<typeof vi.fn>>;
  let service: AttachmentsService;

  const ticket = TicketAggregate.create({
    description: "Desc",
    id: ticketId,
    publicRef: "TKT-1001",
    requesterUserId: userId,
    tenantId,
    title: "Title",
  });

  beforeEach(() => {
    attachmentsRepository = {
      createWithAudit: vi.fn((entity: AttachmentEntity) => Promise.resolve(entity)),
      findActiveBySha256: vi.fn().mockResolvedValue(null),
      findById: vi.fn(),
      listByTicket: vi.fn().mockResolvedValue([]),
      softDeleteWithAudit: vi.fn((entity: AttachmentEntity) => Promise.resolve(entity)),
    };
    ticketsRepository = {
      findById: vi.fn().mockResolvedValue(ticket),
    };
    storage = {
      deleteFile: vi.fn().mockResolvedValue(undefined),
      openReadStream: vi.fn(),
      writeFile: vi.fn().mockResolvedValue({
        absolutePath: "/tmp/file.pdf",
        relativePath: "tenant-x/ticket-y/file.pdf",
        sha256: "abc123",
        storedFilename: "4d24d53d-62ef-4dc5-92fb-bc8a8d.pdf",
      }),
    };
    virusScanner = {
      scan: vi.fn().mockResolvedValue("clean"),
    };
    rbacService = {
      can: vi.fn().mockResolvedValue(true),
    };

    service = new AttachmentsService(
      attachmentsRepository as unknown as AttachmentsRepository,
      ticketsRepository as unknown as TicketsRepository,
      storage as unknown as LocalAttachmentStorage,
      virusScanner as unknown as VirusScanner,
      rbacService as unknown as RbacService,
    );
  });

  it("uploads a valid attachment", async () => {
    const buffer = Buffer.from("%PDF-1.4 test");
    const created = await service.upload({
      actorUserId: userId,
      buffer,
      mimeType: "application/pdf",
      originalFilename: "invoice.pdf",
      size: buffer.length,
      tenantId,
      ticketId,
    });

    expect(created.originalFilename).toBe("invoice.pdf");
    expect(created.virusScanStatus).toBe(VirusScanStatus.CLEAN);
    expect(attachmentsRepository.createWithAudit).toHaveBeenCalled();
  });

  it("rejects missing permission", async () => {
    rbacService.can!.mockResolvedValue(false);
    const buffer = Buffer.from("x");

    await expect(
      service.upload({
        actorUserId: userId,
        buffer,
        mimeType: "application/pdf",
        originalFilename: "invoice.pdf",
        size: buffer.length,
        tenantId,
        ticketId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects invalid MIME types", async () => {
    const buffer = Buffer.from("MZ");
    await expect(
      service.upload({
        actorUserId: userId,
        buffer,
        mimeType: "application/x-msdownload",
        originalFilename: "malware.exe",
        size: buffer.length,
        tenantId,
        ticketId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects oversized files", async () => {
    const buffer = Buffer.alloc(11 * 1024 * 1024);
    await expect(
      service.upload({
        actorUserId: userId,
        buffer,
        mimeType: "application/pdf",
        originalFilename: "big.pdf",
        size: buffer.length,
        tenantId,
        ticketId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects duplicate content", async () => {
    attachmentsRepository.findActiveBySha256!.mockResolvedValue(
      new AttachmentEntity({
        createdAt: new Date(),
        extension: "pdf",
        fileSize: 1,
        id: "att-1",
        mimeType: "application/pdf",
        originalFilename: "a.pdf",
        sha256: "abc123",
        storagePath: "x",
        storedFilename: "x.pdf",
        tenantId,
        ticketId,
        updatedAt: new Date(),
        uploadedBy: userId,
        virusScanStatus: VirusScanStatus.CLEAN,
      }),
    );

    const buffer = Buffer.from("%PDF");
    await expect(
      service.upload({
        actorUserId: userId,
        buffer,
        mimeType: "application/pdf",
        originalFilename: "invoice.pdf",
        size: buffer.length,
        tenantId,
        ticketId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(storage.deleteFile).toHaveBeenCalled();
  });

  it("soft-deletes an attachment", async () => {
    attachmentsRepository.findById!.mockResolvedValue(
      new AttachmentEntity({
        createdAt: new Date(),
        extension: "pdf",
        fileSize: 1,
        id: "att-1",
        mimeType: "application/pdf",
        originalFilename: "a.pdf",
        sha256: "abc123",
        storagePath: "x",
        storedFilename: "x.pdf",
        tenantId,
        ticketId,
        updatedAt: new Date(),
        uploadedBy: userId,
        virusScanStatus: VirusScanStatus.CLEAN,
      }),
    );

    await service.softDelete(tenantId, "att-1", userId, "mistake");
    expect(attachmentsRepository.softDeleteWithAudit).toHaveBeenCalled();
  });
});
