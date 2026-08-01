import { BadRequestException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const ASSET_LIFECYCLE_STATE_VALUES = [
  "DRAFT",
  "IN_STOCK",
  "ASSIGNED",
  "IN_REPAIR",
  "RETIRED",
  "DISPOSED",
  "LOST",
  "ARCHIVED",
] as const;

export const ASSET_RELATIONSHIP_TYPE_VALUES = [
  "PARENT_CHILD",
  "DEPENDS_ON",
  "CONNECTED_TO",
  "INSTALLED_ON",
  "HOSTED_ON",
  "LICENSE_ASSIGNED_TO",
] as const;

export const ASSET_ASSIGNMENT_KIND_VALUES = ["USER", "DEPARTMENT", "LOCATION"] as const;

export const ASSET_ATTACHMENT_KIND_VALUES = [
  "PHOTO",
  "INVOICE",
  "MANUAL",
  "WARRANTY",
  "OTHER",
] as const;

// ---------------------------------------------------------------------------
// Asset types
// ---------------------------------------------------------------------------

export class CreateAssetTypeDto {
  @ApiProperty({ description: "Stable type key", example: "custom_device", maxLength: 100 })
  key!: string;

  @ApiProperty({ description: "Display name", example: "Custom Device", maxLength: 200 })
  name!: string;

  @ApiPropertyOptional({ description: "Type description" })
  description?: string;

  @ApiPropertyOptional({
    description: "Custom field schema (JSON array of field definitions)",
    example: [{ key: "batteryHealth", label: "Battery Health (%)", type: "NUMBER" }],
  })
  customFieldsSchema?: Array<Record<string, unknown>>;
}

export class UpdateAssetTypeDto {
  @ApiPropertyOptional({ description: "Display name", maxLength: 200 })
  name?: string;

  @ApiPropertyOptional({ description: "Type description" })
  description?: string;

  @ApiPropertyOptional({ description: "Custom field schema (JSON array of field definitions)" })
  customFieldsSchema?: Array<Record<string, unknown>>;
}

export function validateCreateAssetTypePayload(body: CreateAssetTypeDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (typeof body.key !== "string" || !/^[a-z0-9_]+$/.test(body.key.trim())) {
    throw new BadRequestException("key must be lowercase alphanumeric with underscores");
  }
  if (typeof body.name !== "string" || !body.name.trim()) {
    throw new BadRequestException("Asset type name is required");
  }
  if (body.customFieldsSchema !== undefined) {
    assertCustomFieldsSchema(body.customFieldsSchema);
  }
}

export function validateUpdateAssetTypePayload(body: UpdateAssetTypeDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim())) {
    throw new BadRequestException("Asset type name cannot be empty");
  }
  if (body.customFieldsSchema !== undefined) {
    assertCustomFieldsSchema(body.customFieldsSchema);
  }
}

function assertCustomFieldsSchema(schema: Array<Record<string, unknown>>): void {
  if (!Array.isArray(schema)) {
    throw new BadRequestException("customFieldsSchema must be an array");
  }
  const keys = new Set<string>();
  for (const field of schema) {
    if (!field || typeof field !== "object") {
      throw new BadRequestException("Each custom field must be an object");
    }
    if (typeof field.key !== "string" || !field.key.trim()) {
      throw new BadRequestException("Each custom field requires a key");
    }
    if (keys.has(field.key)) {
      throw new BadRequestException(`Duplicate custom field key '${field.key}'`);
    }
    keys.add(field.key);
  }
}

// ---------------------------------------------------------------------------
// Asset categories
// ---------------------------------------------------------------------------

export class CreateAssetCategoryDto {
  @ApiProperty({ description: "Category display name", example: "Workstations", maxLength: 200 })
  name!: string;

  @ApiPropertyOptional({
    description: "URL slug. Auto-generated from name if omitted.",
    maxLength: 200,
  })
  slug?: string;

