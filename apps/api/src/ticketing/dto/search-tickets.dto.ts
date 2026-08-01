import { BadRequestException } from "@nestjs/common";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { TicketChannel, TicketPriority, TicketType } from "@prisma/client";
import { z } from "zod";

import { TICKET_SEARCH_QUERY_MAX_LENGTH } from "../ticket-search.builder";
import { ListTicketsQuerySchema, sortDirections, ticketSortFields } from "./list-tickets.dto";

const booleanQueryParam = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (value === true || value === "true" || value === "1") {
    return true;
  }
  if (value === false || value === "false" || value === "0") {
    return false;
  }
  return value;
}, z.boolean().optional());

export const SearchTicketsQuerySchema = ListTicketsQuerySchema.extend({
  q: z.string().trim().min(1).max(TICKET_SEARCH_QUERY_MAX_LENGTH).optional(),
  hasAttachments: booleanQueryParam,
  hasComments: booleanQueryParam,
});

export type SearchTicketsQueryDto = z.infer<typeof SearchTicketsQuerySchema>;

export function validateSearchTicketsQuery(query: unknown): SearchTicketsQueryDto {
  const result = SearchTicketsQuerySchema.safeParse(query);
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

/** OpenAPI-visible query documentation for GET /api/v1/tickets/search. */
export class SearchTicketsQueryApiDto {
  @ApiPropertyOptional({
    description:
      "Case-insensitive partial match across publicRef, title, description, requester name/email",
    example: "vpn",
    maxLength: TICKET_SEARCH_QUERY_MAX_LENGTH,
    type: String,
  })
  q?: string;

  @ApiPropertyOptional({
    description: "Page number (1-based)",
    example: 1,
    minimum: 1,
    type: Number,
  })
  page?: number;

  @ApiPropertyOptional({
    description: "Page size (max 100)",
    example: 20,
    maximum: 100,
    minimum: 1,
    type: Number,
  })
  pageSize?: number;

  @ApiPropertyOptional({
    description: "Sort field",
    enum: ticketSortFields,
    example: "createdAt",
  })
  sortBy?: (typeof ticketSortFields)[number];

  @ApiPropertyOptional({
    description: "Sort direction",
    enum: sortDirections,
    example: "desc",
  })
  sortDir?: (typeof sortDirections)[number];

  @ApiPropertyOptional({
    description: "CSV of ticket statuses",
    example: "NEW,OPEN",
    type: String,
  })
  status?: string;

  @ApiPropertyOptional({
    description: "CSV of priorities",
    enum: TicketPriority,
    example: "HIGH,URGENT",
    type: String,
  })
  priority?: string;

  @ApiPropertyOptional({
    description: "CSV of types",
    enum: TicketType,
    example: "INCIDENT",
    type: String,
  })
  type?: string;

  @ApiPropertyOptional({
    description: "CSV of channels",
    enum: TicketChannel,
    example: "WEB,EMAIL",
    type: String,
  })
  channel?: string;

  @ApiPropertyOptional({
    description: "CSV of assignee user UUIDs",
    example: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    type: String,
  })
  assigneeUserId?: string;

  @ApiPropertyOptional({
    description: "CSV of requester user UUIDs",
    example: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    type: String,
  })
  requesterUserId?: string;

  @ApiPropertyOptional({
    description: "CSV of assignment group UUIDs",
    example: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    type: String,
  })
  assignedGroupId?: string;

  @ApiPropertyOptional({
    description: "Created-at lower bound (ISO-8601)",
    example: "2026-01-01T00:00:00.000Z",
    type: String,
  })
  createdAfter?: string;

  @ApiPropertyOptional({
    description: "Created-at upper bound (ISO-8601)",
    example: "2026-12-31T23:59:59.999Z",
    type: String,
  })
  createdBefore?: string;

  @ApiPropertyOptional({
    description: "Updated-at lower bound (ISO-8601)",
    example: "2026-01-01T00:00:00.000Z",
    type: String,
  })
  updatedAfter?: string;

  @ApiPropertyOptional({
    description: "Updated-at upper bound (ISO-8601)",
    example: "2026-12-31T23:59:59.999Z",
    type: String,
  })
  updatedBefore?: string;

  @ApiPropertyOptional({
    description: "Due-date lower bound (ISO-8601)",
    example: "2026-01-01T00:00:00.000Z",
    type: String,
  })
  dueAfter?: string;

  @ApiPropertyOptional({
    description: "Due-date upper bound (ISO-8601)",
    example: "2026-12-31T23:59:59.999Z",
    type: String,
  })
  dueBefore?: string;

  @ApiPropertyOptional({
    description: "When true, only tickets with at least one non-deleted attachment",
    example: true,
    type: Boolean,
  })
  hasAttachments?: boolean;

  @ApiPropertyOptional({
    description: "When true, only tickets with at least one non-deleted comment",
    example: true,
    type: Boolean,
  })
  hasComments?: boolean;
}
