import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CommentVisibility } from "@prisma/client";

import type { CommentEntity } from "../domain/comment.entity";

export class CommentResponseDto {
  @ApiProperty({
    description: "Unique system ID of the comment",
    example: "c0000000-0000-0000-0000-000000000001",
    type: String,
  })
  id!: string;

  @ApiProperty({
    description: "Tenant ID owning the comment",
    example: "b0000000-0000-0000-0000-000000000002",
    type: String,
  })
  tenantId!: string;

  @ApiProperty({
    description: "Ticket ID the comment belongs to",
    example: "a0000000-0000-0000-0000-000000000001",
    type: String,
  })
  ticketId!: string;

  @ApiProperty({
    description: "User ID of the author",
    example: "d0000000-0000-0000-0000-000000000003",
    type: String,
  })
  authorUserId!: string;

  @ApiProperty({
    description: "The main body of the comment",
    example: "This issue has been escalated.",
    type: String,
  })
  body!: string;

  @ApiProperty({
    enum: CommentVisibility,
    example: CommentVisibility.PUBLIC,
  })
  visibility!: CommentVisibility;

  @ApiProperty({
    description: "Current optimistic concurrency version",
    example: 1,
    type: Number,
  })
  version!: number;

  @ApiProperty({
    description: "Timestamp when comment was created",
    type: String,
  })
  createdAt!: string;

  @ApiProperty({
    description: "Timestamp when comment was last updated",
    type: String,
  })
  updatedAt!: string;

  @ApiPropertyOptional({
    description: "Timestamp when comment was soft deleted (if applicable)",
    type: String,
  })
  deletedAt!: string | null;

  static fromDomain(entity: CommentEntity): CommentResponseDto {
    const dto = new CommentResponseDto();
    dto.id = entity.id;
    dto.tenantId = entity.tenantId;
    dto.ticketId = entity.ticketId;
    dto.authorUserId = entity.authorUserId;
    dto.body = entity.body;
    dto.visibility = entity.visibility;
    dto.version = entity.version;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    dto.deletedAt = entity.deletedAt ? entity.deletedAt.toISOString() : null;
    return dto;
  }
}