  @ApiPropertyOptional({
    description: "Parent category ID for unlimited hierarchy",
    nullable: true,
  })
  parentId?: string | null;

  @ApiPropertyOptional({ description: "Category description" })
  description?: string;

  @ApiPropertyOptional({ description: "Icon name or identifier", example: "monitor" })
  icon?: string;

  @ApiPropertyOptional({ description: "Display ordering index", default: 0 })
  displayOrder?: number;
}

export class UpdateAssetCategoryDto {
  @ApiPropertyOptional({ description: "Category display name", maxLength: 200 })
  name?: string;

  @ApiPropertyOptional({ description: "URL slug", maxLength: 200 })
  slug?: string;

  @ApiPropertyOptional({ description: "Parent category ID", nullable: true })
  parentId?: string | null;

  @ApiPropertyOptional({ description: "Category description" })
  description?: string;

  @ApiPropertyOptional({ description: "Icon name or identifier" })
  icon?: string;

  @ApiPropertyOptional({ description: "Display ordering index" })
  displayOrder?: number;
}

export function validateCreateAssetCategoryPayload(body: CreateAssetCategoryDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (typeof body.name !== "string" || !body.name.trim()) {
    throw new BadRequestException("Category name is required");
  }
  if (
    body.slug !== undefined &&
    (typeof body.slug !== "string" || !/^[a-z0-9-]+$/.test(body.slug))
  ) {
    throw new BadRequestException("slug must be lowercase alphanumeric with hyphens");
  }
  if (body.parentId && typeof body.parentId === "string" && !UUID_PATTERN.test(body.parentId)) {
    throw new BadRequestException("parentId must be a valid UUID");
  }
}

export function validateUpdateAssetCategoryPayload(body: UpdateAssetCategoryDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim())) {
    throw new BadRequestException("Category name cannot be empty");
  }
  if (
    body.slug !== undefined &&
    (typeof body.slug !== "string" || !/^[a-z0-9-]+$/.test(body.slug))
  ) {
    throw new BadRequestException("slug must be lowercase alphanumeric with hyphens");
  }
  if (body.parentId && typeof body.parentId === "string" && !UUID_PATTERN.test(body.parentId)) {
    throw new BadRequestException("parentId must be a valid UUID");
  }
}

// ---------------------------------------------------------------------------
// Asset locations
// ---------------------------------------------------------------------------

export class CreateAssetLocationDto {
  @ApiProperty({ description: "Location display name", example: "HQ - Floor 3", maxLength: 200 })
  name!: string;

  @ApiPropertyOptional({ description: "Location description" })
  description?: string;

  @ApiPropertyOptional({ description: "Postal address" })
  address?: string;
}

export class UpdateAssetLocationDto {
  @ApiPropertyOptional({ description: "Location display name", maxLength: 200 })
  name?: string;

  @ApiPropertyOptional({ description: "Location description" })
  description?: string;

  @ApiPropertyOptional({ description: "Postal address" })
  address?: string;
}

export function validateCreateAssetLocationPayload(body: CreateAssetLocationDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (typeof body.name !== "string" || !body.name.trim()) {
    throw new BadRequestException("Location name is required");
  }
}

export function validateUpdateAssetLocationPayload(body: UpdateAssetLocationDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim())) {
    throw new BadRequestException("Location name cannot be empty");
  }
}

// ---------------------------------------------------------------------------
// Asset records
// ---------------------------------------------------------------------------

export class CreateAssetDto {
  @ApiProperty({ description: "Asset display name", example: "MBP 16 2024 - Dev", maxLength: 255 })
  name!: string;

  @ApiProperty({ description: "Asset type ID (system or custom)" })
  assetTypeId!: string;

  @ApiPropertyOptional({ description: "Asset category ID", nullable: true })
  categoryId?: string | null;

  @ApiPropertyOptional({ description: "Serial number", maxLength: 200 })
  serialNumber?: string;

