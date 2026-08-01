import { BadRequestException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import type {
  WorkflowAction,
  WorkflowCondition,
  WorkflowTrigger,
} from "../domain/workflow-definition";

export class CreateWorkflowRequestDto {
  @ApiProperty({ example: "route-high-priority" })
  key!: string;

  @ApiProperty({ example: "Route high priority tickets" })
  name!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ example: 100 })
  priority!: number;

  @ApiProperty({
    example: [{ type: "ticket.created" }],
    type: "array",
  })
  triggers!: WorkflowTrigger[];

  @ApiPropertyOptional({
    example: [{ field: "priority", operator: "eq", ordinal: 0, value: "high" }],
    type: "array",
  })
  conditions?: WorkflowCondition[];

  @ApiProperty({
    example: [
      { ordinal: 0, params: { status: "open" }, type: "change_status" },
      { ordinal: 1, params: { body: "routed" }, type: "add_internal_comment" },
    ],
    type: "array",
  })
  actions!: WorkflowAction[];
}

export class UpdateWorkflowDraftRequestDto {
  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiPropertyOptional()
  priority?: number;

  @ApiPropertyOptional({ type: "array" })
  triggers?: WorkflowTrigger[];

  @ApiPropertyOptional({ type: "array" })
  conditions?: WorkflowCondition[];

  @ApiPropertyOptional({ type: "array" })
  actions?: WorkflowAction[];
}

export class PauseWorkflowRequestDto {
  @ApiPropertyOptional({ example: "Maintenance window" })
  reason?: string;
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

export function requireArray(body: Record<string, unknown>, key: string): unknown[] {
  const value = body[key];
  if (!Array.isArray(value)) {
    throw new BadRequestException(`${key} must be an array`);
  }
  return value;
}

export function optionalArray(body: Record<string, unknown>, key: string): unknown[] | undefined {
  if (body[key] === undefined || body[key] === null) {
    return undefined;
  }
  return requireArray(body, key);
}
