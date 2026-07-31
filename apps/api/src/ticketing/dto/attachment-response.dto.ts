import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { VirusScanStatus } from "@prisma/client";

import type { AttachmentEntity } from "../domain/attachment.entity";

export class AttachmentResponseDto {
  @ApiProperty({
    description: "Unique system ID of the attachment",
    example: "a0000000-0000-0000-0000-000000000001",
    type: String,
  })
  id!: string;

  @ApiProperty({
    description: "Tenant ID owning the attachment",
    example: "b0000000-0000-0000-0000-000000000002",
    type: String,
  })
  tenantId!: string;

  @ApiProperty({
    description: "Ticket ID the attachment belongs to",
    example: "c0000000-0000-0000-0000-000000000003",
    type: String,
  })
  ticketId!: string;

  @ApiProperty({
    description: "Original client filename (metadata only)",
    example: "invoice.pdf",
    type: String,
  })
  originalFilename!: string;

  @ApiProperty({
    description: "UUID-based stored filename",
    example: "4d24d53d-62ef-4dc5-92fb-bc8a8d.pdf",
    type: String,
  })
  storedFilename!: string;

  @ApiProperty({
    description: "Detected MIME type",
    example: "application/pdf",
    type: String,
  })
  mimeType!: string;

  @ApiProperty({
    description: "Normalized file extension",
    example: "pdf",
    type: String,
  })
  extension!: string;

  @ApiProperty({
    description: "File size in bytes",
    example: 2048,
    type: Number,
  })
  fileSize!: number;

  @ApiProperty({
    description: "SHA-256 checksum of file content",
    example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    type: String,
  })
  sha256!: string;

  @ApiProperty({
    description: "User ID that uploaded the attachment",
    example: "d0000000-0000-0000-0000-000000000004",
    type: String,
  })
  uploadedBy!: string;

  @ApiProperty({
    description: "Virus scan status",
    enum: ["PENDING", "CLEAN", "INFECTED"],
    example: "CLEAN",
  })
  virusScanStatus!: VirusScanStatus;

  @ApiProperty({
    description: "Upload timestamp (UTC ISO-8601)",
    example: "2026-07-31T08:00:00.000Z",
    type: String,
  })
  createdAt!: string;

  static fromDomain(entity: AttachmentEntity): AttachmentResponseDto {
    const dto = new AttachmentResponseDto();
    dto.id = entity.id;
    dto.tenantId = entity.tenantId;
    dto.ticketId = entity.ticketId;
    dto.originalFilename = entity.originalFilename;
    dto.storedFilename = entity.storedFilename;
    dto.mimeType = entity.mimeType;
    dto.extension = entity.extension;
    dto.fileSize = entity.fileSize;
    dto.sha256 = entity.sha256;
    dto.uploadedBy = entity.uploadedBy;
    dto.virusScanStatus = entity.virusScanStatus;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class AttachmentListResponseDto {
  @ApiProperty({ type: () => [AttachmentResponseDto] })
  items!: AttachmentResponseDto[];
}

export class DeleteAttachmentRequestDto {
  @ApiPropertyOptional({
    description: "Optional deletion reason for audit metadata",
    example: "Uploaded by mistake",
    type: String,
  })
  reason?: string;
}
