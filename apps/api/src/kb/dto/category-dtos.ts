import { BadRequestException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateKbCategoryDto {
  @ApiProperty({
    description: "Category display name",
    example: "Getting Started",
    maxLength: 200,
  })
  name!: string;

  @ApiPropertyOptional({
    description: "URL slug. Auto-generated from name if omitted.",
    example: "getting-started",
    maxLength: 200,
  })
  slug?: string;

  @ApiPropertyOptional({
    description: "Parent category ID for nested category hierarchies",
    example: "11111111-1111-1111-1111-111111111111",
    nullable: true,
  })
  parentId?: string | null;

  @ApiPropertyOptional({
    description: "Category description",
    example: "Basic guides and setup instructions",
  })
  description?: string;

  @ApiPropertyOptional({
    description: "Icon name or identifier",
    example: "book-open",
  })
  icon?: string;

  @ApiPropertyOptional({
    description: "Display ordering index",
    default: 0,
  })
  displayOrder?: number;
}

export class UpdateKbCategoryDto {
  @ApiPropertyOptional({
    description: "Category display name",
    maxLength: 200,
  })
  name?: string;

  @ApiPropertyOptional({
    description: "URL slug",
    maxLength: 200,
  })
  slug?: string;

  @ApiPropertyOptional({
    description: "Parent category ID",
    nullable: true,
  })
  parentId?: string | null;

  @ApiPropertyOptional({
    description: "Category description",
  })
  description?: string;

  @ApiPropertyOptional({
    description: "Icon name or identifier",
  })
  icon?: string;

  @ApiPropertyOptional({
    description: "Display ordering index",
  })
  displayOrder?: number;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateCreateCategoryPayload(body: CreateKbCategoryDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    throw new BadRequestException("Category name is required");
  }

  if (body.name.trim().length > 200) {
    throw new BadRequestException("Category name cannot exceed 200 characters");
  }

  if (body.parentId && typeof body.parentId === "string" && !uuidPattern.test(body.parentId)) {
    throw new BadRequestException("parentId must be a valid UUID");
  }

  if (body.displayOrder !== undefined && typeof body.displayOrder !== "number") {
    throw new BadRequestException("displayOrder must be a number");
  }
}

export function validateUpdateCategoryPayload(body: UpdateKbCategoryDto): void {
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

  if (body.parentId && typeof body.parentId === "string" && !uuidPattern.test(body.parentId)) {
    throw new BadRequestException("parentId must be a valid UUID");
  }
}
