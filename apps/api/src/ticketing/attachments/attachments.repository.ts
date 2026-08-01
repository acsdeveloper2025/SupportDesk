import { Inject, Injectable } from "@nestjs/common";
import { type Attachment as PrismaAttachment } from "@prisma/client";

import { type AuditEventInput, buildAuditEventData } from "../../audit/audit-event";
import { PrismaService } from "../../database/prisma.service";
import { AttachmentEntity } from "../domain/attachment.entity";

@Injectable()
export class AttachmentsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createWithAudit(
    entity: AttachmentEntity,
    audit: AuditEventInput,
  ): Promise<AttachmentEntity> {
    const props = entity.toProps();
    const created = await this.prisma.$transaction(async (tx) => {
      const attachment = await tx.attachment.create({
        data: {
          extension: props.extension,
          fileSize: props.fileSize,
          id: props.id,
          mimeType: props.mimeType,
          originalFilename: props.originalFilename,
          sha256: props.sha256,
          storagePath: props.storagePath,
          storedFilename: props.storedFilename,
          tenantId: props.tenantId,
          ticketId: props.ticketId,
          uploadedBy: props.uploadedBy,
          virusScanStatus: props.virusScanStatus,
        },
      });
      await tx.auditEvent.create({
        data: buildAuditEventData(audit),
      });
      return attachment;
    });

    return this.mapToDomain(created);
  }

  async findById(tenantId: string, id: string): Promise<AttachmentEntity | null> {
    const record = await this.prisma.attachment.findFirst({
      where: {
        deletedAt: null,
        id,
        tenantId,
      },
    });

    return record ? this.mapToDomain(record) : null;
  }

  async findActiveBySha256(
    tenantId: string,
    ticketId: string,
    sha256: string,
  ): Promise<AttachmentEntity | null> {
    const record = await this.prisma.attachment.findFirst({
      where: {
        deletedAt: null,
        sha256,
        tenantId,
        ticketId,
      },
    });

    return record ? this.mapToDomain(record) : null;
  }

  async listByTicket(tenantId: string, ticketId: string): Promise<AttachmentEntity[]> {
    const records = await this.prisma.attachment.findMany({
      orderBy: { createdAt: "desc" },
      where: {
        deletedAt: null,
        tenantId,
        ticketId,
      },
    });

    return records.map((record) => this.mapToDomain(record));
  }

  async softDeleteWithAudit(
    entity: AttachmentEntity,
    audit: AuditEventInput,
  ): Promise<AttachmentEntity> {
    const props = entity.toProps();
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.attachment.updateMany({
        data: {
          deletedAt: props.deletedAt,
          updatedAt: props.updatedAt,
        },
        where: {
          deletedAt: null,
          id: props.id,
          tenantId: props.tenantId,
        },
      });
      if (result.count === 0) {
        throw new Error("Attachment not found or already deleted");
      }
      await tx.auditEvent.create({
        data: buildAuditEventData(audit),
      });
    });

    return entity;
  }

  private mapToDomain(record: PrismaAttachment): AttachmentEntity {
    return new AttachmentEntity({
      createdAt: record.createdAt,
      deletedAt: record.deletedAt,
      extension: record.extension,
      fileSize: record.fileSize,
      id: record.id,
      mimeType: record.mimeType,
      originalFilename: record.originalFilename,
      sha256: record.sha256,
      storagePath: record.storagePath,
      storedFilename: record.storedFilename,
      tenantId: record.tenantId,
      ticketId: record.ticketId,
      updatedAt: record.updatedAt,
      uploadedBy: record.uploadedBy,
      virusScanStatus: record.virusScanStatus,
    });
  }
}
