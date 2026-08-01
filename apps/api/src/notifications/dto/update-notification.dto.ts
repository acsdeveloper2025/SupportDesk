import { BadRequestException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";

export const UpdateNotificationRequestSchema = z
  .object({
    archived: z.boolean().optional(),
    read: z.boolean().optional(),
    version: z.number().int().min(1),
  })
  .refine((value) => value.read !== undefined || value.archived !== undefined, {
    message: "At least one of read or archived must be provided",
  });

export type UpdateNotificationRequest = z.infer<typeof UpdateNotificationRequestSchema>;

export class UpdateNotificationRequestDto {
  @ApiPropertyOptional({ description: "Mark notification read (true) or unread (false)." })
  read?: boolean;

  @ApiPropertyOptional({ description: "Archive (true) or unarchive (false)." })
  archived?: boolean;

  @ApiProperty({ description: "Optimistic concurrency version.", minimum: 1 })
  version!: number;
}

export function parseUpdateNotificationRequest(body: unknown): UpdateNotificationRequest {
  const parsed = UpdateNotificationRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({
      code: "VALIDATION_FAILED",
      details: parsed.error.flatten(),
      message: "Invalid notification update request",
    });
  }
  return parsed.data;
}
