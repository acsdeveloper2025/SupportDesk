import { BadRequestException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateBusinessScheduleRequestDto {
  @ApiPropertyOptional({ example: "default" })
  key?: string;

  @ApiProperty({ example: "Default business hours" })
  name!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ example: "America/New_York" })
  timeZone!: string;

  @ApiPropertyOptional({
    description: "Weekly windows keyed by mon..sun with {start,end} HH:mm pairs.",
  })
  weeklyHours?: Record<string, Array<{ start: string; end: string }>>;

  @ApiPropertyOptional({ type: [String], example: ["2026-12-25"] })
  holidays?: string[];
}

export class UpdateBusinessScheduleDraftRequestDto {
  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiPropertyOptional()
  timeZone?: string;

  @ApiPropertyOptional()
  weeklyHours?: Record<string, Array<{ start: string; end: string }>>;

  @ApiPropertyOptional({ type: [String] })
  holidays?: string[];
}

export class CreateSlaPolicyRequestDto {
  @ApiProperty({ example: "default" })
  key!: string;

  @ApiProperty({ example: "Default SLA" })
  name!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ example: 100 })
  priority!: number;

  @ApiPropertyOptional({ example: "default" })
  scheduleKey?: string;

  @ApiPropertyOptional({ type: [String] })
  matchPriorities?: string[];

  @ApiPropertyOptional({ type: [String] })
  matchTypes?: string[];

  @ApiPropertyOptional({ type: [String] })
  matchChannels?: string[];

  @ApiProperty({ example: 60 })
  responseMinutes!: number;

  @ApiProperty({ example: 480 })
  resolutionMinutes!: number;

  @ApiPropertyOptional({ default: true })
  pauseOnPending?: boolean;

  @ApiPropertyOptional({ default: false })
  pauseOnHold?: boolean;

  @ApiPropertyOptional({ default: false })
  restartResolutionOnReopen?: boolean;

  @ApiPropertyOptional({ default: 80 })
  warningThresholdPercent?: number;
}

export class UpdateSlaPolicyDraftRequestDto {
  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiPropertyOptional()
  priority?: number;

  @ApiPropertyOptional()
  scheduleKey?: string;

  @ApiPropertyOptional({ type: [String] })
  matchPriorities?: string[];

  @ApiPropertyOptional({ type: [String] })
  matchTypes?: string[];

  @ApiPropertyOptional({ type: [String] })
  matchChannels?: string[];

  @ApiPropertyOptional()
  responseMinutes?: number;

  @ApiPropertyOptional()
  resolutionMinutes?: number;

  @ApiPropertyOptional()
  pauseOnPending?: boolean;

  @ApiPropertyOptional()
  pauseOnHold?: boolean;

  @ApiPropertyOptional()
  restartResolutionOnReopen?: boolean;

  @ApiPropertyOptional()
  warningThresholdPercent?: number;
}

export class ListSlaTimersQueryDto {
  @ApiPropertyOptional({ default: 1 })
  page?: string;

  @ApiPropertyOptional({ default: 25 })
  pageSize?: string;

  @ApiPropertyOptional({ description: "ISO timestamp; timers due on or before this instant." })
  dueBefore?: string;

  @ApiPropertyOptional({ description: "Comma-separated states: running,paused" })
  state?: string;
}

export class SlaMetricsQueryDto {
  @ApiPropertyOptional({ description: "ISO start instant (inclusive)." })
  from?: string;

  @ApiPropertyOptional({ description: "ISO end instant (inclusive)." })
  to?: string;
}

export function requireString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BadRequestException(`${key} is required`);
  }
  return value.trim();
}

export function optionalString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new BadRequestException(`${key} must be a string`);
  }
  return value;
}

export function requirePositiveInt(body: Record<string, unknown>, key: string): number {
  const value = body[key];
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestException(`${key} must be a positive integer`);
  }
  return parsed;
}

export function optionalPositiveInt(
  body: Record<string, unknown>,
  key: string,
): number | undefined {
  if (body[key] === undefined || body[key] === null) {
    return undefined;
  }
  return requirePositiveInt(body, key);
}

export function optionalBoolean(body: Record<string, unknown>, key: string): boolean | undefined {
  if (body[key] === undefined || body[key] === null) {
    return undefined;
  }
  if (typeof body[key] !== "boolean") {
    throw new BadRequestException(`${key} must be a boolean`);
  }
  return body[key];
}

export function optionalStringArray(
  body: Record<string, unknown>,
  key: string,
): string[] | undefined {
  if (body[key] === undefined || body[key] === null) {
    return undefined;
  }
  if (!Array.isArray(body[key]) || body[key].some((entry) => typeof entry !== "string")) {
    throw new BadRequestException(`${key} must be a string array`);
  }
  return body[key] as string[];
}

export function parsePage(value: string | undefined, fallback = 1): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException("page must be a positive integer");
  }
  return parsed;
}

export function parsePageSize(value: string | undefined, fallback = 25): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new BadRequestException("pageSize must be an integer between 1 and 100");
  }
  return parsed;
}
