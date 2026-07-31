import { BadRequestException } from "@nestjs/common";
import { TicketChannel, TicketPriority, TicketStatus, TicketType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  InvalidTicketTransitionException,
  TicketAggregate,
  TicketConcurrencyException,
} from "./ticket.aggregate";

describe("TicketAggregate (T-DOM Domain Unit Tests)", () => {
  const validParams = {
    description: "My printer is emitting smoke when printing PDF files.",
    id: "10000000-0000-0000-0000-000000000001",
    publicRef: "TKT-1001",
    requesterUserId: "20000000-0000-0000-0000-000000000002",
    tenantId: "30000000-0000-0000-0000-000000000003",
    title: "Printer Hardware Error",
  };

  it("creates a valid initial Ticket aggregate in NEW status with version 1", () => {
    const ticket = TicketAggregate.create(validParams);

    expect(ticket.id).toBe(validParams.id);
    expect(ticket.tenantId).toBe(validParams.tenantId);
    expect(ticket.publicRef).toBe("TKT-1001");
    expect(ticket.title).toBe("Printer Hardware Error");
    expect(ticket.status).toBe(TicketStatus.NEW);
    expect(ticket.priority).toBe(TicketPriority.MEDIUM);
    expect(ticket.channel).toBe(TicketChannel.WEB);
    expect(ticket.type).toBe(TicketType.QUESTION);
    expect(ticket.version).toBe(1);
    expect(ticket.createdAt).toBeInstanceOf(Date);
  });

  it("throws validation exception when required fields are missing", () => {
    expect(() =>
      TicketAggregate.create({
        ...validParams,
        title: "",
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      TicketAggregate.create({
        ...validParams,
        description: "   ",
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      TicketAggregate.create({
        ...validParams,
        tenantId: "",
      }),
    ).toThrow(BadRequestException);
  });

  it("allows valid status transitions and increments version", () => {
    const ticket = TicketAggregate.create(validParams);
    expect(ticket.version).toBe(1);

    // NEW -> OPEN
    ticket.transitionTo(TicketStatus.OPEN, 1);
    expect(ticket.status).toBe(TicketStatus.OPEN);
    expect(ticket.version).toBe(2);

    // OPEN -> PENDING
    ticket.transitionTo(TicketStatus.PENDING, 2);
    expect(ticket.status).toBe(TicketStatus.PENDING);
    expect(ticket.version).toBe(3);

    // PENDING -> SOLVED
    ticket.transitionTo(TicketStatus.SOLVED, 3);
    expect(ticket.status).toBe(TicketStatus.SOLVED);
    expect(ticket.version).toBe(4);
    expect(ticket.solvedAt).toBeInstanceOf(Date);

    // SOLVED -> CLOSED
    ticket.transitionTo(TicketStatus.CLOSED, 4);
    expect(ticket.status).toBe(TicketStatus.CLOSED);
    expect(ticket.version).toBe(5);
    expect(ticket.closedAt).toBeInstanceOf(Date);
  });

  it("denies invalid status transitions", () => {
    const ticket = TicketAggregate.create(validParams);

    // NEW -> PENDING is invalid
    expect(() => ticket.transitionTo(TicketStatus.PENDING, 1)).toThrow(
      InvalidTicketTransitionException,
    );

    // NEW -> OPEN
    ticket.transitionTo(TicketStatus.OPEN, 1);

    // OPEN -> CLOSED is invalid without SOLVED
    expect(() => ticket.transitionTo(TicketStatus.CLOSED, 2)).toThrow(
      InvalidTicketTransitionException,
    );
  });

  it("prevents any transition from terminal CLOSED status", () => {
    const ticket = TicketAggregate.create(validParams);
    ticket.transitionTo(TicketStatus.OPEN, 1);
    ticket.transitionTo(TicketStatus.SOLVED, 2);
    ticket.transitionTo(TicketStatus.CLOSED, 3);

    expect(() => ticket.transitionTo(TicketStatus.OPEN, 4)).toThrow(
      InvalidTicketTransitionException,
    );
  });

  it("enforces optimistic concurrency version checks", () => {
    const ticket = TicketAggregate.create(validParams);

    // Passing wrong expected version should throw
    expect(() => ticket.transitionTo(TicketStatus.OPEN, 999)).toThrow(TicketConcurrencyException);

    expect(() => ticket.updateFields({ title: "Updated Title" }, 999)).toThrow(
      TicketConcurrencyException,
    );
  });

  it("updates fields correctly and bumps version", () => {
    const ticket = TicketAggregate.create(validParams);
    expect(ticket.version).toBe(1);

    ticket.updateFields(
      {
        priority: TicketPriority.URGENT,
        title: "Critical Printer Fire",
        type: TicketType.INCIDENT,
      },
      1,
    );

    expect(ticket.title).toBe("Critical Printer Fire");
    expect(ticket.priority).toBe(TicketPriority.URGENT);
    expect(ticket.type).toBe(TicketType.INCIDENT);
    expect(ticket.version).toBe(2);
  });
});
