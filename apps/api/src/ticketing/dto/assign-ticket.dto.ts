import { BadRequestException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Request body for POST /api/v1/tickets/:id/assign
 * and POST /api/v1/tickets/reference/:publicRef/assign.
 *
 * Ticket Module v1 requires {@link assigneeUserId}. Non-null {@link assignedGroupId}
 * is rejected until Organizations/Groups ship (ADR-0008).
 * {@link version} is required for optimistic concurrency.
 */
export class AssignTicketRequestDto {
  @ApiProperty({
    description:
      "Expected ticket version for optimistic concurrency check. Must match the current persisted version.",
    example: 1,
    minimum: 1,
  })
  version!: number;

  @ApiProperty({
    description: "UUID of the user to assign the ticket to.",
    example: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  })
  assigneeUserId!: string;

  @ApiPropertyOptional({
    description:
      "Reserved for future group assignment. Non-null values are rejected until Organizations/Groups ship (ADR-0008).",
    example: null,
    nullable: true,
  })
  assignedGroupId?: string | null;
}

/**
 * Validates the assign-ticket request body.
 * Throws {@link BadRequestException} on any violation.
 */
export function validateAssignTicketPayload(body: Record<string, unknown>): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestException("Request body must be an object");
  }

  if (
    body["version"] === undefined ||
    body["version"] === null ||
    typeof body["version"] !== "number" ||
    !Number.isInteger(body["version"]) ||
    body["version"] < 1
  ) {
    throw new BadRequestException("expected version number (integer >= 1) is required");
  }

  if (
    body["assigneeUserId"] === undefined ||
    body["assigneeUserId"] === null ||
    typeof body["assigneeUserId"] !== "string" ||
    !uuidPattern.test(body["assigneeUserId"])
  ) {
    throw new BadRequestException("assigneeUserId is required and must be a valid UUID");
  }

  if (
    Object.prototype.hasOwnProperty.call(body, "assignedGroupId") &&
    body["assignedGroupId"] !== undefined &&
    body["assignedGroupId"] !== null
  ) {
    throw new BadRequestException(
      "assignedGroupId is not supported until Organizations/Groups are implemented",
    );
  }
}
