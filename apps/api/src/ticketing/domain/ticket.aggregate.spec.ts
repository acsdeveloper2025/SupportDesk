import { BadRequestException } from "@nestjs/common";
import { TicketChannel, TicketPriority, TicketStatus, TicketType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  ClosedTicketAssignmentException,
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

  const agentUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const groupId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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

  // ── Issue #20: Assignment Domain Tests ──────────────────────────────

  it("assigns a user to an unassigned ticket and increments version", () => {
    const ticket = TicketAggregate.create(validParams);
    expect(ticket.assigneeUserId).toBeNull();
    expect(ticket.version).toBe(1);

    const { previousAssigneeUserId } = ticket.assign({ assigneeUserId: agentUserId }, 1);

    expect(ticket.assigneeUserId).toBe(agentUserId);
    expect(ticket.version).toBe(2);
    expect(previousAssigneeUserId).toBeNull();
  });

  it("assigns a group to an unassigned ticket and increments version", () => {
    const ticket = TicketAggregate.create(validParams);

    const { previousAssignedGroupId } = ticket.assign({ assignedGroupId: groupId }, 1);

    expect(ticket.assignedGroupId).toBe(groupId);
    expect(ticket.version).toBe(2);
    expect(previousAssignedGroupId).toBeNull();
  });

  it("reassigns a ticket to a different user and returns previous assignee", () => {
    const ticket = TicketAggregate.create(validParams);
    ticket.assign({ assigneeUserId: agentUserId }, 1);
    const newAgent = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

    const { previousAssigneeUserId } = ticket.assign({ assigneeUserId: newAgent }, 2);

    expect(ticket.assigneeUserId).toBe(newAgent);
    expect(ticket.version).toBe(3);
    expect(previousAssigneeUserId).toBe(agentUserId);
  });

  it("unassigns a ticket and clears both assignee and group", () => {
    const ticket = TicketAggregate.create(validParams);
    ticket.assign({ assignedGroupId: groupId, assigneeUserId: agentUserId }, 1);

    const { previousAssigneeUserId, previousAssignedGroupId } = ticket.unassign(2);

    expect(ticket.assigneeUserId).toBeNull();
    expect(ticket.assignedGroupId).toBeNull();
    expect(ticket.version).toBe(3);
    expect(previousAssigneeUserId).toBe(agentUserId);
    expect(previousAssignedGroupId).toBe(groupId);
  });

  it("throws ClosedTicketAssignmentException when assigning a CLOSED ticket", () => {
    const ticket = TicketAggregate.create(validParams);
    ticket.transitionTo(TicketStatus.OPEN, 1);
    ticket.transitionTo(TicketStatus.SOLVED, 2);
    ticket.transitionTo(TicketStatus.CLOSED, 3);

    expect(() => ticket.assign({ assigneeUserId: agentUserId }, 4)).toThrow(
      ClosedTicketAssignmentException,
    );
  });

  it("throws ClosedTicketAssignmentException when unassigning a CLOSED ticket", () => {
    const ticket = TicketAggregate.create(validParams);
    ticket.assign({ assigneeUserId: agentUserId }, 1);
    ticket.transitionTo(TicketStatus.OPEN, 2);
    ticket.transitionTo(TicketStatus.SOLVED, 3);
    ticket.transitionTo(TicketStatus.CLOSED, 4);

    expect(() => ticket.unassign(5)).toThrow(ClosedTicketAssignmentException);
  });

  it("throws BadRequestException when assigning an invalid UUID as assigneeUserId", () => {
    const ticket = TicketAggregate.create(validParams);

    expect(() => ticket.assign({ assigneeUserId: "not-a-uuid" }, 1)).toThrow(BadRequestException);
  });

  it("throws TicketConcurrencyException on version mismatch during assign", () => {
    const ticket = TicketAggregate.create(validParams);

    expect(() => ticket.assign({ assigneeUserId: agentUserId }, 99)).toThrow(
      TicketConcurrencyException,
    );
  });

  it("throws TicketConcurrencyException on version mismatch during unassign", () => {
    const ticket = TicketAggregate.create(validParams);
    ticket.assign({ assigneeUserId: agentUserId }, 1);

    expect(() => ticket.unassign(99)).toThrow(TicketConcurrencyException);
  });
});
