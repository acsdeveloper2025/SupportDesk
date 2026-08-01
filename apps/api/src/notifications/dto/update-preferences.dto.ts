import { BadRequestException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { NotificationChannel, NotificationEventType } from "@prisma/client";
import { z } from "zod";

export const UpdateNotificationPreferencesRequestSchema = z.object({
  preferences: z
    .array(
      z.object({
        channel: z.nativeEnum(NotificationChannel).optional().default(NotificationChannel.IN_APP),
        enabled: z.boolean(),
        eventType: z.nativeEnum(NotificationEventType),
        version: z.number().int().min(1).optional(),
      }),
    )
    .min(1)
    .max(50),
});

export type UpdateNotificationPreferencesRequest = z.infer<
  typeof UpdateNotificationPreferencesRequestSchema
>;

export class UpdateNotificationPreferenceItemDto {
  @ApiProperty({ enum: NotificationEventType })
  eventType!: NotificationEventType;

  @ApiPropertyOptional({ default: NotificationChannel.IN_APP, enum: NotificationChannel })
  channel?: NotificationChannel;

  @ApiProperty()
  enabled!: boolean;

  @ApiPropertyOptional({ description: "Optimistic concurrency version when updating existing." })
  version?: number;
}

export class UpdateNotificationPreferencesRequestDto {
  @ApiProperty({ type: [UpdateNotificationPreferenceItemDto] })
  preferences!: UpdateNotificationPreferenceItemDto[];
}

export function parseUpdateNotificationPreferencesRequest(
  body: unknown,
): UpdateNotificationPreferencesRequest {
  const parsed = UpdateNotificationPreferencesRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({
      code: "VALIDATION_FAILED",
      details: parsed.error.flatten(),
      message: "Invalid notification preferences update",
    });
  }
  return parsed.data;
}
