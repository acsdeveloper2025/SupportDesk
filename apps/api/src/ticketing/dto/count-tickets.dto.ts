import { BadRequestException } from "@nestjs/common";
import { TicketChannel, TicketPriority, TicketStatus, TicketType } from "@prisma/client";
import { z } from "zod";

const csvToArray = (val: string | undefined): string[] | undefined => {
  if (!val) return undefined;
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

export const CountTicketsQuerySchema = z.object({
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

export type CountTicketsQueryDto = z.infer<typeof CountTicketsQuerySchema>;

export function validateCountTicketsQuery(query: unknown): CountTicketsQueryDto {
  const result = CountTicketsQuerySchema.safeParse(query);
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
