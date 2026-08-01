import { BadRequestException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { UUID_PATTERN } from "./category-dtos";

export class CreateRequestTemplateDto {
  @ApiProperty({
    description: "Template name",
    example: "Standard software request",
    maxLength: 200,
  })
  name!: string;

  @ApiPropertyOptional({ description: "Template description" })
  description?: string;

  @ApiPropertyOptional({
    description: "Service ID the template applies to (null = global)",
    nullable: true,
  })
  serviceId?: string | null;

  @ApiProperty({
    description: "Pre-filled field values keyed by form field key",
    example: { category: "software" },
  })
  fieldValues!: Record<string, unknown>;

  @ApiPropertyOptional({
    description: "Whether this is the tenant default template",
    default: false,
  })
  isDefault?: boolean;
}

export class UpdateRequestTemplateDto {
  @ApiPropertyOptional({ description: "Template name", maxLength: 200 })
  name?: string;

  @ApiPropertyOptional({ description: "Template description" })
  description?: string;

  @ApiPropertyOptional({
    description: "Service ID the template applies to (null = global)",
    nullable: true,
  })
  serviceId?: string | null;

  @ApiPropertyOptional({ description: "Pre-filled field values keyed by form field key" })
  fieldValues?: Record<string, unknown>;

  @ApiPropertyOptional({ description: "Whether this is the tenant default template" })
  isDefault?: boolean;
}

export function validateCreateTemplatePayload(body: CreateRequestTemplateDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (typeof body.name !== "string" || !body.name.trim()) {
    throw new BadRequestException("Template name is required");
  }
  if (body.name.trim().length > 200) {
    throw new BadRequestException("Template name cannot exceed 200 characters");
  }
  if (body.serviceId && typeof body.serviceId === "string" && !UUID_PATTERN.test(body.serviceId)) {
    throw new BadRequestException("serviceId must be a valid UUID");
  }
  if (
    !body.fieldValues ||
    typeof body.fieldValues !== "object" ||
    Array.isArray(body.fieldValues)
  ) {
    throw new BadRequestException("fieldValues must be an object");
  }
}

export function validateUpdateTemplatePayload(body: UpdateRequestTemplateDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      throw new BadRequestException("Template name cannot be empty");
    }
    if (body.name.trim().length > 200) {
      throw new BadRequestException("Template name cannot exceed 200 characters");
    }
  }
  if (body.serviceId && typeof body.serviceId === "string" && !UUID_PATTERN.test(body.serviceId)) {
    throw new BadRequestException("serviceId must be a valid UUID");
  }
  if (
    body.fieldValues !== undefined &&
    (typeof body.fieldValues !== "object" || Array.isArray(body.fieldValues))
  ) {
    throw new BadRequestException("fieldValues must be an object");
  }
}
