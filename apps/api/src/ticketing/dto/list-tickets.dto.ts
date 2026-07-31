import { BadRequestException } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { TicketChannel, TicketPriority, TicketStatus, TicketType } from "@prisma/client";
import { z } from "zod";

import { TicketResponseDto } from "./ticket-response.dto";

export const ticketSortFields = [
  "createdAt",
  "updatedAt",
  "priority",
  "dueDate",
  "status",
  "publicRef",
] as const;
export type TicketSortField = (typeof ticketSortFields)[number];

export const sortDirections = ["asc", "desc"] as const;
export type SortDirection = (typeof sortDirections)[number];

const csvToArray = (val: string | undefined): string[] | undefined => {
  if (!val) return undefined;
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

export const ListTicketsQuerySchema = z.object({
  // Pagination
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),

  // Sorting
  sortBy: z.enum(ticketSortFields).optional().default("createdAt"),
  sortDir: z.enum(sortDirections).optional().default("desc"),

  // Filtering (Arrays via CSV)
  status: z
    .string()
    .optional()
    .transform(csvToArray)
    .pipe(z.array(z.nativeEnum(TicketStatus)).optional()),
  priority: z
    .string()
    .optional()
    .transform(csvToArray)
    .pipe(z.array(z.nativeEnum(TicketPriority)).optional()),
  type: z
    .string()
    .optional()
    .transform(csvToArray)
    .pipe(z.array(z.nativeEnum(TicketType)).optional()),
  channel: z
    .string()
    .optional()
    .transform(csvToArray)
    .pipe(z.array(z.nativeEnum(TicketChannel)).optional()),

  assigneeUserId: z
    .string()
    .optional()
    .transform(csvToArray)
    .pipe(z.array(z.string().uuid()).optional()),
  requesterUserId: z
    .string()
    .optional()
    .transform(csvToArray)
    .pipe(z.array(z.string().uuid()).optional()),
  assignedGroupId: z
    .string()
    .optional()
    .transform(csvToArray)
    .pipe(z.array(z.string().uuid()).optional()),

  // Filtering (Dates)
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  updatedAfter: z.string().datetime().optional(),
  updatedBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  dueBefore: z.string().datetime().optional(),
});

export type ListTicketsQueryDto = z.infer<typeof ListTicketsQuerySchema>;

export function validateListTicketsQuery(query: unknown): ListTicketsQueryDto {
  const result = ListTicketsQuerySchema.safeParse(query);
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

export class PaginationMetaDto {
  @ApiProperty({
    type: Number,
    description: "Total number of records matching the filters",
    example: 150,
  })
  totalRecords!: number;

  @ApiProperty({ type: Number, description: "Total number of pages", example: 8 })
  totalPages!: number;

  @ApiProperty({ type: Number, description: "Current page number", example: 1 })
  currentPage!: number;

  @ApiProperty({ type: Number, description: "Number of items per page", example: 20 })
  pageSize!: number;

  @ApiProperty({ type: Boolean, description: "Whether a next page exists", example: true })
  hasNextPage!: boolean;

  @ApiProperty({ type: Boolean, description: "Whether a previous page exists", example: false })
  hasPreviousPage!: boolean;
}

export class TicketSortDto {
  @ApiProperty({ type: String, description: "Field sorted by", example: "createdAt" })
  field!: string;

  @ApiProperty({ type: String, description: "Sort direction", example: "desc" })
  direction!: string;
}

export class TicketListResponseDto {
  @ApiProperty({ type: [TicketResponseDto], description: "List of tickets" })
  items!: TicketResponseDto[];

  @ApiProperty({ type: PaginationMetaDto, description: "Pagination metadata" })
  meta!: PaginationMetaDto;

  @ApiProperty({ description: "Applied filters", type: Object, additionalProperties: true })
  appliedFilters!: Record<string, unknown>;

  @ApiProperty({ type: TicketSortDto, description: "Applied sorting" })
  sort!: TicketSortDto;
}
