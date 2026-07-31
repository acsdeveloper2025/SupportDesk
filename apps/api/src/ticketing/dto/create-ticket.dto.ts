import { BadRequestException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TicketChannel, TicketPriority, TicketType } from "@prisma/client";

export class CreateTicketRequestDto {
  @ApiProperty({
    description: "Short title summarizing the support request",
    example: "Cannot connect to VPN from macOS client",
    maxLength: 255,
  })
  title!: string;

  @ApiProperty({
    description: "Detailed description of the support issue or request",
    example:
      "When clicking connect in the VPN client, it hangs on authenticating and returns error code 504.",
  })
  description!: string;

  @ApiPropertyOptional({
    default: TicketPriority.MEDIUM,
    enum: TicketPriority,
    description: "Urgency priority level of the ticket",
  })
  priority?: TicketPriority;

  @ApiPropertyOptional({
    default: TicketChannel.WEB,
    enum: TicketChannel,
    description: "Source channel where the ticket originated",
  })
  channel?: TicketChannel;

  @ApiPropertyOptional({
    default: TicketType.QUESTION,
    enum: TicketType,
    description: "Classification type of the ticket",
  })
  type?: TicketType;

  @ApiPropertyOptional({
    description: "Optional agent user ID assigned to the ticket",
    example: "11111111-1111-1111-1111-111111111111",
  })
  assigneeUserId?: string;

  @ApiPropertyOptional({
    description: "Optional group ID assigned to the ticket",
    example: "22222222-2222-2222-2222-222222222222",
  })
  assignedGroupId?: string;

  @ApiPropertyOptional({
    description: "Optional target due date for resolution",
    example: "2026-12-31T23:59:59.000Z",
  })
  dueDate?: string;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateCreateTicketPayload(body: CreateTicketRequestDto): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }

  if (typeof body.title !== "string" || !body.title.trim()) {
    throw new BadRequestException("Ticket title is required");
  }

  if (body.title.trim().length > 255) {
    throw new BadRequestException("Ticket title cannot exceed 255 characters");
  }

  if (typeof body.description !== "string" || !body.description.trim()) {
    throw new BadRequestException("Ticket description is required");
  }

  if (body.priority && !Object.values(TicketPriority).includes(body.priority)) {
    throw new BadRequestException(`Invalid ticket priority: ${body.priority}`);
  }

  if (body.channel && !Object.values(TicketChannel).includes(body.channel)) {
    throw new BadRequestException(`Invalid ticket channel: ${body.channel}`);
  }

  if (body.type && !Object.values(TicketType).includes(body.type)) {
    throw new BadRequestException(`Invalid ticket type: ${body.type}`);
  }

  if (body.assigneeUserId && !uuidPattern.test(body.assigneeUserId)) {
    throw new BadRequestException("assigneeUserId must be a valid UUID");
  }

  if (body.assignedGroupId && !uuidPattern.test(body.assignedGroupId)) {
    throw new BadRequestException("assignedGroupId must be a valid UUID");
  }

  if (body.dueDate) {
    const parsed = Date.parse(body.dueDate);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException("dueDate must be a valid ISO date string");
    }
  }
}
