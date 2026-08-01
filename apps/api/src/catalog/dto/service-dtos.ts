import { BadRequestException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { ServiceApprovalMode, ServiceKind, TicketPriority, TicketType } from "@prisma/client";

import { type ServiceFormSchema, validateFormSchema } from "../domain/form-engine";
import { UUID_PATTERN } from "./category-dtos";

export interface ApprovalStepDefinition {
  ordinal: number;
  approverRole?: string | null;
  approverUserId?: string | null;
}

export class CreateServiceItemDto {
  @ApiProperty({
    description: "Category ID the service belongs to",
    example: "11111111-1111-1111-1111-111111111111",
  })
  categoryId!: string;

  @ApiProperty({
    description: "Service display name",
    example: "Software License Request",
    maxLength: 200,
  })
  name!: string;

  @ApiPropertyOptional({
    description: "URL slug. Auto-generated from name if omitted.",
    maxLength: 200,
  })
  slug?: string;

  @ApiPropertyOptional({ description: "Service description shown in the request catalog" })
  description?: string;

  @ApiPropertyOptional({
    description: "Service kind",
    enum: ["BUSINESS", "TECHNICAL"],
    default: "BUSINESS",
  })
  kind?: ServiceKind;

  @ApiPropertyOptional({
    description: "Approval mode for requests of this service",
    enum: ["NONE", "SINGLE", "ALL", "ANY"],
    default: "NONE",
  })
  approvalMode?: ServiceApprovalMode;

  @ApiPropertyOptional({
    description: "Ordered approval steps [{ordinal, approverRole?, approverUserId?}]",
    type: "array",
    items: { type: "object" },
    default: [],
  })
  approvalSteps?: ApprovalStepDefinition[];

  @ApiPropertyOptional({
    description: "SLA policy ID pinned to tickets generated from requests",
    nullable: true,
  })
  slaPolicyId?: string | null;

  @ApiPropertyOptional({
    description: "Default ticket type for generated tickets",
    enum: ["QUESTION", "INCIDENT", "PROBLEM", "FEATURE_REQUEST"],
    default: "FEATURE_REQUEST",
  })
  defaultTicketType?: TicketType;

  @ApiPropertyOptional({
    description: "Default priority for requests",
    enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
    default: "MEDIUM",
  })
  defaultPriority?: TicketPriority;

  @ApiPropertyOptional({
    description: "Knowledge Base tag names used for article suggestions",
    type: "array",
    items: { type: "string" },
    default: [],
  })
  suggestedKbTags?: string[];

  @ApiPropertyOptional({
    description: "Whether a Ticket is generated when fulfillment starts",
    default: true,
  })
  generateTicketOnFulfillment?: boolean;

  @ApiPropertyOptional({ description: "Initial request form schema (published with the service)" })
  formSchema?: {
    fields: Array<Record<string, unknown>>;
  };
}

export class UpdateServiceItemDto {
  @ApiPropertyOptional({ description: "Category ID the service belongs to" })
  categoryId?: string;

  @ApiPropertyOptional({ description: "Service display name", maxLength: 200 })
  name?: string;

  @ApiPropertyOptional({ description: "URL slug", maxLength: 200 })
  slug?: string;

  @ApiPropertyOptional({ description: "Service description" })
  description?: string;

  @ApiPropertyOptional({ description: "Service kind", enum: ["BUSINESS", "TECHNICAL"] })
  kind?: ServiceKind;

  @ApiPropertyOptional({ description: "Approval mode", enum: ["NONE", "SINGLE", "ALL", "ANY"] })
  approvalMode?: ServiceApprovalMode;

  @ApiPropertyOptional({
    description: "Ordered approval steps [{ordinal, approverRole?, approverUserId?}]",
    type: "array",
    items: { type: "object" },
  })
  approvalSteps?: ApprovalStepDefinition[];

  @ApiPropertyOptional({ description: "SLA policy ID pinned to generated tickets", nullable: true })
  slaPolicyId?: string | null;

  @ApiPropertyOptional({
    description: "Default ticket type for generated tickets",
    enum: ["QUESTION", "INCIDENT", "PROBLEM", "FEATURE_REQUEST"],
  })
  defaultTicketType?: TicketType;

  @ApiPropertyOptional({
    description: "Default priority for requests",
    enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
  })
  defaultPriority?: TicketPriority;

  @ApiPropertyOptional({
    description: "Knowledge Base tag names used for article suggestions",
    type: "array",
    items: { type: "string" },
  })
  suggestedKbTags?: string[];

  @ApiPropertyOptional({ description: "Whether a Ticket is generated when fulfillment starts" })
  generateTicketOnFulfillment?: boolean;
}

export function validateApprovalSteps(steps: ApprovalStepDefinition[] | undefined): void {
  if (steps === undefined) {
    return;
  }
  if (!Array.isArray(steps)) {
    throw new BadRequestException("approvalSteps must be an array");
  }
  const ordinals = new Set<number>();
  for (const step of steps) {
    if (!step || typeof step !== "object") {
      throw new BadRequestException("approvalSteps entries must be objects");
    }
    if (typeof step.ordinal !== "number" || step.ordinal < 1) {
      throw new BadRequestException("approvalSteps entries require a positive numeric ordinal");
    }
    if (ordinals.has(step.ordinal)) {
      throw new BadRequestException(`duplicate approval step ordinal ${step.ordinal}`);
    }
    ordinals.add(step.ordinal);
    if (step.approverRole && typeof step.approverRole !== "string") {
      throw new BadRequestException("approverRole must be a string");
    }
    if (
      step.approverUserId &&
      typeof step.approverUserId === "string" &&
      !UUID_PATTERN.test(step.approverUserId)
    ) {
      throw new BadRequestException("approverUserId must be a valid UUID");
    }
  }
  if (steps.length === 0 && ordinals.size > 0) {
    throw new BadRequestException("approvalSteps must not be empty");
  }
}

export function validateCreateServicePayload(body: CreateServiceItemDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (typeof body.categoryId !== "string" || !UUID_PATTERN.test(body.categoryId)) {
    throw new BadRequestException("categoryId must be a valid UUID");
  }
  if (typeof body.name !== "string" || !body.name.trim()) {
    throw new BadRequestException("Service name is required");
  }
  if (body.name.trim().length > 200) {
    throw new BadRequestException("Service name cannot exceed 200 characters");
  }
  if (
    body.slug !== undefined &&
    (typeof body.slug !== "string" || !/^[a-z0-9-]+$/.test(body.slug))
  ) {
    throw new BadRequestException("slug must be lowercase alphanumeric with hyphens");
  }
  if (
    body.slaPolicyId &&
    typeof body.slaPolicyId === "string" &&
    !UUID_PATTERN.test(body.slaPolicyId)
  ) {
    throw new BadRequestException("slaPolicyId must be a valid UUID");
  }
  validateApprovalSteps(body.approvalSteps);
  if (body.suggestedKbTags !== undefined) {
    if (!Array.isArray(body.suggestedKbTags)) {
      throw new BadRequestException("suggestedKbTags must be an array of strings");
    }
    if (body.suggestedKbTags.some((tag) => typeof tag !== "string")) {
      throw new BadRequestException("suggestedKbTags must contain only strings");
    }
  }
  if (body.formSchema !== undefined) {
    validateFormSchemaPayload(body.formSchema);
  }
}

export function validateUpdateServicePayload(body: UpdateServiceItemDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (
    body.categoryId !== undefined &&
    (typeof body.categoryId !== "string" || !UUID_PATTERN.test(body.categoryId))
  ) {
    throw new BadRequestException("categoryId must be a valid UUID");
  }
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      throw new BadRequestException("Service name cannot be empty");
    }
    if (body.name.trim().length > 200) {
      throw new BadRequestException("Service name cannot exceed 200 characters");
    }
  }
  if (
    body.slug !== undefined &&
    (typeof body.slug !== "string" || !/^[a-z0-9-]+$/.test(body.slug))
  ) {
    throw new BadRequestException("slug must be lowercase alphanumeric with hyphens");
  }
  if (
    body.slaPolicyId &&
    typeof body.slaPolicyId === "string" &&
    !UUID_PATTERN.test(body.slaPolicyId)
  ) {
    throw new BadRequestException("slaPolicyId must be a valid UUID");
  }
  validateApprovalSteps(body.approvalSteps);
  if (body.suggestedKbTags !== undefined) {
    if (!Array.isArray(body.suggestedKbTags)) {
      throw new BadRequestException("suggestedKbTags must be an array of strings");
    }
    if (body.suggestedKbTags.some((tag) => typeof tag !== "string")) {
      throw new BadRequestException("suggestedKbTags must contain only strings");
    }
  }
}

export function validateFormSchemaPayload(schema: {
  fields: Array<Record<string, unknown>>;
}): void {
  if (!schema || typeof schema !== "object" || !Array.isArray(schema.fields)) {
    throw new BadRequestException("formSchema must be an object with a fields array");
  }
  const errors = validateFormSchema(schema as unknown as ServiceFormSchema);
  if (errors.length > 0) {
    throw new BadRequestException(`Invalid form schema: ${errors.join("; ")}`);
  }
}
