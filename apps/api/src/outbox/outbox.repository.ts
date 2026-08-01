import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { OutboxEvent, OutboxState, Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";

export interface OutboxQueryFilter {
  state?: OutboxState;
  aggregateType?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class OutboxRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async claimPendingBatch(
    batchSize = 20,
    leaseDurationMs = 60000,
    leaseOwner = "worker-1",
  ): Promise<OutboxEvent[]> {
    const leaseExpiresAt = new Date(Date.now() + leaseDurationMs);

    // Atomic claim via SKIP LOCKED raw query
    const claimedRows = await this.prisma.$queryRaw<OutboxEvent[]>`
      WITH claimable AS (
        SELECT id
        FROM outbox_events
        WHERE (state = 'pending'::outbox_state AND available_at <= NOW())
           OR (state = 'claimed'::outbox_state AND lease_expires_at <= NOW())
        ORDER BY available_at ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox_events
      SET state = 'claimed'::outbox_state,
          lease_owner = ${leaseOwner},
          lease_expires_at = ${leaseExpiresAt}
      FROM claimable
      WHERE outbox_events.id = claimable.id
      RETURNING 
        outbox_events.id, 
        outbox_events.tenant_id AS "tenantId", 
        outbox_events.event_type AS "eventType", 
        outbox_events.aggregate_type AS "aggregateType", 
        outbox_events.aggregate_id AS "aggregateId", 
        outbox_events.payload, 
        outbox_events.correlation_id AS "correlationId", 
        outbox_events.causation_id AS "causationId", 
        outbox_events.automation_depth AS "automationDepth", 
        outbox_events.state, 
        outbox_events.dedupe_key AS "dedupeKey", 
        outbox_events.attempt_count AS "attemptCount", 
        outbox_events.last_error AS "lastError", 
        outbox_events.available_at AS "availableAt", 
        outbox_events.lease_owner AS "leaseOwner", 
        outbox_events.lease_expires_at AS "leaseExpiresAt", 
        outbox_events.processed_at AS "processedAt", 
        outbox_events.created_at AS "createdAt";
    `;

    return claimedRows.map((row) => ({
      ...row,
      state: (row.state as string).toUpperCase() as OutboxState,
    }));
  }

  async markProcessed(id: string, tenantId: string): Promise<OutboxEvent> {
    return this.prisma.outboxEvent.update({
      where: {
        id,
        tenantId,
      },
      data: {
        state: "PROCESSED",
        processedAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
  }

  async recordAttemptFailure(
    id: string,
    tenantId: string,
    errorMessage: string,
    maxAttempts = 8,
  ): Promise<{ event: OutboxEvent; isDeadLettered: boolean }> {
    const event = await this.prisma.outboxEvent.findUnique({
      where: { id },
    });

    if (!event || event.tenantId !== tenantId) {
      throw new NotFoundException(`Outbox event ${id} not found for tenant`);
    }

    const nextAttempt = event.attemptCount + 1;
    const isDeadLettered = nextAttempt >= maxAttempts;
    const nextState: OutboxState = isDeadLettered ? "DEAD_LETTERED" : "FAILED";

    // Exponential backoff: 2^attempt * 1000ms + random jitter up to 1000ms
    const backoffMs = Math.min(Math.pow(2, nextAttempt) * 1000 + Math.random() * 1000, 3600000);
    const nextAvailableAt = new Date(Date.now() + backoffMs);

    const updated = await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        attemptCount: nextAttempt,
        state: nextState,
        availableAt: isDeadLettered ? event.availableAt : nextAvailableAt,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: {
          message: errorMessage,
          timestamp: new Date().toISOString(),
          attempt: nextAttempt,
        },
      },
    });

    return { event: updated, isDeadLettered };
  }

  async listOutboxEvents(
    tenantId: string,
    filter: OutboxQueryFilter,
  ): Promise<{ data: OutboxEvent[]; total: number }> {
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const where: Prisma.OutboxEventWhereInput = {
      tenantId,
      ...(filter.state ? { state: filter.state } : {}),
      ...(filter.aggregateType ? { aggregateType: filter.aggregateType } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.outboxEvent.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.outboxEvent.count({ where }),
    ]);

    return { data, total };
  }

  async replayOutboxEvent(id: string, tenantId: string): Promise<OutboxEvent> {
    const event = await this.prisma.outboxEvent.findUnique({
      where: { id },
    });

    if (!event || event.tenantId !== tenantId) {
      throw new NotFoundException(`Outbox event ${id} not found for tenant ${tenantId}`);
    }

    return this.prisma.outboxEvent.update({
      where: { id },
      data: {
        state: "PENDING",
        availableAt: new Date(),
        attemptCount: 0,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: Prisma.DbNull,
      },
    });
  }

  async cleanupOldEvents(daysToKeep = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const result = await this.prisma.outboxEvent.deleteMany({
      where: {
        state: "PROCESSED",
        processedAt: {
          lte: cutoffDate,
        },
      },
    });

    return result.count;
  }
}
