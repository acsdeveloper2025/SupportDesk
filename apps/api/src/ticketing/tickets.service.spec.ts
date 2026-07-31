import { NotFoundException } from "@nestjs/common";
import { TicketPriority, TicketStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditEventInput } from "../audit/audit-event";
import type { TicketAggregate } from "./domain/ticket.aggregate";
import type { TicketsRepository } from "./tickets.repository";
import { TicketsService } from "./tickets.service";

describe("TicketsService (T-DOM & T-ISO Integration/Unit Tests)", () => {
  let service: TicketsService;
  let repository: TicketsRepository;

  const tenantA = "11111111-1111-1111-1111-111111111111";
  const tenantB = "22222222-2222-2222-2222-222222222222";
  const userA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

  const store = new Map<string, TicketAggregate>();
  const auditLogs: AuditEventInput[] = [];

  beforeEach(() => {
    store.clear();
    auditLogs.length = 0;

    repository = {
      create: vi.fn((agg: TicketAggregate) => {
        const key = `${agg.tenantId}:${agg.id}`;
        store.set(key, agg);
        return Promise.resolve(agg);
      }),
      findById: vi.fn((tenantId: string, id: string) => {
        const key = `${tenantId}:${id}`;
        return Promise.resolve(store.get(key) ?? null);
      }),
      findByPublicRef: vi.fn((tenantId: string, ref: string) => {
        for (const agg of store.values()) {
          if (agg.tenantId === tenantId && agg.publicRef === ref) {
            return Promise.resolve(agg);
          }
        }
        return Promise.resolve(null);
      }),
      getNextPublicRefSequence: vi.fn((tenantId: string) => {
        let count = 0;
        for (const agg of store.values()) {
          if (agg.tenantId === tenantId) {
            count += 1;
          }
        }
        return Promise.resolve(`TKT-${count + 1001}`);
      }),
      recordAuditEvent: vi.fn((input: AuditEventInput) => {
        auditLogs.push(input);
        return Promise.resolve();
      }),
      update: vi.fn((agg: TicketAggregate) => {
        const key = `${agg.tenantId}:${agg.id}`;
        store.set(key, agg);
        return Promise.resolve(agg);
      }),
    } as unknown as TicketsRepository;

    service = new TicketsService(repository);
  });

  it("creates a ticket and records an audit event", async () => {
    const created = await service.createTicket({
      description: "Cannot connect to VPN",
      priority: TicketPriority.HIGH,
      requesterUserId: userA,
      tenantId: tenantA,
      title: "VPN Connectivity Issue",
    });

    expect(created.id).toBeDefined();
    expect(created.publicRef).toBe("TKT-1001");
    expect(created.status).toBe(TicketStatus.NEW);
    expect(created.priority).toBe(TicketPriority.HIGH);
    expect(created.version).toBe(1);

    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]?.action).toBe("ticket.created");
    expect(auditLogs[0]?.actorUserId).toBe(userA);
    expect(auditLogs[0]?.outcome).toBe("SUCCESS");
    expect(auditLogs[0]?.tenantId).toBe(tenantA);
  });

  it("retrieves a created ticket by ID or publicRef", async () => {
    const created = await service.createTicket({
      description: "Billing question regarding invoice #42",
      requesterUserId: userA,
      tenantId: tenantA,
      title: "Billing Query",
    });

    const foundById = await service.getTicketById(tenantA, created.id);
    expect(foundById.id).toBe(created.id);
    expect(foundById.title).toBe("Billing Query");

    const foundByRef = await service.getTicketByPublicRef(tenantA, "TKT-1001");
    expect(foundByRef.id).toBe(created.id);
  });

  it("enforces tenant isolation (T-ISO): Tenant B cannot view Tenant A ticket", async () => {
    const created = await service.createTicket({
      description: "Secret tenant data",
      requesterUserId: userA,
      tenantId: tenantA,
      title: "Confidential Ticket",
    });

    // Requesting under Tenant B should throw NotFoundException
    await expect(service.getTicketById(tenantB, created.id)).rejects.toThrow(NotFoundException);

    await expect(service.getTicketByPublicRef(tenantB, created.publicRef)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("updates ticket fields and records audit log", async () => {
    const created = await service.createTicket({
      description: "Software crash on launch",
      requesterUserId: userA,
      tenantId: tenantA,
      title: "App Crash",
    });

    const updated = await service.updateTicket({
      actorUserId: userA,
      expectedVersion: 1,
      priority: TicketPriority.URGENT,
      tenantId: tenantA,
      ticketId: created.id,
      title: "App Crash on macOS 15",
    });

    expect(updated.title).toBe("App Crash on macOS 15");
    expect(updated.priority).toBe(TicketPriority.URGENT);
    expect(updated.version).toBe(2);

    expect(auditLogs).toHaveLength(2);
    expect(auditLogs[1]?.action).toBe("ticket.updated");
    expect(auditLogs[1]?.targetId).toBe(created.id);
  });

  it("transitions status legally and records status change audit event", async () => {
    const created = await service.createTicket({
      description: "Password reset assistance",
      requesterUserId: userA,
      tenantId: tenantA,
      title: "Reset Password Help",
    });

    const transitioned = await service.transitionStatus({
      actorUserId: userA,
      expectedVersion: 1,
      newStatus: TicketStatus.OPEN,
      tenantId: tenantA,
      ticketId: created.id,
    });

    expect(transitioned.status).toBe(TicketStatus.OPEN);
    expect(transitioned.version).toBe(2);

    expect(auditLogs).toHaveLength(2);
    expect(auditLogs[1]?.action).toBe("ticket.status_changed");
    expect(auditLogs[1]?.metadata).toEqual({
      fromStatus: TicketStatus.NEW,
      newVersion: 2,
      publicRef: "TKT-1001",
      toStatus: TicketStatus.OPEN,
    });
  });
});
