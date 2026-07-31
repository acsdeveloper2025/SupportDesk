import { BadRequestException } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { TicketStatus } from "@prisma/client";

/**
 * Request body for POST /api/v1/tickets/:id/status
 * and POST /api/v1/tickets/reference/:publicRef/status.
 *
 * Enforces optimistic concurrency by requiring the caller to supply
 * the expected ticket version.  The target status must be a valid member
 * of the TicketStatus enum; transition-rule validation is performed inside
 * the domain aggregate.
 */
export class TransitionTicketStatusDto {
  @ApiProperty({
    description:
      "Expected ticket version for optimistic concurrency check.  Must match the current persisted version.",
    example: 1,
    minimum: 1,
  })
  version!: number;

  @ApiProperty({
    description: "Target lifecycle status to transition to.",
    enum: TicketStatus,
    example: TicketStatus.OPEN,
  })
  status!: TicketStatus;
}

/**
 * Validates the transition-status request body.
 *
 * Throws {@link BadRequestException} on any violation so NestJS maps it
 * to a 400 response automatically.
 */
export function validateTransitionStatusPayload(body: Record<string, unknown>): void {
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

  if (body["status"] === undefined || body["status"] === null) {
    throw new BadRequestException("target status is required");
  }

  if (!Object.values(TicketStatus).includes(body["status"] as TicketStatus)) {
    const val = body["status"];
    const strVal = typeof val === "string" ? val : JSON.stringify(val);
    throw new BadRequestException(`Invalid target status: ${strVal}`);
  }
}
