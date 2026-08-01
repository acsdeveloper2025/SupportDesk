import { Injectable } from "@nestjs/common";
import { OutboxEvent, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

export interface AppendOutboxParams {
  tenantId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  correlationId?: string;
  causationId?: string;
  automationDepth?: number;
  dedupeKey?: string;
}

@Injectable()
export class OutboxPublisherService {
  async appendOutboxEvent(
    tx: Prisma.TransactionClient,
    params: AppendOutboxParams,
  ): Promise<OutboxEvent> {
    const correlationId = params.correlationId ?? randomUUID();
    const dedupeKey =
      params.dedupeKey ??
      `evt:${params.tenantId}:${params.eventType}:${params.aggregateId}:${correlationId}`;

    return tx.outboxEvent.create({
      data: {
        id: randomUUID(),
        tenantId: params.tenantId,
        eventType: params.eventType,
        aggregateType: params.aggregateType,
        aggregateId: params.aggregateId,
        dedupeKey,
        payload: params.payload as Prisma.InputJsonValue,
        correlationId,
        causationId: params.causationId ?? null,
        automationDepth: params.automationDepth ?? 0,
        state: "PENDING",
      },
    });
  }
}
