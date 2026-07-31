import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TicketChannel, TicketPriority, TicketStatus, TicketType } from "@prisma/client";

import type { TicketAggregate } from "../domain/ticket.aggregate";

export class TicketResponseDto {
  @ApiProperty({
    description: "Unique system ID of the ticket",
    example: "a0000000-0000-0000-0000-000000000001",
    type: String,
  })
  id!: string;

  @ApiProperty({
    description: "Tenant ID owning the ticket",
    example: "b0000000-0000-0000-0000-000000000002",
    type: String,
  })
  tenantId!: string;

  @ApiProperty({
    description: "Human-readable public reference code",
    example: "TKT-1001",
    type: String,
  })
  publicRef!: string;

  @ApiProperty({
    description: "Ticket title",
    example: "Cannot connect to VPN from macOS client",
    type: String,
  })
  title!: string;

  @ApiProperty({
    description: "Ticket description",
    example: "Detailed description of the problem...",
    type: String,
  })
  description!: string;

  @ApiProperty({
    enum: TicketStatus,
    example: TicketStatus.NEW,
  })
  status!: TicketStatus;

  @ApiProperty({
    enum: TicketPriority,
    example: TicketPriority.MEDIUM,
  })
  priority!: TicketPriority;

  @ApiProperty({
    enum: TicketChannel,
    example: TicketChannel.WEB,
  })
  channel!: TicketChannel;

  @ApiProperty({
    enum: TicketType,
    example: TicketType.QUESTION,
  })
  type!: TicketType;

  @ApiProperty({
    description: "Requester user ID",
    example: "c0000000-0000-0000-0000-000000000003",
    type: String,
  })
  requesterUserId!: string;

  @ApiPropertyOptional({
    description: "Assigned agent user ID if assigned",
    example: "d0000000-0000-0000-0000-000000000004",
    nullable: true,
    type: String,
  })
  assigneeUserId?: string | null;

  @ApiPropertyOptional({
    description: "Assigned team group ID if assigned",
    example: "e0000000-0000-0000-0000-000000000005",
    nullable: true,
    type: String,
  })
  assignedGroupId?: string | null;

  @ApiPropertyOptional({
    description: "Timestamp when ticket was solved",
    nullable: true,
    type: String,
  })
  solvedAt?: string | null;

  @ApiPropertyOptional({
    description: "Timestamp when ticket was closed",
    nullable: true,
    type: String,
  })
  closedAt?: string | null;

  @ApiPropertyOptional({
    description: "Target resolution due date",
    nullable: true,
    type: String,
  })
  dueDate?: string | null;

  @ApiProperty({
    description: "Optimistic concurrency version number",
    example: 1,
    type: Number,
  })
  version!: number;

  @ApiProperty({
    description: "Timestamp when ticket was created",
    type: String,
  })
  createdAt!: string;

  @ApiProperty({
    description: "Timestamp when ticket was last updated",
    type: String,
  })
  updatedAt!: string;

  static fromDomain(aggregate: TicketAggregate): TicketResponseDto {
    const dto = new TicketResponseDto();
    dto.id = aggregate.id;
    dto.tenantId = aggregate.tenantId;
    dto.publicRef = aggregate.publicRef;
    dto.title = aggregate.title;
    dto.description = aggregate.description;
    dto.status = aggregate.status;
    dto.priority = aggregate.priority;
    dto.channel = aggregate.channel;
    dto.type = aggregate.type;
    dto.requesterUserId = aggregate.requesterUserId;
    dto.assigneeUserId = aggregate.assigneeUserId ?? null;
    dto.assignedGroupId = aggregate.assignedGroupId ?? null;
    dto.solvedAt = aggregate.solvedAt ? aggregate.solvedAt.toISOString() : null;
    dto.closedAt = aggregate.closedAt ? aggregate.closedAt.toISOString() : null;
    dto.dueDate = aggregate.dueDate ? aggregate.dueDate.toISOString() : null;
    dto.version = aggregate.version;
    dto.createdAt = aggregate.createdAt.toISOString();
    dto.updatedAt = aggregate.updatedAt.toISOString();
    return dto;
  }
}
