import { BadRequestException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TicketChannel, TicketPriority, TicketType } from "@prisma/client";

export class UpdateTicketRequestDto {
  @ApiProperty({
    description: "Expected ticket version number for optimistic concurrency check",
    example: 1,
  })
  version!: number;

  @ApiPropertyOptional({
    description: "Updated title summarizing the support request",
    example: "Cannot connect to VPN from macOS client (Updated)",
    maxLength: 255,
  })
  title?: string;

  @ApiPropertyOptional({
    description: "Updated description of the support issue",
  })
  description?: string;

  @ApiPropertyOptional({
    enum: TicketPriority,
    description: "Updated priority level",
  })
  priority?: TicketPriority;

  @ApiPropertyOptional({
    enum: TicketChannel,
    description: "Updated origin channel",
  })
  channel?: TicketChannel;

  @ApiPropertyOptional({
    enum: TicketType,
    description: "Updated ticket type classification",
  })
  type?: TicketType;

  @ApiPropertyOptional({
    description: "Assigned agent user ID (UUID) or null to unassign",
    example: "11111111-1111-1111-1111-111111111111",
    nullable: true,
  })
  assigneeUserId?: string | null;

  @ApiPropertyOptional({
    description: "Assigned group ID (UUID) or null to unassign group",
    example: "22222222-2222-2222-2222-222222222222",
    nullable: true,
  })
  assignedGroupId?: string | null;

  @ApiPropertyOptional({
    description: "Target due date (ISO string) or null to clear",
    example: "2026-12-31T23:59:59.000Z",
    nullable: true,
  })
  dueDate?: string | null;
}

const IMMUTABLE_FIELDS = [
  "id",
  "publicRef",
  "tenantId",
  "requesterUserId",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "status",
  "solvedAt",
  "closedAt",
];

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateUpdateTicketPayload(body: Record<string, unknown>): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }

  for (const field of IMMUTABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      throw new BadRequestException(`Attempted to update immutable field: ${field}`);
    }
  }

  if (
    body.version === undefined ||
    body.version === null ||
    typeof body.version !== "number" ||
    !Number.isInteger(body.version) ||
    body.version < 1
  ) {
    throw new BadRequestException("expected version number (integer >= 1) is required");
  }

  const editableFields = [
    "title",
    "description",
    "priority",
    "channel",
    "type",
    "assigneeUserId",
    "assignedGroupId",
    "dueDate",
  ];

  const hasEditableField = editableFields.some(
    (field) => Object.prototype.hasOwnProperty.call(body, field) && body[field] !== undefined,
  );

  if (!hasEditableField) {
    throw new BadRequestException("At least one field to update must be provided");
  }

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      throw new BadRequestException("Ticket title cannot be empty");
    }
    if (body.title.trim().length > 255) {
      throw new BadRequestException("Ticket title cannot exceed 255 characters");
    }
  }

  if (body.description !== undefined) {
    if (typeof body.description !== "string" || !body.description.trim()) {
      throw new BadRequestException("Ticket description cannot be empty");
    }
  }

  if (
    body.priority !== undefined &&
    !Object.values(TicketPriority).includes(body.priority as TicketPriority)
  ) {
    const val = body.priority;
    const strVal = typeof val === "string" ? val : JSON.stringify(val);
    throw new BadRequestException(`Invalid ticket priority: ${strVal}`);
  }

  if (
    body.channel !== undefined &&
    !Object.values(TicketChannel).includes(body.channel as TicketChannel)
  ) {
    const val = body.channel;
    const strVal = typeof val === "string" ? val : JSON.stringify(val);
    throw new BadRequestException(`Invalid ticket channel: ${strVal}`);
  }

  if (body.type !== undefined && !Object.values(TicketType).includes(body.type as TicketType)) {
    const val = body.type;
    const strVal = typeof val === "string" ? val : JSON.stringify(val);
    throw new BadRequestException(`Invalid ticket type: ${strVal}`);
  }

  if (body.assigneeUserId !== undefined && body.assigneeUserId !== null) {
    if (typeof body.assigneeUserId !== "string" || !uuidPattern.test(body.assigneeUserId)) {
      throw new BadRequestException("assigneeUserId must be a valid UUID or null");
    }
  }

  if (body.assignedGroupId !== undefined && body.assignedGroupId !== null) {
    if (typeof body.assignedGroupId !== "string" || !uuidPattern.test(body.assignedGroupId)) {
      throw new BadRequestException("assignedGroupId must be a valid UUID or null");
    }
  }

  if (body.dueDate !== undefined && body.dueDate !== null) {
    if (typeof body.dueDate !== "string" || Number.isNaN(Date.parse(body.dueDate))) {
      throw new BadRequestException("dueDate must be a valid ISO date string or null");
    }
  }
}
