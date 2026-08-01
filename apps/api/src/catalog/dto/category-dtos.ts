import { BadRequestException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class CreateServiceCategoryDto {
  @ApiProperty({ description: "Category display name", example: "Software", maxLength: 200 })
  name!: string;

  @ApiPropertyOptional({
    description: "URL slug. Auto-generated from name if omitted.",
    maxLength: 200,
  })
  slug?: string;

  @ApiPropertyOptional({ description: "Parent category ID for nested hierarchies", nullable: true })
  parentId?: string | null;

  @ApiPropertyOptional({ description: "Category description" })
  description?: string;

  @ApiPropertyOptional({ description: "Icon name or identifier", example: "cpu" })
  icon?: string;

  @ApiPropertyOptional({ description: "Display ordering index", default: 0 })
  displayOrder?: number;
}

export class UpdateServiceCategoryDto {
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

export class ServiceCategoryResponseDto {
  @ApiProperty({ description: "Category ID" })
  id!: string;

  @ApiProperty({ description: "Category display name" })
  name!: string;

  @ApiProperty({ description: "URL slug" })
  slug!: string;

  @ApiPropertyOptional({ description: "Parent category ID", nullable: true })
  parentId?: string | null;

  @ApiPropertyOptional({ description: "Category description" })
  description?: string | null;

  @ApiPropertyOptional({ description: "Icon name or identifier" })
  icon?: string | null;

  @ApiProperty({ description: "Display ordering index" })
  displayOrder!: number;

  @ApiPropertyOptional({ description: "Child category count" })
  _count?: { children: number; serviceItems: number };
}

export function validateCreateCategoryPayload(body: CreateServiceCategoryDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (typeof body.name !== "string" || !body.name.trim()) {
    throw new BadRequestException("Category name is required");
  }
  if (body.name.trim().length > 200) {
    throw new BadRequestException("Category name cannot exceed 200 characters");
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
  if (body.displayOrder !== undefined && typeof body.displayOrder !== "number") {
    throw new BadRequestException("displayOrder must be a number");
  }
}

export function validateUpdateCategoryPayload(body: UpdateServiceCategoryDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      throw new BadRequestException("Category name cannot be empty");
    }
    if (body.name.trim().length > 200) {
      throw new BadRequestException("Category name cannot exceed 200 characters");
    }
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
