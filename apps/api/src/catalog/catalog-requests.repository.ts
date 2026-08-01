import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import type {
  ServiceApprovalStatus,
  ServiceRequest,
  ServiceRequestApproval,
  ServiceRequestAttachment,
  ServiceRequestHistory,
  ServiceRequestStatus,
} from "@prisma/client";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { OutboxPublisherService } from "../outbox/outbox-publisher.service";
import type { DecideApprovalDto, UpdateServiceRequestAnswersDto } from "./dto/request-dtos";

export interface OutboxEventInput {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  dedupeKey?: string;
  correlationId?: string;
}

export interface AuditEventInput {
  action: string;
  actorUserId: string;
  targetId?: string;
  targetType: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

export type ServiceRequestWithRelations = ServiceRequest & {
  service?: { id: string; name: string; slug: string; kind: string } | null;
  ticket?: { id: string; publicRef: string } | null;
  approvals?: ServiceRequestApproval[];
  attachments?: ServiceRequestAttachment[];
};

export interface CreateServiceRequestInput {
  service: { id: string; name: string; kind: "BUSINESS" | "TECHNICAL" };
  submittedFormVersion: number;
  answers: Record<string, unknown>;
  requesterUserId: string;
  requestedForUserId?: string | null;
  priority?: string;
  approvalMode: "NONE" | "SINGLE" | "ALL" | "ANY";
  approvalSteps: Array<{
    ordinal: number;
    approverRole?: string | null;
    approverUserId?: string | null;
  }>;
}

const REQUEST_INCLUDE = {
  service: { select: { id: true, name: true, slug: true, kind: true } },
  ticket: { select: { id: true, publicRef: true } },
  approvals: { orderBy: { stepNumber: "asc" as const } },
  attachments: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ServiceRequestInclude;

@Injectable()
export class CatalogRequestsRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OutboxPublisherService) private readonly outboxPublisher: OutboxPublisherService,
  ) {}

  private async appendOutbox(
    tx: Prisma.TransactionClient,
    tenantId: string,
    event: OutboxEventInput,
  ): Promise<void> {
    await this.outboxPublisher.appendOutboxEvent(tx, {
      tenantId,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload,
      dedupeKey: event.dedupeKey,
      correlationId: event.correlationId,
    });
  }

  /** Atomically creates a request with ref, history, and (optionally) approval steps. */
  async create(
    tenantId: string,
    input: CreateServiceRequestInput,
    events: { outbox: OutboxEventInput[]; audit: AuditEventInput },
  ): Promise<ServiceRequestWithRelations> {
    return this.prisma.$transaction(
      async (tx) => {
        const count = await tx.serviceRequest.count({ where: { tenantId } });
        const requestRef = `REQ-${String(count + 1).padStart(6, "0")}`;

        const request = await tx.serviceRequest.create({
          data: {
            tenantId,
            requestRef,
            serviceId: input.service.id,
            serviceName: input.service.name,
            serviceKind: input.service.kind,
            submittedFormVersion: input.submittedFormVersion,
            answers: input.answers as Prisma.InputJsonValue,
            requesterUserId: input.requesterUserId,
            requestedForUserId: input.requestedForUserId || null,
            priority: (input.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT") ?? "MEDIUM",
          },
        });

        await tx.serviceRequestHistory.create({
          data: {
            tenantId,
            requestId: request.id,
            action: "catalog.request.submitted",
            toStatus: request.status,
            actorUserId: input.requesterUserId,
          },
        });

        const approvals: ServiceRequestApproval[] = [];
        if (input.approvalMode !== "NONE" && input.approvalSteps.length > 0) {
          for (const step of input.approvalSteps) {
            approvals.push(
              await tx.serviceRequestApproval.create({
                data: {
                  tenantId,
                  requestId: request.id,
                  stepNumber: step.ordinal,
                  approverRole: step.approverRole || null,
                  approverUserId: step.approverUserId || null,
                },
              }),
            );
          }
          await tx.serviceRequest.update({
            where: { id: request.id },
            data: { status: "AWAITING_APPROVAL" },
          });
        }

        await this.appendOutbox(tx, tenantId, {
          eventType: "service_request.created",
          aggregateType: "service_request",
          aggregateId: request.id,
          correlationId: events.audit.correlationId,
          payload: {
            requestId: request.id,
            requestRef,
            serviceId: input.service.id,
            serviceName: input.service.name,
            status: approvals.length > 0 ? "AWAITING_APPROVAL" : "SUBMITTED",
            priority: request.priority,
          },
        });

        if (approvals.length > 0) {
          await this.appendOutbox(tx, tenantId, {
            eventType: "service_request.approval_started",
            aggregateType: "service_request",
            aggregateId: request.id,
            correlationId: events.audit.correlationId,
            payload: {
              requestId: request.id,
              requestRef,
              mode: input.approvalMode,
              stepCount: approvals.length,
            },
          });
        }

        await tx.auditEvent.create({
          data: {
            action: events.audit.action,
            actorUserId: events.audit.actorUserId,
            correlationId: events.audit.correlationId,
            outcome: "SUCCESS",
            targetId: events.audit.targetId ?? request.id,
            targetType: events.audit.targetType,
            tenantId,
            metadata: events.audit.metadata as Prisma.InputJsonValue | undefined,
          },
        });

        return { ...request, service: null, ticket: null, approvals, attachments: [] };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async findById(tenantId: string, id: string): Promise<ServiceRequestWithRelations | null> {
    return this.prisma.serviceRequest.findFirst({
      where: { tenantId, id },
      include: REQUEST_INCLUDE,
    });
  }

  async listByRequester(
    tenantId: string,
    requesterUserId: string,
    options: { page: number; pageSize: number; status?: ServiceRequestStatus },
  ) {
    const where: Prisma.ServiceRequestWhereInput = {
      tenantId,
      requesterUserId,
      ...(options.status ? { status: options.status } : {}),
    };
    const [items, totalRecords] = await this.prisma.$transaction([
      this.prisma.serviceRequest.findMany({
        where,
        include: REQUEST_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
      }),
      this.prisma.serviceRequest.count({ where }),
    ]);
    return { items, totalRecords };
  }

  async listAll(
    tenantId: string,
    options: { page: number; pageSize: number; status?: ServiceRequestStatus },
  ) {
    const where: Prisma.ServiceRequestWhereInput = {
      tenantId,
      ...(options.status ? { status: options.status } : {}),
    };
    const [items, totalRecords] = await this.prisma.$transaction([
      this.prisma.serviceRequest.findMany({
        where,
        include: REQUEST_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
      }),
      this.prisma.serviceRequest.count({ where }),
    ]);
    return { items, totalRecords };
  }

  async updateAnswers(
    tenantId: string,
    id: string,
    dto: UpdateServiceRequestAnswersDto,
    actorUserId: string,
    status: ServiceRequestStatus,
    audit: AuditEventInput,
  ): Promise<ServiceRequest | null> {
    return this.prisma.$transaction(async (tx) => {
      const [updated] = await tx.serviceRequest.updateManyAndReturn({
        where: { tenantId, id },
        data: {
          answers: dto.answers as Prisma.InputJsonValue,
          status,
        },
      });
      if (updated) {
        await tx.serviceRequestHistory.create({
          data: {
            tenantId,
            requestId: id,
            action: "catalog.request.updated",
            fromStatus: status === "SUBMITTED" ? "CHANGES_REQUESTED" : "SUBMITTED",
            toStatus: status,
            actorUserId,
            comment: dto.note || null,
          },
        });
        await tx.auditEvent.create({
          data: {
            action: audit.action,
            actorUserId: audit.actorUserId,
            correlationId: audit.correlationId,
            outcome: "SUCCESS",
            targetId: audit.targetId ?? id,
            targetType: audit.targetType,
            tenantId,
            metadata: audit.metadata as Prisma.InputJsonValue | undefined,
          },
        });
      }
      return updated ?? null;
    });
  }

  async transitionStatus(
    tenantId: string,
    id: string,
    from: ServiceRequestStatus,
    to: ServiceRequestStatus,
    actorUserId: string,
    action: string,
    comment?: string | null,
    extra?: {
      approvedAt?: Date;
      fulfillmentStartedAt?: Date;
      completedAt?: Date;
      cancelledAt?: Date;
      cancelledReason?: string | null;
    },
    events?: { outbox?: OutboxEventInput[]; audit?: AuditEventInput },
  ): Promise<ServiceRequest | null> {
    return this.prisma.$transaction(async (tx) => {
      const [updated] = await tx.serviceRequest.updateManyAndReturn({
        where: { tenantId, id, status: from },
        data: {
          status: to,
          ...(extra?.approvedAt ? { approvedAt: extra.approvedAt } : {}),
          ...(extra?.fulfillmentStartedAt
            ? { fulfillmentStartedAt: extra.fulfillmentStartedAt }
            : {}),
          ...(extra?.completedAt ? { completedAt: extra.completedAt } : {}),
          ...(extra?.cancelledAt ? { cancelledAt: extra.cancelledAt } : {}),
          ...(extra?.cancelledReason !== undefined
            ? { cancelledReason: extra.cancelledReason || null }
            : {}),
        },
      });
      if (updated) {
        await tx.serviceRequestHistory.create({
          data: {
            tenantId,
            requestId: id,
            action,
            fromStatus: from,
            toStatus: to,
            actorUserId,
            comment: comment || null,
          },
        });
        for (const event of events?.outbox ?? []) {
          await this.appendOutbox(tx, tenantId, event);
        }
        if (events?.audit) {
          await tx.auditEvent.create({
            data: {
              action: events.audit.action,
              actorUserId: events.audit.actorUserId,
              correlationId: events.audit.correlationId,
              outcome: "SUCCESS",
              targetId: events.audit.targetId ?? id,
              targetType: events.audit.targetType,
              tenantId,
              metadata: events.audit.metadata as Prisma.InputJsonValue | undefined,
            },
          });
        }
      }
      return updated ?? null;
    });
  }

  async addHistory(
    tenantId: string,
    requestId: string,
    action: string,
    actorUserId?: string,
    comment?: string | null,
  ): Promise<ServiceRequestHistory> {
    return this.prisma.serviceRequestHistory.create({
      data: {
        tenantId,
        requestId,
        action,
        actorUserId: actorUserId ?? null,
        comment: comment || null,
      },
    });
  }

  async listHistory(tenantId: string, requestId: string): Promise<ServiceRequestHistory[]> {
    return this.prisma.serviceRequestHistory.findMany({
      where: { tenantId, requestId },
      orderBy: { createdAt: "asc" },
    });
  }

  async listApprovals(tenantId: string, requestId: string): Promise<ServiceRequestApproval[]> {
    return this.prisma.serviceRequestApproval.findMany({
      where: { tenantId, requestId },
      orderBy: { stepNumber: "asc" },
    });
  }

  async getApproval(tenantId: string, approvalId: string): Promise<ServiceRequestApproval | null> {
    return this.prisma.serviceRequestApproval.findFirst({
      where: { tenantId, id: approvalId },
    });
  }

  /** Decides an approval step, returning the request and updated step statuses. */
  async decideApproval(
    tenantId: string,
    requestId: string,
    approvalId: string,
    dto: DecideApprovalDto,
    actorUserId: string,
  ): Promise<{
    request: ServiceRequestWithRelations;
    step: ServiceRequestApproval;
    statuses: ServiceApprovalStatus[];
  }> {
    return this.prisma.$transaction(async (tx) => {
      const step = await tx.serviceRequestApproval.findFirst({
        where: { tenantId, id: approvalId, requestId },
      });
      if (!step || step.status !== "PENDING") {
        throw new Error("catalog.approval.not_pending");
      }

      const updatedStep = await tx.serviceRequestApproval.update({
        where: { id: step.id },
        data: {
          status: dto.decision,
          decidedByUserId: actorUserId,
          decidedAt: new Date(),
          decisionComment: dto.comment?.trim() || null,
        },
      });

      const allSteps = await tx.serviceRequestApproval.findMany({
        where: { tenantId, requestId },
        orderBy: { stepNumber: "asc" },
      });

      const request = await tx.serviceRequest.findFirst({
        where: { tenantId, id: requestId },
        include: REQUEST_INCLUDE,
      });
      if (!request) {
        throw new Error("catalog.request.not_found");
      }

      return {
        request,
        step: updatedStep,
        statuses: allSteps.map((item) => item.status),
      };
    });
  }

  /** Re-creates approval steps (new cycle after changes requested) and flips request status. */
  async resetApprovalCycle(
    tenantId: string,
    requestId: string,
    steps: Array<{ ordinal: number; approverRole?: string | null; approverUserId?: string | null }>,
    actorUserId: string,
    audit: AuditEventInput,
  ): Promise<ServiceRequestApproval[]> {
    return this.prisma.$transaction(async (tx) => {
      await tx.serviceRequestApproval.deleteMany({ where: { tenantId, requestId } });
      const created: ServiceRequestApproval[] = [];
      for (const step of steps) {
        created.push(
          await tx.serviceRequestApproval.create({
            data: {
              tenantId,
              requestId,
              stepNumber: step.ordinal,
              approverRole: step.approverRole || null,
              approverUserId: step.approverUserId || null,
            },
          }),
        );
      }
      await tx.serviceRequest.update({
        where: { id: requestId },
        data: { status: "AWAITING_APPROVAL" },
      });
      await tx.serviceRequestHistory.create({
        data: {
          tenantId,
          requestId,
          action: "catalog.request.resubmitted",
          fromStatus: "CHANGES_REQUESTED",
          toStatus: "AWAITING_APPROVAL",
          actorUserId,
        },
      });
      await this.appendOutbox(tx, tenantId, {
        eventType: "service_request.resubmitted",
        aggregateType: "service_request",
        aggregateId: requestId,
        correlationId: audit.correlationId,
        payload: { requestId, stepCount: created.length },
      });
      await tx.auditEvent.create({
        data: {
          action: audit.action,
          actorUserId: audit.actorUserId,
          correlationId: audit.correlationId,
          outcome: "SUCCESS",
          targetId: audit.targetId ?? requestId,
          targetType: audit.targetType,
          tenantId,
          metadata: audit.metadata as Prisma.InputJsonValue | undefined,
        },
      });
      return created;
    });
  }

  async createAttachment(
    tenantId: string,
    requestId: string,
    input: {
      fileName: string;
      originalName: string;
      mimeType: string;
      sizeBytes: bigint;
      storagePath: string;
      uploadedById: string;
    },
  ): Promise<ServiceRequestAttachment> {
    return this.prisma.serviceRequestAttachment.create({
      data: {
        tenantId,
        requestId,
        ...input,
      },
    });
  }

  async listAttachments(tenantId: string, requestId: string): Promise<ServiceRequestAttachment[]> {
    return this.prisma.serviceRequestAttachment.findMany({
      where: { tenantId, requestId },
      orderBy: { createdAt: "asc" },
    });
  }

  async getAttachment(
    tenantId: string,
    attachmentId: string,
  ): Promise<ServiceRequestAttachment | null> {
    return this.prisma.serviceRequestAttachment.findFirst({
      where: { tenantId, id: attachmentId },
    });
  }

  async deleteAttachment(
    tenantId: string,
    attachmentId: string,
  ): Promise<ServiceRequestAttachment | null> {
    return this.prisma.serviceRequestAttachment
      .deleteMany({
        where: { tenantId, id: attachmentId },
      })
      .then((result) =>
        result.count > 0 ? ({ id: attachmentId } as ServiceRequestAttachment) : null,
      );
  }

  /** Links a generated ticket to the request (idempotent, unique tenant+ticket). */
  async linkTicket(
    tenantId: string,
    requestId: string,
    ticketId: string,
  ): Promise<ServiceRequest | null> {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.serviceRequest.findFirst({ where: { tenantId, id: requestId } });
      if (!request) {
        return null;
      }
      if (request.ticketId) {
        return request.ticketId === ticketId ? request : null;
      }
      return tx.serviceRequest.update({
        where: { id: requestId },
        data: { ticketId },
      });
    });
  }

  /**
   * Atomically generates a Ticket from a ServiceRequest and links it.
   *
   * Runs in a SERIALIZABLE transaction with a row lock on the request so
   * concurrent calls produce exactly one ticket (idempotent retries return the
   * existing ticket). Domain mutation + audit + outbox events commit together.
   */
  async generateTicket(
    tenantId: string,
    requestId: string,
    input: {
      title: string;
      description: string;
      priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      type: "QUESTION" | "INCIDENT" | "PROBLEM" | "FEATURE_REQUEST";
      requesterUserId: string;
      correlationId?: string;
    },
    audit: {
      action: string;
      actorUserId: string;
      correlationId?: string;
    },
  ): Promise<{ request: ServiceRequestWithRelations; ticket: { id: string; publicRef: string } }> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT "id" FROM "service_requests"
          WHERE "tenant_id" = ${tenantId}::uuid AND "id" = ${requestId}::uuid
          FOR UPDATE
        `;

        const request = await tx.serviceRequest.findFirst({
          where: { tenantId, id: requestId },
          include: REQUEST_INCLUDE,
        });
        if (!request) {
          throw new Error("catalog.request.not_found");
        }

        if (request.ticketId) {
          const existing = await tx.ticket.findFirst({
            where: { tenantId, id: request.ticketId },
            select: { id: true, publicRef: true },
          });
          if (existing) {
            return { request, ticket: existing };
          }
        }

        const count = await tx.ticket.count({ where: { tenantId } });
        const publicRef = `TKT-${count + 1001}`;
        const ticketId = randomUUID();

        await tx.ticket.create({
          data: {
            id: ticketId,
            tenantId,
            publicRef,
            title: input.title,
            description: input.description,
            status: "NEW",
            priority: input.priority,
            channel: "WEB",
            type: input.type,
            requesterUserId: input.requesterUserId,
            version: 1,
          },
        });

        await tx.auditEvent.create({
          data: {
            action: audit.action,
            actorUserId: audit.actorUserId,
            correlationId: audit.correlationId,
            outcome: "SUCCESS",
            targetId: ticketId,
            targetType: "ticket",
            tenantId,
            metadata: {
              requestRef: request.requestRef,
              ticketId,
              publicRef,
            },
          },
        });

        await tx.serviceRequestHistory.create({
          data: {
            tenantId,
            requestId,
            action: "catalog.request.ticket_created",
            toStatus: request.status,
            actorUserId: audit.actorUserId,
            comment: `Ticket ${publicRef} generated`,
          },
        });

        await tx.serviceRequest.update({
          where: { id: requestId },
          data: { ticketId },
        });

        await this.appendOutbox(tx, tenantId, {
          eventType: "ticket.created",
          aggregateType: "ticket",
          aggregateId: ticketId,
          correlationId: input.correlationId,
          payload: {
            ticket: {
              id: ticketId,
              tenantId,
              publicRef,
              title: input.title,
              description: input.description,
              status: "NEW",
              priority: input.priority,
              channel: "WEB",
              type: input.type,
              requesterUserId: input.requesterUserId,
            },
            sourceRequestId: requestId,
          },
        });

        await this.appendOutbox(tx, tenantId, {
          eventType: "service_request.ticket_created",
          aggregateType: "service_request",
          aggregateId: requestId,
          correlationId: input.correlationId,
          payload: {
            requestId,
            requestRef: request.requestRef,
            ticketId,
            publicRef,
          },
        });

        return {
          request: { ...request, ticket: { id: ticketId, publicRef } },
          ticket: { id: ticketId, publicRef },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async countRequests(tenantId: string): Promise<number> {
    return this.prisma.serviceRequest.count({ where: { tenantId } });
  }
}