  @ApiPropertyOptional({ description: "Asset tag", maxLength: 100 })
  assetTag?: string;

  @ApiPropertyOptional({ description: "Barcode or QR code value", maxLength: 200 })
  barcode?: string;

  @ApiPropertyOptional({ description: "Manufacturer", maxLength: 200 })
  manufacturer?: string;

  @ApiPropertyOptional({ description: "Model", maxLength: 200 })
  model?: string;

  @ApiPropertyOptional({ description: "Vendor", maxLength: 200 })
  vendor?: string;

  @ApiPropertyOptional({ description: "Purchase date (ISO-8601 date)" })
  purchaseDate?: string;

  @ApiPropertyOptional({ description: "Warranty expiration date (ISO-8601 date)" })
  warrantyExpiresAt?: string;

  @ApiPropertyOptional({ description: "Purchase cost (decimal, up to 2 places)" })
  cost?: string;

  @ApiPropertyOptional({ description: "Initial lifecycle state", default: "DRAFT" })
  lifecycleState?: (typeof ASSET_LIFECYCLE_STATE_VALUES)[number];

  @ApiPropertyOptional({ description: "Accountable owner user ID", nullable: true })
  ownerUserId?: string | null;

  @ApiPropertyOptional({ description: "Current location ID", nullable: true })
  locationId?: string | null;

  @ApiPropertyOptional({ description: "Notes" })
  notes?: string;

  @ApiPropertyOptional({
    description: "Custom field values keyed by asset type custom field key",
    example: { batteryHealth: 87 },
  })
  customFields?: Record<string, unknown>;
}

export class UpdateAssetDto {
  @ApiPropertyOptional({ description: "Asset display name", maxLength: 255 })
  name?: string;

  @ApiPropertyOptional({ description: "Asset category ID", nullable: true })
  categoryId?: string | null;

  @ApiPropertyOptional({ description: "Serial number", maxLength: 200 })
  serialNumber?: string;

  @ApiPropertyOptional({ description: "Asset tag", maxLength: 100 })
  assetTag?: string;

  @ApiPropertyOptional({ description: "Barcode or QR code value", maxLength: 200 })
  barcode?: string;

  @ApiPropertyOptional({ description: "Manufacturer", maxLength: 200 })
  manufacturer?: string;

  @ApiPropertyOptional({ description: "Model", maxLength: 200 })
  model?: string;

  @ApiPropertyOptional({ description: "Vendor", maxLength: 200 })
  vendor?: string;

  @ApiPropertyOptional({ description: "Purchase date (ISO-8601 date)" })
  purchaseDate?: string;

  @ApiPropertyOptional({ description: "Warranty expiration date (ISO-8601 date)" })
  warrantyExpiresAt?: string;

  @ApiPropertyOptional({ description: "Purchase cost (decimal, up to 2 places)" })
  cost?: string;

  @ApiPropertyOptional({ description: "Accountable owner user ID", nullable: true })
  ownerUserId?: string | null;

  @ApiPropertyOptional({ description: "Current location ID", nullable: true })
  locationId?: string | null;

  @ApiPropertyOptional({ description: "Notes" })
  notes?: string;

  @ApiPropertyOptional({ description: "Custom field values keyed by asset type custom field key" })
  customFields?: Record<string, unknown>;
}

export function validateCreateAssetPayload(body: CreateAssetDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (typeof body.name !== "string" || !body.name.trim()) {
    throw new BadRequestException("Asset name is required");
  }
  if (typeof body.assetTypeId !== "string" || !UUID_PATTERN.test(body.assetTypeId)) {
    throw new BadRequestException("assetTypeId must be a valid UUID");
  }
  validateOptionalAssetFields(body as unknown as Record<string, unknown>);
  if (
    body.lifecycleState !== undefined &&
    !ASSET_LIFECYCLE_STATE_VALUES.includes(body.lifecycleState)
  ) {
    throw new BadRequestException(
      `lifecycleState must be one of ${ASSET_LIFECYCLE_STATE_VALUES.join(", ")}`,
    );
  }
}

