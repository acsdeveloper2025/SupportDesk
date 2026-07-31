import { BadRequestException } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateCommentRequestDto {
  @ApiProperty({
    description: "The updated main body of the comment",
    example: "This issue has been escalated to the tier 2 networking team.",
  })
  body!: string;

  @ApiProperty({
    description: "The expected current version of the comment for optimistic concurrency",
    example: 1,
  })
  expectedVersion!: number;
}

export function validateUpdateCommentPayload(body: UpdateCommentRequestDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }

  if (typeof body.body !== "string" || !body.body.trim()) {
    throw new BadRequestException("Comment body is required");
  }

  if (body.body.trim().length > 10000) {
    throw new BadRequestException("Comment body cannot exceed 10000 characters");
  }

  if (typeof body.expectedVersion !== "number" || body.expectedVersion < 1) {
    throw new BadRequestException("expectedVersion is required and must be a positive integer");
  }
}
