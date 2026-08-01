import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { NotificationEventType, type ServiceRequestStatus } from "@prisma/client";

import { buildAuditEventData } from "../audit/audit-event";
import { PrismaService } from "../database/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { RbacService } from "../rbac/rbac.service";
import { SlaEngineService } from "../sla/sla-engine.service";
import {
  ATTACHMENT_ALLOWED_EXTENSIONS,
  ATTACHMENT_ALLOWED_MIME_TYPES,
  ATTACHMENT_MAX_FILE_SIZE_BYTES,
  extractExtension,
  sanitizeOriginalFilename,
} from "../ticketing/attachments/attachment-validation";
import { LocalAttachmentStorage } from "../ticketing/attachments/local-attachment-storage";
import { VIRUS_SCANNER, type VirusScanner } from "../ticketing/attachments/virus-scanner";
import {
  type AuditEventInput,
  CatalogRequestsRepository,
  type ServiceRequestWithRelations,
} from "./catalog-requests.repository";
import { CatalogServicesRepository } from "./catalog-services.repository";
import { CatalogTemplatesRepository } from "./catalog-templates.repository";
import { isApprovalGateSatisfied, stepDecisionOutcome } from "./domain/approval-gate";
import { sanitizeAnswers, type ServiceFormSchema, validateAnswers } from "./domain/form-engine";
import { isEditableStatus, isTerminalStatus } from "./domain/request-status";
import {
  type CancelServiceRequestDto,
  type CreateServiceRequestDto,
  type DecideApprovalDto,
  type UpdateServiceRequestAnswersDto,
} from "./dto/request-dtos";

const REQUEST_ATTACHMENT_MAX_FILES = 5;

interface RequestContext {
  tenantId: string;
  userId: string;
}

