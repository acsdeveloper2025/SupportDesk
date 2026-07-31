import { BadRequestException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Request body for POST /api/v1/tickets/:id/assign
 * and POST /api/v1/tickets/reference/:publicRef/assign.
 *
 * At least one of {@link assigneeUserId} or {@link assignedGroupId} must be
 * provided (or both).  Use the unassign endpoint to clear assignments.
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

  @ApiPropertyOptional({
    description: "UUID of the user to assign the ticket to, or null to clear the user assignment.",
    example: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    nullable: true,
  })
  assigneeUserId?: string | null;

  @ApiPropertyOptional({
    description:
      "UUID of the group/team to assign the ticket to, or null to clear group assignment.",
    example: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
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

  const hasAssignee =
    Object.prototype.hasOwnProperty.call(body, "assigneeUserId") &&
    body["assigneeUserId"] !== undefined;
  const hasGroup =
    Object.prototype.hasOwnProperty.call(body, "assignedGroupId") &&
    body["assignedGroupId"] !== undefined;

  if (!hasAssignee && !hasGroup) {
    throw new BadRequestException(
      "At least one of assigneeUserId or assignedGroupId must be provided",
    );
  }

  if (hasAssignee && body["assigneeUserId"] !== null) {
    if (typeof body["assigneeUserId"] !== "string" || !uuidPattern.test(body["assigneeUserId"])) {
      throw new BadRequestException("assigneeUserId must be a valid UUID or null");
    }
  }

  if (hasGroup && body["assignedGroupId"] !== null) {
    if (typeof body["assignedGroupId"] !== "string" || !uuidPattern.test(body["assignedGroupId"])) {
      throw new BadRequestException("assignedGroupId must be a valid UUID or null");
    }
  }
}
