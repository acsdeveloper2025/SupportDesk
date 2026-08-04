import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { AssetAttachment } from "@prisma/client";

export type AssetAttachmentView = Omit<AssetAttachment, "sizeBytes"> & {
  sizeBytes: string;
};

import { PrismaService } from "../database/prisma.service";
import {
  ATTACHMENT_ALLOWED_EXTENSIONS,
  ATTACHMENT_ALLOWED_MIME_TYPES,
  ATTACHMENT_MAX_FILE_SIZE_BYTES,
  extractExtension,
  sanitizeOriginalFilename,
} from "../ticketing/attachments/attachment-validation";
import { LocalAttachmentStorage } from "../ticketing/attachments/local-attachment-storage";
import { VIRUS_SCANNER, type VirusScanner } from "../ticketing/attachments/virus-scanner";
import { AssetsRepository } from "./assets.repository";
import { ASSET_ATTACHMENT_KIND_VALUES } from "./dto/asset-dtos";

export const ASSET_ATTACHMENT_MAX_FILES = 20;

export interface AssetAttachmentInput {
  tenantId: string;
  assetId: string;
  actorUserId: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
  kind: (typeof ASSET_ATTACHMENT_KIND_VALUES)[number];
  correlationId?: string;
}

@Injectable()
export class AssetAttachmentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AssetsRepository) private readonly assetsRepository: AssetsRepository,
    @Inject(LocalAttachmentStorage) private readonly storage: LocalAttachmentStorage,
    @Inject(VIRUS_SCANNER) private readonly virusScanner: VirusScanner,
  ) {}

  private validateUpload(input: AssetAttachmentInput): string {
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
    if (!ASSET_ATTACHMENT_KIND_VALUES.includes(input.kind)) {
      throw new BadRequestException("Attachment kind is not allowed");
    }
    return extension;
  }

  async upload(input: AssetAttachmentInput): Promise<AssetAttachmentView> {
    const extension = this.validateUpload(input);

    const asset = await this.assetsRepository.findOne(input.tenantId, input.assetId);
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }

    const existing = await this.prisma.assetAttachment.count({
      where: { tenantId: input.tenantId, assetId: input.assetId },
    });
    if (existing >= ASSET_ATTACHMENT_MAX_FILES) {
      throw new BadRequestException(
        `Assets allow at most ${ASSET_ATTACHMENT_MAX_FILES} attachments`,
      );
    }

    const stored = await this.storage.writeFileForAsset({
      extension,
      source: input.buffer,
      tenantId: input.tenantId,
      assetId: input.assetId,
    });

    const scanResult = await this.virusScanner.scan(stored.absolutePath);
    if (scanResult === "infected") {
      await this.storage.deleteFile(stored.absolutePath);
      throw new UnprocessableEntityException({
        code: "ATTACHMENT_NOT_CLEAN",
        message: "Attachment failed virus scan",
      });
    }

    const attachmentId = randomUUID();
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.assetAttachment.create({
          data: {
            id: attachmentId,
            tenantId: input.tenantId,
            assetId: input.assetId,
            kind: input.kind,
            fileName: stored.storedFilename,
            originalName: sanitizeOriginalFilename(input.originalFilename),
            mimeType: input.mimeType,
            sizeBytes: BigInt(input.size),
            storagePath: stored.relativePath,
            uploadedById: input.actorUserId,
          },
        });

        await tx.assetHistory.create({
          data: {
            tenantId: input.tenantId,
            assetId: input.assetId,
            action: "asset.attachment_uploaded",
            fromState: null,
            toState: null,
            actorUserId: input.actorUserId,
            comment: null,
            metadata: {
              attachmentId,
              originalName: sanitizeOriginalFilename(input.originalFilename),
              kind: input.kind,
              sizeBytes: input.size,
            },
          },
        });

        await tx.auditEvent.create({
          data: {
            action: "asset.attachment.uploaded",
            actorUserId: input.actorUserId,
            correlationId: input.correlationId,
            outcome: "SUCCESS",
            targetId: attachmentId,
            targetType: "asset_attachment",
            tenantId: input.tenantId,
            metadata: {
              assetId: input.assetId,
              assetRef: asset.assetRef,
              fileName: sanitizeOriginalFilename(input.originalFilename),
              kind: input.kind,
              sizeBytes: input.size,
              scanResult,
            },
          },
        });
      });
    } catch (error) {
      await this.storage.deleteFile(stored.absolutePath);
      throw error;
    }

    const attachment = await this.prisma.assetAttachment.findFirstOrThrow({
      where: { tenantId: input.tenantId, id: attachmentId },
    });
    return { ...attachment, sizeBytes: attachment.sizeBytes.toString() };
  }

  async list(tenantId: string, assetId: string): Promise<AssetAttachmentView[]> {
    const asset = await this.assetsRepository.findOne(tenantId, assetId);
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }
    const attachments = await this.prisma.assetAttachment.findMany({
      where: { tenantId, assetId },
      orderBy: { createdAt: "desc" },
    });
    return attachments.map((attachment) => ({
      ...attachment,
      sizeBytes: attachment.sizeBytes.toString(),
    }));
  }

  async getDownload(
    tenantId: string,
    attachmentId: string,
  ): Promise<{ attachment: AssetAttachment; stream: Readable }> {
    const attachment = await this.prisma.assetAttachment.findFirst({
      where: { tenantId, id: attachmentId },
    });
    if (!attachment) {
      throw new NotFoundException("Attachment not found");
    }
    const stream = this.storage.openReadStream(attachment.storagePath);
    return { attachment, stream };
  }

  async softDelete(tenantId: string, attachmentId: string, actorUserId: string): Promise<void> {
    const attachment = await this.prisma.assetAttachment.findFirst({
      where: { tenantId, id: attachmentId },
    });
    if (!attachment) {
      throw new NotFoundException("Attachment not found");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.assetAttachment.delete({ where: { id: attachmentId } });
      await tx.assetHistory.create({
        data: {
          tenantId,
          assetId: attachment.assetId,
          action: "asset.attachment_deleted",
          fromState: null,
          toState: null,
          actorUserId,
          comment: null,
          metadata: {
            attachmentId,
            originalName: attachment.originalName,
          },
        },
      });
      await tx.auditEvent.create({
        data: {
          action: "asset.attachment.deleted",
          actorUserId,
          outcome: "SUCCESS",
          targetId: attachmentId,
          targetType: "asset_attachment",
          tenantId,
          metadata: {
            assetId: attachment.assetId,
            originalName: attachment.originalName,
          },
        },
      });
    });
    await this.storage.deleteFile(attachment.storagePath);
  }
}