@Injectable()
export class CatalogRequestsService {
  constructor(
    @Inject(CatalogRequestsRepository) private readonly repository: CatalogRequestsRepository,
    @Inject(CatalogServicesRepository)
    private readonly servicesRepository: CatalogServicesRepository,
    @Inject(CatalogTemplatesRepository)
    private readonly templatesRepository: CatalogTemplatesRepository,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
    @Inject(RbacService) private readonly rbacService: RbacService,
    @Inject(SlaEngineService) private readonly slaEngine: SlaEngineService,
    @Inject(LocalAttachmentStorage) private readonly storage: LocalAttachmentStorage,
    @Inject(VIRUS_SCANNER) private readonly virusScanner: VirusScanner,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  private async can(ctx: RequestContext, permissionKey: string): Promise<boolean> {
    return this.rbacService.can({
      permissionKey,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
    });
  }

  private async assertCan(ctx: RequestContext, permissionKey: string): Promise<void> {
    const allowed = await this.can(ctx, permissionKey);
    if (!allowed) {
      throw new ForbiddenException(`Lacks required permission ${permissionKey}`);
    }
  }

  private async loadRequestOrThrow(
    ctx: RequestContext,
    id: string,
  ): Promise<ServiceRequestWithRelations> {
    const request = await this.repository.findById(ctx.tenantId, id);
    if (!request) {
      throw new NotFoundException(`Service request '${id}' not found`);
    }
    return request;
  }

  private async assertRequestVisible(
    ctx: RequestContext,
    request: ServiceRequestWithRelations,
  ): Promise<void> {
    if (request.requesterUserId === ctx.userId) {
      return;
    }
    const canReadAll = await this.can(ctx, "catalog.request.read_all");
    if (!canReadAll) {
      throw new ForbiddenException("Lacks required permission catalog.request.read_all");
    }
  }

  // ------------------------------------------------------------------
  // Submission
  // ------------------------------------------------------------------

  async submit(
    ctx: RequestContext,
    dto: CreateServiceRequestDto,
    correlationId?: string,
  ): Promise<ServiceRequestWithRelations> {
    await this.assertCan(ctx, "catalog.request.create");

    const service = await this.servicesRepository.findById(ctx.tenantId, dto.serviceId);
    if (!service) {
      throw new NotFoundException(`Service '${dto.serviceId}' not found`);
    }
    if (service.state !== "PUBLISHED") {
      throw new BadRequestException("Service is not published in the request catalog");
    }
    if (!service.form) {
      throw new BadRequestException("Service has no request form");
    }

    const schema = service.form.schema as unknown as ServiceFormSchema;
    const template = dto.templateId
      ? await this.templatesRepository.findById(ctx.tenantId, dto.templateId)
      : null;
    if (dto.templateId && !template) {
      throw new NotFoundException(`Template '${dto.templateId}' not found`);
    }

    let answers = { ...((template?.fieldValues as Record<string, unknown> | undefined) ?? {}) };
    if (dto.templateId) {
      answers = { ...answers, ...dto.answers };
    } else {
      answers = dto.answers;
    }
    answers = sanitizeAnswers(schema, answers);

    const validation = validateAnswers(schema, answers);
    if (!validation.valid) {
      throw new BadRequestException(
        `Invalid form answers: ${validation.errors.map((error) => error.message).join("; ")}`,
      );
    }

    const approvalSteps = (
      Array.isArray(service.approvalSteps) ? service.approvalSteps : []
    ) as Array<{ ordinal: number; approverRole?: string | null; approverUserId?: string | null }>;
    const needsApproval = service.approvalMode !== "NONE" && approvalSteps.length > 0;

    const request = await this.repository.create(
      ctx.tenantId,
      {
        service: { id: service.id, name: service.name, kind: service.kind },
        submittedFormVersion: service.form.formVersion,
        answers,
        requesterUserId: ctx.userId,
        requestedForUserId: dto.requestedForUserId,
        priority: dto.priority ?? service.defaultPriority,
        approvalMode: service.approvalMode,
        approvalSteps: needsApproval ? approvalSteps : [],
      },
      {
        outbox: [],
        audit: {
          action: "catalog.request.submitted",
          actorUserId: ctx.userId,
          targetId: undefined,
          targetType: "service_request",
          correlationId,
          metadata: {
            requestRef: "",
            serviceId: service.id,
            serviceName: service.name,
            priority: dto.priority ?? service.defaultPriority,
            approvalMode: service.approvalMode,
          },
        },
      },
    );

    // Notifications (post-commit side effects)
    await this.notificationsService.createSafe({
      tenantId: ctx.tenantId,
      recipientUserId: ctx.userId,
      eventType: NotificationEventType.REQUEST_SUBMITTED,
      title: `Service request ${request.requestRef} submitted`,
      body: `${service.name} request received`,
      resourceType: "service_request",
      resourceId: request.id,
      actorUserId: ctx.userId,
      payload: { requestRef: request.requestRef, serviceId: service.id, serviceName: service.name },
      force: true,
    });

    if (needsApproval) {
      for (const step of approvalSteps) {
        if (step.approverUserId) {
          await this.notificationsService.createSafe({
            tenantId: ctx.tenantId,
            recipientUserId: step.approverUserId,
            eventType: NotificationEventType.REQUEST_APPROVAL_REQUIRED,
            title: `Approval required: ${request.requestRef}`,
            body: `Approve or reject the ${service.name} request`,
            resourceType: "service_request",
            resourceId: request.id,
            actorUserId: ctx.userId,
            payload: {
              requestRef: request.requestRef,
              serviceId: service.id,
              serviceName: service.name,
            },
            force: true,
          });
        }
      }
    }

    return this.loadRequestOrThrow(ctx, request.id);
  }

  // ------------------------------------------------------------------
  // Reads
  // ------------------------------------------------------------------

  async listRequests(
    ctx: RequestContext,
    scope: "own" | "all",
    options: { page: number; pageSize: number; status?: ServiceRequestStatus },
  ) {
    if (scope === "all") {
      await this.assertCan(ctx, "catalog.request.read_all");
      return this.repository.listAll(ctx.tenantId, options);
    }
    await this.assertCan(ctx, "catalog.request.read");
    return this.repository.listByRequester(ctx.tenantId, ctx.userId, options);
  }

  async getRequest(ctx: RequestContext, id: string): Promise<ServiceRequestWithRelations> {
    await this.assertCan(ctx, "catalog.request.read");
    const request = await this.loadRequestOrThrow(ctx, id);
    await this.assertRequestVisible(ctx, request);
    return request;
  }

  async listHistory(ctx: RequestContext, id: string) {
    const request = await this.loadRequestOrThrow(ctx, id);
    await this.assertRequestVisible(ctx, request);
    return this.repository.listHistory(ctx.tenantId, request.id);
  }

  async listApprovals(ctx: RequestContext, id: string) {
    const request = await this.loadRequestOrThrow(ctx, id);
    await this.assertRequestVisible(ctx, request);
    return this.repository.listApprovals(ctx.tenantId, request.id);
  }

  // ------------------------------------------------------------------
  // Answer updates / resubmission
  // ------------------------------------------------------------------

  async updateAnswers(
    ctx: RequestContext,
    id: string,
    dto: UpdateServiceRequestAnswersDto,
    correlationId?: string,
  ): Promise<ServiceRequestWithRelations> {
    const request = await this.loadRequestOrThrow(ctx, id);
    if (request.requesterUserId !== ctx.userId) {
      const canUpdateAll = await this.can(ctx, "catalog.request.read_all");
      if (!canUpdateAll) {
        throw new ForbiddenException("Only the requester may update request answers");
      }
    }
    await this.assertCan(ctx, "catalog.request.update");

    if (!isEditableStatus(request.status)) {
      throw new ConflictException(
        `Request answers can only be edited in SUBMITTED or CHANGES_REQUESTED status (current: ${request.status})`,
      );
    }

    const service = await this.servicesRepository.findById(ctx.tenantId, request.serviceId);
    if (!service?.form) {
      throw new NotFoundException("Service request form not found");
    }
    const schema = service.form.schema as unknown as ServiceFormSchema;
    const answers = sanitizeAnswers(schema, dto.answers);
    const validation = validateAnswers(schema, answers);
    if (!validation.valid) {
      throw new BadRequestException(
        `Invalid form answers: ${validation.errors.map((error) => error.message).join("; ")}`,
      );
    }

    if (request.status === "CHANGES_REQUESTED") {
      const steps = (Array.isArray(service.approvalSteps) ? service.approvalSteps : []) as Array<{
        ordinal: number;
        approverRole?: string | null;
        approverUserId?: string | null;
      }>;
      await this.repository.updateAnswers(
        ctx.tenantId,
        request.id,
        { answers, note: dto.note },
        ctx.userId,
        "CHANGES_REQUESTED",
        {
          action: "catalog.request.updated",
          actorUserId: ctx.userId,
          targetId: request.id,
          targetType: "service_request",
          correlationId,
          metadata: {
            requestRef: request.requestRef,
            action: "answers updated before resubmission",
          },
        },
      );
      if (service.approvalMode !== "NONE" && steps.length > 0) {
        await this.repository.resetApprovalCycle(ctx.tenantId, request.id, steps, ctx.userId, {
          action: "catalog.request.resubmitted",
          actorUserId: ctx.userId,
          targetId: request.id,
          targetType: "service_request",
          correlationId,
          metadata: { requestRef: request.requestRef, stepCount: steps.length },
        });
        for (const step of steps) {
          if (step.approverUserId) {
            await this.notificationsService.createSafe({
              tenantId: ctx.tenantId,
              recipientUserId: step.approverUserId,
              eventType: NotificationEventType.REQUEST_APPROVAL_REQUIRED,
              title: `Approval required: ${request.requestRef}`,
              body: `The ${service.name} request was resubmitted`,
              resourceType: "service_request",
              resourceId: request.id,
              actorUserId: ctx.userId,
              payload: { requestRef: request.requestRef, serviceName: service.name },
              force: true,
            });
          }
        }
      }
    } else {
      await this.repository.updateAnswers(
        ctx.tenantId,
        request.id,
        { answers, note: dto.note },
        ctx.userId,
        "SUBMITTED",
        {
          action: "catalog.request.updated",
          actorUserId: ctx.userId,
          targetId: request.id,
          targetType: "service_request",
          correlationId,
          metadata: { requestRef: request.requestRef },
        },
      );
    }

    return this.loadRequestOrThrow(ctx, request.id);
  }

  // ------------------------------------------------------------------
  // Cancellation
  // ------------------------------------------------------------------

  async cancel(
    ctx: RequestContext,
    id: string,
    dto: CancelServiceRequestDto,
    correlationId?: string,
  ): Promise<ServiceRequestWithRelations> {
    const request = await this.loadRequestOrThrow(ctx, id);
    if (request.requesterUserId !== ctx.userId) {
      const canReadAll = await this.can(ctx, "catalog.request.read_all");
      if (!canReadAll) {
        throw new ForbiddenException("Only the requester may cancel their own request");
      }
    }
    await this.assertCan(ctx, "catalog.request.cancel");

    if (isTerminalStatus(request.status)) {
      throw new ConflictException(`Request is already in terminal status ${request.status}`);
    }
    if (request.status === "IN_FULFILLMENT" || request.status === "COMPLETED") {
      throw new ConflictException("Fulfilled requests cannot be cancelled");
    }

    const cancelled = await this.repository.transitionStatus(
      ctx.tenantId,
      request.id,
      request.status,
      "CANCELLED",
      ctx.userId,
      "catalog.request.cancelled",
      dto.reason?.trim() || null,
      { cancelledAt: new Date(), cancelledReason: dto.reason?.trim() || null },
      {
        outbox: [
          {
            eventType: "service_request.cancelled",
            aggregateType: "service_request",
            aggregateId: request.id,
            correlationId,
            payload: {
              requestId: request.id,
              requestRef: request.requestRef,
              reason: dto.reason?.trim() ?? null,
            },
          },
        ],
        audit: {
          action: "catalog.request.cancelled",
          actorUserId: ctx.userId,
          targetId: request.id,
          targetType: "service_request",
          correlationId,
          metadata: { requestRef: request.requestRef, reason: dto.reason?.trim() ?? null },
        },
      },
    );
    if (!cancelled) {
      throw new ConflictException(`Request '${request.requestRef}' could not be cancelled`);
    }

    await this.notificationsService.createSafe({
      tenantId: ctx.tenantId,
      recipientUserId: request.requesterUserId,
      eventType: NotificationEventType.REQUEST_CANCELLED,
      title: `Service request ${request.requestRef} cancelled`,
      body: dto.reason?.trim() || "The request was cancelled",
      resourceType: "service_request",
      resourceId: request.id,
      actorUserId: ctx.userId,
      payload: { requestRef: request.requestRef, reason: dto.reason?.trim() ?? null },
      force: true,
    });

    return this.loadRequestOrThrow(ctx, request.id);
  }

  // ------------------------------------------------------------------
  // Approvals
  // ------------------------------------------------------------------

  async decideApproval(
    ctx: RequestContext,
    id: string,
    approvalId: string,
    dto: DecideApprovalDto,
    correlationId?: string,
  ): Promise<ServiceRequestWithRelations> {
    await this.assertCan(ctx, "catalog.approval.decide");

    const request = await this.loadRequestOrThrow(ctx, id);
    if (request.status !== "AWAITING_APPROVAL") {
      throw new ConflictException(`Request is not awaiting approval (status: ${request.status})`);
    }

    const step = await this.repository.getApproval(ctx.tenantId, approvalId);
    if (!step || step.requestId !== request.id) {
      throw new NotFoundException("Approval step not found for this request");
    }
    if (step.status !== "PENDING") {
      throw new ConflictException("Approval step has already been decided");
    }
    if (step.approverUserId && step.approverUserId === request.requesterUserId) {
      throw new ForbiddenException("The requester cannot approve their own request");
    }

    const { step: decidedStep, statuses } = await this.repository.decideApproval(
      ctx.tenantId,
      request.id,
      approvalId,
      dto,
      ctx.userId,
    );

    const service = await this.servicesRepository.findById(ctx.tenantId, request.serviceId);
    const outcome = stepDecisionOutcome(service?.approvalMode ?? "ALL", statuses, dto.decision);

    const audit: AuditEventInput = {
      action: "catalog.approval.decided",
      actorUserId: ctx.userId,
      targetId: request.id,
      targetType: "service_request",
      correlationId,
      metadata: {
        requestRef: request.requestRef,
        stepNumber: decidedStep.stepNumber,
        decision: dto.decision,
        comment: dto.comment?.trim() ?? null,
      },
    };

    if (outcome.requestStatus === "REJECTED") {
      await this.repository.transitionStatus(
        ctx.tenantId,
        request.id,
        "AWAITING_APPROVAL",
        "REJECTED",
        ctx.userId,
        "catalog.request.rejected",
        dto.comment?.trim() || null,
        {},
        {
          outbox: [
            {
              eventType: "service_request.approval_decided",
              aggregateType: "service_request",
              aggregateId: request.id,
              correlationId,
              payload: {
                requestId: request.id,
                requestRef: request.requestRef,
                stepNumber: decidedStep.stepNumber,
                decision: dto.decision,
                nextStatus: "REJECTED",
              },
            },
          ],
          audit,
        },
      );
      await this.notificationsService.createSafe({
        tenantId: ctx.tenantId,
        recipientUserId: request.requesterUserId,
        eventType: NotificationEventType.REQUEST_REJECTED,
        title: `Service request ${request.requestRef} rejected`,
        body: dto.comment?.trim() || "The request was rejected",
        resourceType: "service_request",
        resourceId: request.id,
        actorUserId: ctx.userId,
        payload: { requestRef: request.requestRef, comment: dto.comment?.trim() ?? null },
        force: true,
      });
    } else if (outcome.requestStatus === "CHANGES_REQUESTED") {
      await this.repository.transitionStatus(
        ctx.tenantId,
        request.id,
        "AWAITING_APPROVAL",
        "CHANGES_REQUESTED",
        ctx.userId,
        "catalog.request.changes_requested",
        dto.comment?.trim() || null,
        {},
        {
          outbox: [
            {
              eventType: "service_request.changes_requested",
              aggregateType: "service_request",
              aggregateId: request.id,
              correlationId,
              payload: {
                requestId: request.id,
                requestRef: request.requestRef,
                stepNumber: decidedStep.stepNumber,
              },
            },
          ],
          audit,
        },
      );
      await this.notificationsService.createSafe({
        tenantId: ctx.tenantId,
        recipientUserId: request.requesterUserId,
        eventType: NotificationEventType.REQUEST_CHANGES_REQUESTED,
        title: `Changes requested for ${request.requestRef}`,
        body: dto.comment?.trim() || "The approver requested changes",
        resourceType: "service_request",
        resourceId: request.id,
        actorUserId: ctx.userId,
        payload: { requestRef: request.requestRef, comment: dto.comment?.trim() ?? null },
        force: true,
      });
    } else if (outcome.requestStatus === "APPROVED") {
      const now = new Date();
      await this.repository.transitionStatus(
        ctx.tenantId,
        request.id,
        "AWAITING_APPROVAL",
        "APPROVED",
        ctx.userId,
        "catalog.request.approved",
        dto.comment?.trim() || null,
        { approvedAt: now },
        {
          outbox: [
            {
              eventType: "service_request.approval_decided",
              aggregateType: "service_request",
              aggregateId: request.id,
              correlationId,
              payload: {
                requestId: request.id,
                requestRef: request.requestRef,
                stepNumber: decidedStep.stepNumber,
                decision: dto.decision,
                nextStatus: "APPROVED",
              },
            },
          ],
          audit,
        },
      );
      await this.notificationsService.createSafe({
        tenantId: ctx.tenantId,
        recipientUserId: request.requesterUserId,
        eventType: NotificationEventType.REQUEST_APPROVAL_DECIDED,
        title: `Service request ${request.requestRef} approved`,
        body: "The request is approved and ready for fulfillment",
        resourceType: "service_request",
        resourceId: request.id,
        actorUserId: ctx.userId,
        payload: { requestRef: request.requestRef },
        force: true,
      });
    } else {
      // Still awaiting further steps
      await this.repository.addHistory(
        ctx.tenantId,
        request.id,
        "catalog.approval.decided",
        ctx.userId,
        dto.comment?.trim() ?? null,
      );
      await this.prisma.auditEvent.create({
        data: buildAuditEventData({
          action: "catalog.approval.decided",
          actorUserId: ctx.userId,
          correlationId,
          outcome: "SUCCESS",
          targetId: request.id,
          targetType: "service_request",
          tenantId: ctx.tenantId,
          metadata: {
            requestRef: request.requestRef,
            stepNumber: decidedStep.stepNumber,
            decision: dto.decision,
          },
        }),
      });
    }

    return this.loadRequestOrThrow(ctx, request.id);
  }

  // ------------------------------------------------------------------
  // Fulfillment & tickets
  // ------------------------------------------------------------------

  async startFulfillment(
    ctx: RequestContext,
    id: string,
    correlationId?: string,
  ): Promise<ServiceRequestWithRelations> {
    await this.assertCan(ctx, "catalog.request.fulfill");

    const request = await this.loadRequestOrThrow(ctx, id);
    if (request.status !== "APPROVED" && request.status !== "SUBMITTED") {
      throw new ConflictException(
        `Fulfillment can only start from APPROVED or SUBMITTED (current: ${request.status})`,
      );
    }

    const service = await this.servicesRepository.findById(ctx.tenantId, request.serviceId);
    if (!service) {
      throw new NotFoundException("Service not found");
    }

    // Hard gate: approvals must be satisfied before fulfillment begins.
    if (service.approvalMode !== "NONE") {
      const approvals = await this.repository.listApprovals(ctx.tenantId, request.id);
      if (
        !isApprovalGateSatisfied(
          service.approvalMode,
          approvals.map((a) => a.status),
        )
      ) {
        throw new ConflictException("Request approval gate is not satisfied");
      }
    }

    const fulfilled = await this.repository.transitionStatus(
      ctx.tenantId,
      request.id,
      request.status,
      "IN_FULFILLMENT",
      ctx.userId,
      "catalog.request.fulfillment_started",
      undefined,
      { fulfillmentStartedAt: new Date() },
      {
        outbox: [
          {
            eventType: "service_request.fulfillment_started",
            aggregateType: "service_request",
            aggregateId: request.id,
            correlationId,
            payload: {
              requestId: request.id,
              requestRef: request.requestRef,
              serviceId: service.id,
              serviceName: service.name,
              ticketId: request.ticketId ?? null,
            },
          },
        ],
        audit: {
          action: "catalog.request.fulfillment_started",
          actorUserId: ctx.userId,
          targetId: request.id,
          targetType: "service_request",
          correlationId,
          metadata: { requestRef: request.requestRef, serviceName: service.name },
        },
      },
    );
    if (!fulfilled) {
      throw new ConflictException(`Request '${request.requestRef}' could not start fulfillment`);
    }

    await this.notificationsService.createSafe({
      tenantId: ctx.tenantId,
      recipientUserId: request.requesterUserId,
      eventType: NotificationEventType.REQUEST_FULFILLMENT_STARTED,
      title: `Fulfillment started for ${request.requestRef}`,
      body: `${service.name} is being fulfilled`,
      resourceType: "service_request",
      resourceId: request.id,
      actorUserId: ctx.userId,
      payload: { requestRef: request.requestRef, serviceName: service.name },
      force: true,
    });

    if (service.generateTicketOnFulfillment && !request.ticketId) {
      await this.generateTicket(ctx, request.id, correlationId);
    }

    return this.loadRequestOrThrow(ctx, request.id);
  }

  async generateTicket(
    ctx: RequestContext,
    id: string,
    correlationId?: string,
  ): Promise<ServiceRequestWithRelations> {
    await this.assertCan(ctx, "catalog.request.generate_ticket");

    const request = await this.loadRequestOrThrow(ctx, id);
    if (
      request.status === "COMPLETED" ||
      request.status === "CANCELLED" ||
      request.status === "REJECTED"
    ) {
      throw new ConflictException(`Cannot generate a ticket from a ${request.status} request`);
    }

    const service = await this.servicesRepository.findById(ctx.tenantId, request.serviceId);
    if (!service) {
      throw new NotFoundException("Service not found");
    }

    if (service.approvalMode !== "NONE") {
      const approvals = await this.repository.listApprovals(ctx.tenantId, request.id);
      if (
        !isApprovalGateSatisfied(
          service.approvalMode,
          approvals.map((a) => a.status),
        )
      ) {
        throw new ConflictException("Request approval gate is not satisfied");
      }
    }

    const answers = (request.answers ?? {}) as Record<string, unknown>;
    const description = Object.entries(answers)
      .map(([key, value]) => {
        if (
          value === null ||
          value === undefined ||
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          return `${key}: ${String(value)}`;
        }
        if (Array.isArray(value)) {
          return `${key}: ${value.map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item))).join(", ")}`;
        }
        return `${key}: ${JSON.stringify(value)}`;
      })
      .join("\n");

    const { ticket } = await this.repository.generateTicket(
      ctx.tenantId,
      request.id,
      {
        title: `[${request.requestRef}] ${service.name}`,
        description: description || service.description || "Service request fulfillment",
        priority: request.priority,
        type: service.defaultTicketType,
        requesterUserId: request.requesterUserId,
        correlationId,
      },
      {
        action: "catalog.request.ticket_created",
        actorUserId: ctx.userId,
        correlationId,
      },
    );

    // SLA pinning for the generated ticket (best-effort, graceful degradation)
    if (service.slaPolicyId) {
      await this.slaEngine.startTargetsForTicketWithPolicy(
        {
          assigneeUserId: null,
          channel: "WEB",
          createdAt: new Date(),
          id: ticket.id,
          priority: request.priority,
          publicRef: ticket.publicRef,
          requesterUserId: request.requesterUserId,
          status: "NEW",
          tenantId: ctx.tenantId,
          type: service.defaultTicketType,
        },
        service.slaPolicyId,
        ctx.userId,
      );
    }

    await this.notificationsService.createSafe({
      tenantId: ctx.tenantId,
      recipientUserId: request.requesterUserId,
      eventType: NotificationEventType.REQUEST_TICKET_CREATED,
      title: `Ticket ${ticket.publicRef} created for ${request.requestRef}`,
      body: "Your request generated a support ticket",
      resourceType: "service_request",
      resourceId: request.id,
      actorUserId: ctx.userId,
      payload: { requestRef: request.requestRef, ticketId: ticket.id, publicRef: ticket.publicRef },
      force: true,
    });

    return this.loadRequestOrThrow(ctx, request.id);
  }

  async complete(
    ctx: RequestContext,
    id: string,
    note?: string,
    correlationId?: string,
  ): Promise<ServiceRequestWithRelations> {
    await this.assertCan(ctx, "catalog.request.complete");

    const request = await this.loadRequestOrThrow(ctx, id);
    if (request.status !== "IN_FULFILLMENT") {
      throw new ConflictException(
        `Only requests in fulfillment can be completed (current: ${request.status})`,
      );
    }

    const completed = await this.repository.transitionStatus(
      ctx.tenantId,
      request.id,
      "IN_FULFILLMENT",
      "COMPLETED",
      ctx.userId,
      "catalog.request.completed",
      note?.trim() || null,
      { completedAt: new Date() },
      {
        outbox: [
          {
            eventType: "service_request.completed",
            aggregateType: "service_request",
            aggregateId: request.id,
            correlationId,
            payload: {
              requestId: request.id,
              requestRef: request.requestRef,
              ticketId: request.ticketId ?? null,
            },
          },
        ],
        audit: {
          action: "catalog.request.completed",
          actorUserId: ctx.userId,
          targetId: request.id,
          targetType: "service_request",
          correlationId,
          metadata: { requestRef: request.requestRef, note: note?.trim() ?? null },
        },
      },
    );
    if (!completed) {
      throw new ConflictException(`Request '${request.requestRef}' could not be completed`);
    }

    await this.notificationsService.createSafe({
      tenantId: ctx.tenantId,
      recipientUserId: request.requesterUserId,
      eventType: NotificationEventType.REQUEST_COMPLETED,
      title: `Service request ${request.requestRef} completed`,
      body: note?.trim() || "Your request has been fulfilled",
      resourceType: "service_request",
      resourceId: request.id,
      actorUserId: ctx.userId,
      payload: { requestRef: request.requestRef, note: note?.trim() ?? null },
      force: true,
    });

    return this.loadRequestOrThrow(ctx, request.id);
  }

  // ------------------------------------------------------------------
  // Attachments
  // ------------------------------------------------------------------

  private validateAttachmentUpload(
    originalFilename: string,
    mimeType: string,
    size: number,
  ): string {
    const extension = extractExtension(originalFilename);
    if (!extension || !ATTACHMENT_ALLOWED_EXTENSIONS.has(extension)) {
      throw new BadRequestException(`File type .${extension} is not allowed`);
    }
    if (!ATTACHMENT_ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
      throw new BadRequestException(`MIME type ${mimeType} is not allowed`);
    }
    if (size > ATTACHMENT_MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException("File exceeds the maximum allowed size");
    }
    return extension;
  }

  async uploadAttachment(
    ctx: RequestContext,
    id: string,
    input: { originalFilename: string; mimeType: string; size: number; buffer: Buffer },
    correlationId?: string,
  ) {
    const request = await this.loadRequestOrThrow(ctx, id);
    if (request.requesterUserId !== ctx.userId) {
      await this.assertCan(ctx, "catalog.request.read_all");
    }
    await this.assertCan(ctx, "catalog.request.attachment.create");

    const existing = await this.repository.listAttachments(ctx.tenantId, request.id);
    if (existing.length >= REQUEST_ATTACHMENT_MAX_FILES) {
      throw new BadRequestException(
        `Requests allow at most ${REQUEST_ATTACHMENT_MAX_FILES} attachments`,
      );
    }

    const extension = this.validateAttachmentUpload(
      input.originalFilename,
      input.mimeType,
      input.size,
    );

    const stored = await this.storage.writeFileForRequest({
      tenantId: ctx.tenantId,
      requestId: request.id,
      extension,
      source: input.buffer,
    });

    const scanResult = await this.virusScanner.scan(stored.absolutePath);
    if (scanResult === "infected") {
      await this.storage.deleteFile(stored.absolutePath);
      throw new UnprocessableEntityException({
        code: "ATTACHMENT_NOT_CLEAN",
        message: "Attachment failed virus scan",
      });
    }

    const attachment = await this.repository.createAttachment(ctx.tenantId, request.id, {
      fileName: stored.storedFilename,
      originalName: sanitizeOriginalFilename(input.originalFilename),
      mimeType: input.mimeType.toLowerCase(),
      sizeBytes: BigInt(input.size),
      storagePath: stored.relativePath,
      uploadedById: ctx.userId,
    });

    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: "catalog.request.attachment.added",
        actorUserId: ctx.userId,
        correlationId,
        outcome: "SUCCESS",
        targetId: request.id,
        targetType: "service_request",
        tenantId: ctx.tenantId,
        metadata: {
          requestRef: request.requestRef,
          fileName: attachment.originalName,
          sizeBytes: input.size,
          scanResult,
        },
      }),
    });

    return attachment;
  }

  async listAttachments(ctx: RequestContext, id: string) {
    const request = await this.loadRequestOrThrow(ctx, id);
    await this.assertRequestVisible(ctx, request);
    return this.repository.listAttachments(ctx.tenantId, request.id);
  }

  async deleteAttachment(
    ctx: RequestContext,
    id: string,
    attachmentId: string,
    correlationId?: string,
  ) {
    const request = await this.loadRequestOrThrow(ctx, id);
    if (request.requesterUserId !== ctx.userId) {
      await this.assertCan(ctx, "catalog.request.read_all");
    }
    await this.assertCan(ctx, "catalog.request.attachment.delete");

    const attachment = await this.repository.getAttachment(ctx.tenantId, attachmentId);
    if (!attachment || attachment.requestId !== request.id) {
      throw new NotFoundException("Attachment not found for this request");
    }

    await this.repository.deleteAttachment(ctx.tenantId, attachmentId);
    await this.storage.deleteFile(attachment.storagePath);

    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: "catalog.request.attachment.removed",
        actorUserId: ctx.userId,
        correlationId,
        outcome: "SUCCESS",
        targetId: request.id,
        targetType: "service_request",
        tenantId: ctx.tenantId,
        metadata: { requestRef: request.requestRef, fileName: attachment.originalName },
      }),
    });

    return { id: attachmentId, removed: true };
  }
}