export function validateUpdateAssetPayload(body: UpdateAssetDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (Object.keys(body).length === 0) {
    throw new BadRequestException("At least one field must be provided");
  }
  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim())) {
    throw new BadRequestException("Asset name cannot be empty");
  }
  validateOptionalAssetFields(body as unknown as Record<string, unknown>);
}

function validateOptionalAssetFields(body: Record<string, unknown>): void {
  for (const key of ["categoryId", "ownerUserId", "locationId"]) {
    const value = body[key];
    if (
      value !== undefined &&
      value !== null &&
      (typeof value !== "string" || !UUID_PATTERN.test(value))
    ) {
      throw new BadRequestException(`${key} must be a valid UUID or null`);
    }
  }
  for (const key of ["serialNumber", "assetTag", "barcode", "manufacturer", "model", "vendor"]) {
    const value = body[key];
    if (value !== undefined && value !== null && typeof value !== "string") {
      throw new BadRequestException(`${key} must be a string`);
    }
  }
  if (body.cost !== undefined && body.cost !== null) {
    if (typeof body.cost !== "string" || !/^\d+(\.\d{1,2})?$/.test(body.cost)) {
      throw new BadRequestException("cost must be a decimal string with up to 2 decimal places");
    }
  }
  for (const key of ["purchaseDate", "warrantyExpiresAt"]) {
    const value = body[key];
    if (value !== undefined && value !== null && typeof value !== "string") {
      throw new BadRequestException(`${key} must be an ISO-8601 date string`);
    }
  }
}

// ---------------------------------------------------------------------------
// Lifecycle transitions, assignments, relationships, links
// ---------------------------------------------------------------------------

export class TransitionAssetDto {
  @ApiProperty({ description: "Target lifecycle state", enum: ASSET_LIFECYCLE_STATE_VALUES })
  lifecycleState!: (typeof ASSET_LIFECYCLE_STATE_VALUES)[number];

  @ApiPropertyOptional({ description: "Reason or comment for the transition", maxLength: 500 })
  comment?: string;
}

export function validateTransitionAssetPayload(body: TransitionAssetDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (!ASSET_LIFECYCLE_STATE_VALUES.includes(body.lifecycleState)) {
    throw new BadRequestException(
      `lifecycleState must be one of ${ASSET_LIFECYCLE_STATE_VALUES.join(", ")}`,
    );
  }
}

export class AssignAssetDto {
  @ApiProperty({ description: "Assignment kind", enum: ASSET_ASSIGNMENT_KIND_VALUES })
  kind!: (typeof ASSET_ASSIGNMENT_KIND_VALUES)[number];

  @ApiPropertyOptional({ description: "User ID for USER assignments", nullable: true })
  assignedToUserId?: string | null;

  @ApiPropertyOptional({
    description: "Department name for DEPARTMENT assignments",
    nullable: true,
    maxLength: 200,
  })
  assignedDepartment?: string | null;

  @ApiPropertyOptional({ description: "Location ID for LOCATION assignments", nullable: true })
  assignedLocationId?: string | null;

  @ApiPropertyOptional({ description: "Assignment reason", maxLength: 500 })
  reason?: string;

  @ApiPropertyOptional({
    description: "Automatically transition the asset lifecycle state",
    default: false,
  })
  transitionLifecycle?: boolean;
}

