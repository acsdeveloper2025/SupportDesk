import { BadRequestException } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { CommentVisibility } from "@prisma/client";
import { z } from "zod";

import { CommentResponseDto } from "./comment-response.dto";
import { PaginationMetaDto } from "./list-tickets.dto";

export const commentSortFields = ["createdAt"] as const;
export type CommentSortField = (typeof commentSortFields)[number];

export const sortDirections = ["asc", "desc"] as const;
export type SortDirection = (typeof sortDirections)[number];

const csvToArray = (val: string | undefined): string[] | undefined => {
  if (!val) return undefined;
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

export const ListCommentsQuerySchema = z.object({
  // Pagination
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),

  // Sorting
  sortBy: z.enum(commentSortFields).optional().default("createdAt"),
  sortDir: z.enum(sortDirections).optional().default("desc"),

  // Filtering (Arrays via CSV)
  visibility: z
    .string()
    .optional()
    .transform(csvToArray)
    .pipe(z.array(z.nativeEnum(CommentVisibility)).optional()),
  authorUserId: z
    .string()
    .optional()
    .transform(csvToArray)
    .pipe(z.array(z.string().uuid()).optional()),

  // Filtering (Dates)
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
});

export type ListCommentsQueryDto = z.infer<typeof ListCommentsQuerySchema>;

export function validateListCommentsQuery(query: unknown): ListCommentsQueryDto {
  const result = ListCommentsQuerySchema.safeParse(query);
  if (!result.success) {
    throw new BadRequestException({
      code: "VALIDATION_FAILED",
      error: "Bad Request",
      message: "Invalid query parameters",
      details: result.error.errors,
      statusCode: 400,
    });
  }
  return result.data;
}

export class CommentSortDto {
  @ApiProperty({ type: String, description: "Field sorted by", example: "createdAt" })
  field!: string;

  @ApiProperty({ type: String, description: "Sort direction", example: "desc" })
  direction!: string;
}

export class CommentListResponseDto {
  @ApiProperty({ type: [CommentResponseDto], description: "List of comments" })
  items!: CommentResponseDto[];

  @ApiProperty({ type: PaginationMetaDto, description: "Pagination metadata" })
  meta!: PaginationMetaDto;

  @ApiProperty({ description: "Applied filters", type: Object, additionalProperties: true })
  appliedFilters!: Record<string, unknown>;

  @ApiProperty({ type: CommentSortDto, description: "Applied sorting" })
  sort!: CommentSortDto;
}
