import { BadRequestException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CommentVisibility } from "@prisma/client";

export class CreateCommentRequestDto {
  @ApiProperty({
    description: "The main body of the comment",
    example: "This issue has been escalated to the networking team.",
  })
  body!: string;

  @ApiPropertyOptional({
    default: CommentVisibility.PUBLIC,
    enum: CommentVisibility,
    description: "Visibility scope of the comment (PUBLIC or INTERNAL)",
  })
  visibility?: CommentVisibility;
}

export function validateCreateCommentPayload(body: CreateCommentRequestDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }

  if (typeof body.body !== "string" || !body.body.trim()) {
    throw new BadRequestException("Comment body is required");
  }

  if (body.body.trim().length > 10000) {
    throw new BadRequestException("Comment body cannot exceed 10000 characters");
  }

  if (body.visibility && !Object.values(CommentVisibility).includes(body.visibility)) {
    throw new BadRequestException(`Invalid comment visibility: ${body.visibility}`);
  }
}