export function validateAssignAssetPayload(body: AssignAssetDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (!ASSET_ASSIGNMENT_KIND_VALUES.includes(body.kind)) {
    throw new BadRequestException(`kind must be one of ${ASSET_ASSIGNMENT_KIND_VALUES.join(", ")}`);
  }
  if (body.kind === "USER") {
    if (typeof body.assignedToUserId !== "string" || !UUID_PATTERN.test(body.assignedToUserId)) {
      throw new BadRequestException("USER assignment requires a valid assignedToUserId");
    }
  } else if (body.kind === "DEPARTMENT") {
    if (typeof body.assignedDepartment !== "string" || !body.assignedDepartment.trim()) {
      throw new BadRequestException(
        "DEPARTMENT assignment requires a non-empty assignedDepartment",
      );
    }
  } else if (body.kind === "LOCATION") {
    if (
      typeof body.assignedLocationId !== "string" ||
      !UUID_PATTERN.test(body.assignedLocationId)
    ) {
      throw new BadRequestException("LOCATION assignment requires a valid assignedLocationId");
    }
  }
}

export class CreateAssetRelationshipDto {
  @ApiProperty({ description: "Target asset ID" })
  targetAssetId!: string;

  @ApiProperty({ description: "Relationship type", enum: ASSET_RELATIONSHIP_TYPE_VALUES })
  type!: (typeof ASSET_RELATIONSHIP_TYPE_VALUES)[number];

  @ApiPropertyOptional({ description: "Relationship note", maxLength: 500 })
  note?: string;
}

export function validateCreateAssetRelationshipPayload(body: CreateAssetRelationshipDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (typeof body.targetAssetId !== "string" || !UUID_PATTERN.test(body.targetAssetId)) {
    throw new BadRequestException("targetAssetId must be a valid UUID");
  }
  if (!ASSET_RELATIONSHIP_TYPE_VALUES.includes(body.type)) {
    throw new BadRequestException(
      `type must be one of ${ASSET_RELATIONSHIP_TYPE_VALUES.join(", ")}`,
    );
  }
}

export class LinkAssetTicketDto {
  @ApiProperty({ description: "Ticket ID to link" })
  ticketId!: string;
}

export function validateLinkAssetTicketPayload(body: LinkAssetTicketDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (typeof body.ticketId !== "string" || !UUID_PATTERN.test(body.ticketId)) {
    throw new BadRequestException("ticketId must be a valid UUID");
  }
}

export class CreateTicketFromAssetDto {
  @ApiProperty({ description: "Ticket title", example: "Laptop will not boot", maxLength: 255 })
  title!: string;

  @ApiProperty({ description: "Ticket description" })
  description!: string;

  @ApiPropertyOptional({ description: "Ticket priority", default: "MEDIUM" })
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";

  @ApiPropertyOptional({ description: "Ticket type", default: "INCIDENT" })
  type?: "QUESTION" | "INCIDENT" | "PROBLEM" | "FEATURE_REQUEST";
}

export function validateCreateTicketFromAssetPayload(body: CreateTicketFromAssetDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (typeof body.title !== "string" || !body.title.trim()) {
    throw new BadRequestException("Ticket title is required");
  }
  if (typeof body.description !== "string" || !body.description.trim()) {
    throw new BadRequestException("Ticket description is required");
  }
}

export class LinkAssetTypeKbDto {
  @ApiProperty({ description: "Knowledge Base article ID to associate with the asset type" })
  articleId!: string;
}

export function validateLinkAssetTypeKbPayload(body: LinkAssetTypeKbDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (typeof body.articleId !== "string" || !UUID_PATTERN.test(body.articleId)) {
    throw new BadRequestException("articleId must be a valid UUID");
  }
}

export interface ListAssetTypesQuery {
  page?: number;
  pageSize?: number;
  includeSystem?: boolean;
  customOnly?: boolean;
}

export interface ListAssetCategoriesQuery {
  page?: number;
  pageSize?: number;
}

export interface ListAssetLocationsQuery {
  page?: number;
  pageSize?: number;
}

export interface ListAssetsQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  lifecycleState?: (typeof ASSET_LIFECYCLE_STATE_VALUES)[number];
  assetTypeId?: string;
  categoryId?: string;
  locationId?: string;
  assignedToUserId?: string;
  ownerUserId?: string;
}
