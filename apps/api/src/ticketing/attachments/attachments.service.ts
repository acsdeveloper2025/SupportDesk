import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { VirusScanStatus } from "@prisma/client";

import { RbacService } from "../../rbac/rbac.service";
import { AttachmentEntity } from "../domain/attachment.entity";
import { TicketsRepository } from "../tickets.repository";
import {
  ATTACHMENT_ALLOWED_EXTENSIONS,
  ATTACHMENT_ALLOWED_MIME_TYPES,
  ATTACHMENT_MAX_FILE_SIZE_BYTES,
  extractExtension,
  sanitizeOriginalFilename,
} from "./attachment-validation";
import { AttachmentsRepository } from "./attachments.repository";
import { LocalAttachmentStorage } from "./local-attachment-storage";
import { VIRUS_SCANNER, type VirusScanner } from "./virus-scanner";

export interface UploadAttachmentInput {
  tenantId: string;
  ticketId: string;
  actorUserId: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AttachmentsService {
  constructor(
    @Inject(AttachmentsRepository) private readonly attachmentsRepository: AttachmentsRepository,
    @Inject(TicketsRepository) private readonly ticketsRepository: TicketsRepository,
    @Inject(LocalAttachmentStorage) private readonly storage: LocalAttachmentStorage,
    @Inject(VIRUS_SCANNER) private readonly virusScanner: VirusScanner,
    @Inject(RbacService) private readonly rbacService: RbacService,
  ) {}

  async upload(input: UploadAttachmentInput): Promise<AttachmentEntity> {
    await this.assertPermission(input.tenantId, input.actorUserId, "ticket.attachment.create");

    const ticket = await this.ticketsRepository.findById(input.tenantId, input.ticketId);
    if (!ticket) {
      throw new NotFoundException("Ticket not found");
    }

    const canScoped = await this.rbacService.can({
      permissionKey: "ticket.attachment.create",
      resource: {
        assigneeUserId: ticket.assigneeUserId,
        groupId: ticket.assignedGroupId,
        ownerUserId: ticket.requesterUserId,
      },
      tenantId: input.tenantId,
      userId: input.actorUserId,
    });
    if (!canScoped) {
      throw new ForbiddenException("Lacks required ticket.attachment.create permission");
    }

    this.validateUpload(input);

    const extension = extractExtension(input.originalFilename);
    const stored = await this.storage.writeFile({
      extension,
      source: input.buffer,
      tenantId: input.tenantId,
      ticketId: input.ticketId,
    });

    const scanResult = await this.virusScanner.scan(stored.absolutePath);
    if (scanResult === "infected") {
      await this.storage.deleteFile(stored.absolutePath);
      throw new UnprocessableEntityException({
        code: "ATTACHMENT_NOT_CLEAN",
        message: "Attachment failed virus scan",
      });
    }

    const duplicate = await this.attachmentsRepository.findActiveBySha256(
      input.tenantId,
      input.ticketId,
      stored.sha256,
    );
    if (duplicate) {
      await this.storage.deleteFile(stored.absolutePath);
      throw new ConflictException("Duplicate attachment content for this ticket");
    }

    const now = new Date();
    const entity = new AttachmentEntity({
      createdAt: now,
      extension,
      fileSize: input.size,
      id: randomUUID(),
      mimeType: input.mimeType,
      originalFilename: sanitizeOriginalFilename(input.originalFilename),
      sha256: stored.sha256,
      storagePath: stored.relativePath,
      storedFilename: stored.storedFilename,
      tenantId: input.tenantId,
      ticketId: input.ticketId,
      updatedAt: now,
      uploadedBy: input.actorUserId,
      virusScanStatus: VirusScanStatus.CLEAN,
    });

    try {
      return await this.attachmentsRepository.createWithAudit(entity, {
        action: "attachment.uploaded",
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        ipAddress: input.ipAddress,
        metadata: {
          extension,
          fileSize: input.size,
          mimeType: input.mimeType,
          originalFilename: entity.originalFilename,
          sha256: stored.sha256,
          ticketId: input.ticketId,
          virusScanStatus: VirusScanStatus.CLEAN,
        },
        outcome: "SUCCESS",
        targetId: entity.id,
        targetType: "attachment",
        tenantId: input.tenantId,
        userAgent: input.userAgent,
      });
    } catch (error) {
      await this.storage.deleteFile(stored.absolutePath);
      throw error;
    }
  }

  async list(tenantId: string, ticketId: string, actorUserId: string): Promise<AttachmentEntity[]> {
    await this.assertPermission(tenantId, actorUserId, "ticket.attachment.read");

    const ticket = await this.ticketsRepository.findById(tenantId, ticketId);
    if (!ticket) {
      throw new NotFoundException("Ticket not found");
    }

    const canScoped = await this.rbacService.can({
      permissionKey: "ticket.attachment.read",
      resource: {
        assigneeUserId: ticket.assigneeUserId,
        groupId: ticket.assignedGroupId,
        ownerUserId: ticket.requesterUserId,
      },
      tenantId,
      userId: actorUserId,
    });
    if (!canScoped) {
      throw new ForbiddenException("Lacks required ticket.attachment.read permission");
    }

    return this.attachmentsRepository.listByTicket(tenantId, ticketId);
  }

  async getDownload(
    tenantId: string,
    attachmentId: string,
    actorUserId: string,
  ): Promise<{ entity: AttachmentEntity; stream: Readable }> {
    await this.assertPermission(tenantId, actorUserId, "ticket.attachment.read");

    const entity = await this.attachmentsRepository.findById(tenantId, attachmentId);
    if (!entity) {
      throw new NotFoundException("Attachment not found");
    }

    const ticket = await this.ticketsRepository.findById(tenantId, entity.ticketId);
    if (!ticket) {
      throw new NotFoundException("Attachment not found");
    }

    const canScoped = await this.rbacService.can({
      permissionKey: "ticket.attachment.read",
      resource: {
        assigneeUserId: ticket.assigneeUserId,
        groupId: ticket.assignedGroupId,
        ownerUserId: ticket.requesterUserId,
      },
      tenantId,
      userId: actorUserId,
    });
    if (!canScoped) {
      throw new ForbiddenException("Lacks required ticket.attachment.read permission");
    }

    if (entity.virusScanStatus !== VirusScanStatus.CLEAN) {
      throw new UnprocessableEntityException({
        code: "ATTACHMENT_NOT_CLEAN",
        message: "Attachment is not available for download",
      });
    }

    const stream = this.storage.openReadStream(entity.storagePath);
    return { entity, stream };
  }

  async softDelete(
    tenantId: string,
    attachmentId: string,
    actorUserId: string,
    reason?: string,
  ): Promise<void> {
    await this.assertPermission(tenantId, actorUserId, "ticket.attachment.delete");

    const entity = await this.attachmentsRepository.findById(tenantId, attachmentId);
    if (!entity) {
      throw new NotFoundException("Attachment not found");
    }

    const ticket = await this.ticketsRepository.findById(tenantId, entity.ticketId);
    if (!ticket) {
      throw new NotFoundException("Attachment not found");
    }

    const canScoped = await this.rbacService.can({
      permissionKey: "ticket.attachment.delete",
      resource: {
        assigneeUserId: ticket.assigneeUserId,
        groupId: ticket.assignedGroupId,
        ownerUserId: ticket.requesterUserId,
      },
      tenantId,
      userId: actorUserId,
    });
    if (!canScoped) {
      throw new ForbiddenException("Lacks required ticket.attachment.delete permission");
    }

    entity.softDelete();
    await this.attachmentsRepository.softDeleteWithAudit(entity, {
      action: "attachment.deleted",
      actorUserId,
      metadata: {
        reason: reason ?? "user_requested",
        ticketId: entity.ticketId,
      },
      outcome: "SUCCESS",
      targetId: entity.id,
      targetType: "attachment",
      tenantId,
    });
  }

  private async assertPermission(
    tenantId: string,
    userId: string,
    permissionKey: string,
  ): Promise<void> {
    const allowed = await this.rbacService.can({
      permissionKey,
      tenantId,
      userId,
    });
    if (!allowed) {
      throw new ForbiddenException(`Lacks required ${permissionKey} permission`);
    }
  }

  private validateUpload(input: UploadAttachmentInput): void {
    if (!input.buffer || input.size <= 0 || input.buffer.length === 0) {
      throw new BadRequestException("Empty uploads are not allowed");
    }

    if (
      input.size > ATTACHMENT_MAX_FILE_SIZE_BYTES ||
      input.buffer.length > ATTACHMENT_MAX_FILE_SIZE_BYTES
    ) {
      throw new BadRequestException(
        `File exceeds maximum size of ${ATTACHMENT_MAX_FILE_SIZE_BYTES} bytes`,
      );
    }

    if (input.size !== input.buffer.length) {
      throw new BadRequestException("Declared file size does not match upload content");
    }

    const extension = extractExtension(input.originalFilename);
    if (!extension || !ATTACHMENT_ALLOWED_EXTENSIONS.has(extension)) {
      throw new BadRequestException("File extension is not allowed");
    }

    if (!ATTACHMENT_ALLOWED_MIME_TYPES.has(input.mimeType)) {
      throw new BadRequestException("MIME type is not allowed");
    }
  }
}
