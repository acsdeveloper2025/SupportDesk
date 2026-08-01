import { BadRequestException } from "@nestjs/common";
import type { VirusScanStatus } from "@prisma/client";

export interface AttachmentProps {
  id: string;
  tenantId: string;
  ticketId: string;
  originalFilename: string;
  storedFilename: string;
  storagePath: string;
  mimeType: string;
  extension: string;
  fileSize: number;
  sha256: string;
  uploadedBy: string;
  virusScanStatus: VirusScanStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export class AttachmentEntity {
  private props: AttachmentProps;

  constructor(props: AttachmentProps) {
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get ticketId(): string {
    return this.props.ticketId;
  }
  get originalFilename(): string {
    return this.props.originalFilename;
  }
  get storedFilename(): string {
    return this.props.storedFilename;
  }
  get storagePath(): string {
    return this.props.storagePath;
  }
  get mimeType(): string {
    return this.props.mimeType;
  }
  get extension(): string {
    return this.props.extension;
  }
  get fileSize(): number {
    return this.props.fileSize;
  }
  get sha256(): string {
    return this.props.sha256;
  }
  get uploadedBy(): string {
    return this.props.uploadedBy;
  }
  get virusScanStatus(): VirusScanStatus {
    return this.props.virusScanStatus;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get deletedAt(): Date | null | undefined {
    return this.props.deletedAt;
  }

  markClean(): void {
    this.props.virusScanStatus = "CLEAN";
    this.props.updatedAt = new Date();
  }

  markInfected(): void {
    this.props.virusScanStatus = "INFECTED";
    this.props.updatedAt = new Date();
  }

  softDelete(): void {
    if (this.props.deletedAt) {
      throw new BadRequestException("Attachment is already deleted");
    }
    this.props.deletedAt = new Date();
    this.props.updatedAt = new Date();
  }

  toProps(): AttachmentProps {
    return { ...this.props };
  }
}
