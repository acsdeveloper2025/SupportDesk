import { TicketPriority, TicketType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventInput } from "../audit/audit-event";
import { TicketAggregate } from "./domain/ticket.aggregate";
import { TicketsRepository } from "./tickets.repository";

/**
 * Regression tests for count-based publicRef generation: refs collide whenever
 * a ticket is deleted while a higher ref remains (count drops but the ref is
 * still taken), so the retry path must recompute a fresh ref per attempt
 * instead of retrying the same colliding ref until the attempt cap.
 */
describe("TicketsRepository.createWithAudit publicRef collision handling", () => {
  const tenantId = "11111111-1111-1111-1111-111111111111";
  const requesterUserId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

  const audit: AuditEventInput = {
    action: "ticket.created",
    actorUserId: requesterUserId,
    correlationId: "corr-1",
    outcome: "SUCCESS",
    targetId: "ticket-id-1",
    targetType: "ticket",
    tenantId,
  };

  function makeAggregate(id: string): TicketAggregate {
    return TicketAggregate.create({
      id,
      tenantId,
      publicRef: "PENDING",
      title: "Collision test",
      description: "x",
      requesterUserId,
      priority: TicketPriority.HIGH,
      type: TicketType.INCIDENT,
    });
  }

  function fullRecord(data: { publicRef: string; id: string }) {
    return {
      ...data,
      tenantId,
      title: "Collision test",
      description: "x",
      requesterUserId,
      priority: "high",
      channel: "web",
      type: "incident",
      status: "new",
      assignedGroupId: null,
      assigneeUserId: null,
      solvedAt: null,
      closedAt: null,
      dueDate: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
  }

  it("retries with an offset ref when the first insert hits a unique-constraint collision", async () => {
    const usedRefs: string[] = [];
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
        const count = 5; // tenant currently holds TKT-1006..TKT-1010, but TKT-1006 is taken elsewhere
        const attempts = {
          ticket: {
            count: vi.fn(() => count),
            create: vi.fn((call: { data: { publicRef: string; id: string } }) => {
              usedRefs.push(call.data.publicRef);
              if (call.data.publicRef === "TKT-1006") {
                const err = new Error(
                  "Unique constraint failed on the fields: (`tenant_id`,`public_ref`)",
                ) as Error & { code?: string };
                err.code = "P2002";
                throw err;
              }
              return fullRecord(call.data);
            }),
          },
          auditEvent: { create: vi.fn(() => ({})) },
        };
        return callback(attempts);
      }),
    };
    const repository = new TicketsRepository(prisma as never);

    const created = await repository.createWithAudit(makeAggregate("ticket-id-1"), audit);

    expect(created.publicRef).toBe("TKT-1007");
    expect(usedRefs).toEqual(["TKT-1006", "TKT-1007"]);
  });

  it("uses the count-derived ref on the first attempt when no collision occurs", async () => {
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          ticket: {
            count: vi.fn(() => 5),
            create: vi.fn((call: { data: { publicRef: string; id: string } }) =>
              fullRecord(call.data),
            ),
          },
          auditEvent: { create: vi.fn(() => ({})) },
        };
        return callback(tx);
      }),
    };
    const repository = new TicketsRepository(prisma as never);

    const created = await repository.createWithAudit(makeAggregate("ticket-id-2"), audit);

    expect(created.publicRef).toBe("TKT-1006");
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });
});
