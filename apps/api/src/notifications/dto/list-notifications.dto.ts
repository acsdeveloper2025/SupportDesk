import { BadRequestException } from "@nestjs/common";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { NotificationEventType } from "@prisma/client";
import { z } from "zod";

export const notificationSortFields = ["createdAt"] as const;
export const sortDirections = ["asc", "desc"] as const;

const csvToArray = (val: string | undefined): string[] | undefined => {
  if (!val) return undefined;
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

const booleanQuery = z
  .union([z.literal("true"), z.literal("false"), z.boolean()])
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (typeof val === "boolean") return val;
    return val === "true";
  });

export const ListNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.enum(notificationSortFields).optional().default("createdAt"),
  sortDir: z.enum(sortDirections).optional().default("desc"),
  unreadOnly: booleanQuery,
  archived: booleanQuery,
  eventType: z
    .string()
    .optional()
    .transform(csvToArray)
    .pipe(z.array(z.nativeEnum(NotificationEventType)).optional()),
});

export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuerySchema>;

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100, minimum: 1 })
  pageSize?: number;

  @ApiPropertyOptional({ default: "createdAt", enum: notificationSortFields })
  sortBy?: (typeof notificationSortFields)[number];

  @ApiPropertyOptional({ default: "desc", enum: sortDirections })
  sortDir?: (typeof sortDirections)[number];

  @ApiPropertyOptional({ description: "When true, only unread notifications." })
  unreadOnly?: boolean;

  @ApiPropertyOptional({ description: "When true, list archived; default excludes archived." })
  archived?: boolean;

  @ApiPropertyOptional({
    description: "Comma-separated NotificationEventType values.",
    type: String,
  })
  eventType?: string;
}

export function parseListNotificationsQuery(
  query: Record<string, unknown>,
): ListNotificationsQuery {
  const parsed = ListNotificationsQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw new BadRequestException({
      code: "VALIDATION_FAILED",
      details: parsed.error.flatten(),
      message: "Invalid notification list query",
    });
  }
  return parsed.data;
}
