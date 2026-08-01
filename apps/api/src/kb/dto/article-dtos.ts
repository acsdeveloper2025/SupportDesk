import { BadRequestException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { KbArticleStatus, KbArticleVisibility } from "@prisma/client";

export class CreateKbArticleDto {
  @ApiProperty({
    description: "Category ID to place the article in",
    example: "11111111-1111-1111-1111-111111111111",
  })
  categoryId!: string;

  @ApiProperty({
    description: "Article title",
    example: "How to configure Single Sign-On (SSO)",
    maxLength: 300,
  })
  title!: string;

  @ApiPropertyOptional({
    description: "URL slug. Auto-generated from title if omitted.",
    example: "how-to-configure-sso",
    maxLength: 300,
  })
  slug?: string;

  @ApiPropertyOptional({
    description: "Brief summary or abstract of the article",
    example: "Step-by-step guide to configuring SAML 2.0 and OIDC identity providers.",
  })
  summary?: string;

  @ApiProperty({
    description: "Article content in Markdown or Rich Text format",
    example: "# Single Sign-On Setup\n\nTo configure SSO for your organization...",
  })
  content!: string;

  @ApiPropertyOptional({
    enum: KbArticleVisibility,
    default: KbArticleVisibility.PUBLIC,
    description: "Visibility scope of the article (PUBLIC or INTERNAL)",
  })
  visibility?: KbArticleVisibility;

  @ApiPropertyOptional({
    description: "Tags associated with the article",
    example: ["sso", "saml", "authentication"],
    type: [String],
  })
  tags?: string[];

  @ApiPropertyOptional({
    description: "Pin article to top of category listings",
    default: false,
  })
  pinned?: boolean;
}

export class UpdateKbArticleDto {
  @ApiPropertyOptional({
    description: "Category ID",
  })
  categoryId?: string;

  @ApiPropertyOptional({
    description: "Article title",
    maxLength: 300,
  })
  title?: string;

  @ApiPropertyOptional({
    description: "URL slug",
    maxLength: 300,
  })
  slug?: string;

  @ApiPropertyOptional({
    description: "Brief summary",
  })
  summary?: string;

  @ApiPropertyOptional({
    description: "Article content",
  })
  content?: string;

  @ApiPropertyOptional({
    enum: KbArticleVisibility,
    description: "Visibility scope",
  })
  visibility?: KbArticleVisibility;

  @ApiPropertyOptional({
    description: "Tags associated with the article",
    type: [String],
  })
  tags?: string[];

  @ApiPropertyOptional({
    description: "Pin state",
  })
  pinned?: boolean;
}

export class ListKbArticlesQueryDto {
  categoryId?: string;
  status?: KbArticleStatus;
  visibility?: KbArticleVisibility;
  tag?: string;
  authorId?: string;
  limit?: number;
  offset?: number;
}

export class SearchKbArticlesQueryDto {
  q!: string;
  categoryId?: string;
  limit?: number;
  offset?: number;
}

export class LinkKbTicketDto {
  @ApiProperty({
    description: "Ticket ID to link with article",
    example: "11111111-1111-1111-1111-111111111111",
  })
  ticketId!: string;
}

export class KbFeedbackDto {
  @ApiProperty({
    description: "Helpful status feedback",
    example: true,
  })
  helpful!: boolean;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateCreateArticlePayload(body: CreateKbArticleDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }

  if (typeof body.categoryId !== "string" || !uuidPattern.test(body.categoryId)) {
    throw new BadRequestException("categoryId must be a valid UUID");
  }

  if (typeof body.title !== "string" || !body.title.trim()) {
    throw new BadRequestException("Article title is required");
  }

  if (body.title.trim().length > 300) {
    throw new BadRequestException("Article title cannot exceed 300 characters");
  }

  if (typeof body.content !== "string" || !body.content.trim()) {
    throw new BadRequestException("Article content is required");
  }

  if (body.visibility && !Object.values(KbArticleVisibility).includes(body.visibility)) {
    throw new BadRequestException(`Invalid visibility: ${body.visibility}`);
  }
}

export function validateUpdateArticlePayload(body: UpdateKbArticleDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }

  if (body.categoryId && !uuidPattern.test(body.categoryId)) {
    throw new BadRequestException("categoryId must be a valid UUID");
  }

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      throw new BadRequestException("Article title cannot be empty");
    }
    if (body.title.trim().length > 300) {
      throw new BadRequestException("Article title cannot exceed 300 characters");
    }
  }

  if (body.content !== undefined && (typeof body.content !== "string" || !body.content.trim())) {
    throw new BadRequestException("Article content cannot be empty");
  }
}

export function validateLinkTicketPayload(body: LinkKbTicketDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }

  if (typeof body.ticketId !== "string" || !uuidPattern.test(body.ticketId)) {
    throw new BadRequestException("ticketId must be a valid UUID");
  }
}

export function validateFeedbackPayload(body: KbFeedbackDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }

  if (typeof body.helpful !== "boolean") {
    throw new BadRequestException("helpful must be a boolean");
  }
}
