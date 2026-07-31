import { BadRequestException } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";

/**
 * Request body for POST /api/v1/tickets/:id/unassign.
 *
 * Clears both the assignee user and assigned group.
 * {@link version} is required for optimistic concurrency.
 */
export class UnassignTicketRequestDto {
  @ApiProperty({
    description:
      "Expected ticket version for optimistic concurrency check. Must match the current persisted version.",
    example: 1,
    minimum: 1,
  })
  version!: number;
}

/**
 * Validates the unassign-ticket request body.
 * Throws {@link BadRequestException} on any violation.
 */
export function validateUnassignTicketPayload(body: Record<string, unknown>): void {
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
}
