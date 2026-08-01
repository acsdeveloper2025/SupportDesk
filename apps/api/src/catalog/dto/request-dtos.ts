import { BadRequestException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { TicketPriority } from "@prisma/client";

import { UUID_PATTERN } from "./category-dtos";

export class CreateServiceRequestDto {
  @ApiProperty({
    description: "Service ID to request",
    example: "11111111-1111-1111-1111-111111111111",
  })
  serviceId!: string;

  @ApiProperty({
    description: "Form answers keyed by field key",
    example: { software: "MS Office" },
  })
  answers!: Record<string, unknown>;

  @ApiPropertyOptional({
    description: "Request priority",
    enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
    default: "MEDIUM",
  })
  priority?: TicketPriority;

  @ApiPropertyOptional({
    description: "User ID the request is on behalf of (defaults to requester)",
  })
  requestedForUserId?: string | null;

  @ApiPropertyOptional({ description: "Initial note from the requester" })
  note?: string;

  @ApiPropertyOptional({ description: "Template ID to pre-fill answers from" })
  templateId?: string | null;
}

export class UpdateServiceRequestAnswersDto {
  @ApiProperty({ description: "Updated form answers keyed by field key" })
  answers!: Record<string, unknown>;

  @ApiPropertyOptional({ description: "Comment accompanying the update" })
  note?: string;
}

export class CancelServiceRequestDto {
  @ApiPropertyOptional({ description: "Reason for cancellation", maxLength: 500 })
  reason?: string;
}

export class DecideApprovalDto {
  @ApiProperty({
    description: "Decision",
    enum: ["APPROVED", "REJECTED", "CHANGES_REQUESTED"],
    example: "APPROVED",
  })
  decision!: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

  @ApiPropertyOptional({ description: "Comment supporting the decision", maxLength: 1000 })
  comment?: string;
}

export class CompleteServiceRequestDto {
  @ApiPropertyOptional({ description: "Fulfillment note" })
  note?: string;
}

export class ServiceRequestAttachmentResponseDto {
  @ApiProperty({ description: "Attachment ID" })
  id!: string;

  @ApiProperty({ description: "Stored file name" })
  fileName!: string;

  @ApiProperty({ description: "Original uploaded file name" })
  originalName!: string;

  @ApiProperty({ description: "MIME type" })
  mimeType!: string;

  @ApiProperty({ description: "File size in bytes" })
  sizeBytes!: string;

  @ApiProperty({ description: "Uploader user ID" })
  uploadedById!: string;

  @ApiProperty({ description: "Upload timestamp" })
  createdAt!: string;
}

export function validateCreateRequestPayload(body: CreateServiceRequestDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (typeof body.serviceId !== "string" || !UUID_PATTERN.test(body.serviceId)) {
    throw new BadRequestException("serviceId must be a valid UUID");
  }
  if (!body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) {
    throw new BadRequestException("answers must be an object");
  }
  if (
    body.requestedForUserId &&
    typeof body.requestedForUserId === "string" &&
    !UUID_PATTERN.test(body.requestedForUserId)
  ) {
    throw new BadRequestException("requestedForUserId must be a valid UUID");
  }
  if (
    body.templateId &&
    typeof body.templateId === "string" &&
    !UUID_PATTERN.test(body.templateId)
  ) {
    throw new BadRequestException("templateId must be a valid UUID");
  }
}

export function validateUpdateAnswersPayload(body: UpdateServiceRequestAnswersDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (!body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) {
    throw new BadRequestException("answers must be an object");
  }
}

export function validateCancelPayload(body: CancelServiceRequestDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (body.reason !== undefined && (typeof body.reason !== "string" || body.reason.length > 500)) {
    throw new BadRequestException("reason must be a string of at most 500 characters");
  }
}

export function validateDecideApprovalPayload(body: DecideApprovalDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (
    body.decision !== "APPROVED" &&
    body.decision !== "REJECTED" &&
    body.decision !== "CHANGES_REQUESTED"
  ) {
    throw new BadRequestException("decision must be APPROVED, REJECTED, or CHANGES_REQUESTED");
  }
  if (
    body.comment !== undefined &&
    (typeof body.comment !== "string" || body.comment.length > 1000)
  ) {
    throw new BadRequestException("comment must be a string of at most 1000 characters");
  }
}

export function validateCompletePayload(body: CompleteServiceRequestDto | undefined): void {
  if (body === undefined) {
    return;
  }
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (body.note !== undefined && typeof body.note !== "string") {
    throw new BadRequestException("note must be a string");
  }
}
