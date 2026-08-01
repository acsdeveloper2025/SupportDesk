import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { OutboxPublisherService } from "./outbox-publisher.service";

describe("OutboxPublisherService", () => {
  it("appends outbox event with correct default fields", async () => {
    const publisher = new OutboxPublisherService();

    const mockTx = {
      outboxEvent: {
        create: vi.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve(data)),
      },
    };

    const result = await publisher.appendOutboxEvent(
      mockTx as unknown as Prisma.TransactionClient,
      {
        tenantId: "tenant-123",
        eventType: "ticket.created",
        aggregateType: "ticket",
        aggregateId: "ticket-456",
        payload: { title: "Test" },
      },
    );

    expect(mockTx.outboxEvent.create).toHaveBeenCalledOnce();
    expect(result.tenantId).toBe("tenant-123");
    expect(result.eventType).toBe("ticket.created");
    expect(result.aggregateType).toBe("ticket");
    expect(result.aggregateId).toBe("ticket-456");
    expect(result.automationDepth).toBe(0);
    expect(result.state).toBe("PENDING");
  });

  it("preserves correlationId and causationId when provided", async () => {
    const publisher = new OutboxPublisherService();

    const mockTx = {
      outboxEvent: {
        create: vi.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve(data)),
      },
    };

    const result = await publisher.appendOutboxEvent(
      mockTx as unknown as Prisma.TransactionClient,
      {
        tenantId: "tenant-123",
        eventType: "comment.added",
        aggregateType: "comment",
        aggregateId: "comment-789",
        payload: { body: "Hello" },
        correlationId: "corr-1",
        causationId: "caus-2",
        automationDepth: 2,
      },
    );

    expect(result.correlationId).toBe("corr-1");
    expect(result.causationId).toBe("caus-2");
    expect(result.automationDepth).toBe(2);
  });
});
