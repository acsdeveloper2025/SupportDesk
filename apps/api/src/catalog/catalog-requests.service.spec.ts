/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../database/prisma.service";
import type { NotificationsService } from "../notifications/notifications.service";
import type { RbacService } from "../rbac/rbac.service";
import type { SlaEngineService } from "../sla/sla-engine.service";
import type { LocalAttachmentStorage } from "../ticketing/attachments/local-attachment-storage";
import type { VirusScanner } from "../ticketing/attachments/virus-scanner";
import type { CatalogRequestsRepository } from "./catalog-requests.repository";
import { CatalogRequestsService } from "./catalog-requests.service";
import type { CatalogServicesRepository } from "./catalog-services.repository";
import type { CatalogTemplatesRepository } from "./catalog-templates.repository";

const TENANT = "11111111-1111-1111-1111-111111111111";
const USER = "22222222-2222-2222-2222-222222222222";

function buildRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    tenantId: TENANT,
    requestRef: "REQ-000001",
    serviceId: "svc-1",
    serviceName: "Software Request",
    serviceKind: "BUSINESS",
    submittedFormVersion: 1,
    answers: { software: "word" },
    requesterUserId: USER,
    requestedForUserId: null,
    status: "SUBMITTED",
    priority: "MEDIUM",
    ticketId: null,
    submittedAt: new Date(),
    approvedAt: null,
    fulfillmentStartedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelledReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    service: { id: "svc-1", name: "Software Request", slug: "software-request", kind: "BUSINESS" },
    ticket: null,
    approvals: [],
    attachments: [],
    ...overrides,
  };
}

function buildService(overrides: Record<string, unknown> = {}) {
  return {
    id: "svc-1",
    tenantId: TENANT,
    categoryId: "cat-1",
    name: "Software Request",
    slug: "software-request",
    kind: "BUSINESS",
    state: "PUBLISHED",
    approvalMode: "NONE",
    approvalSteps: [],
    slaPolicyId: null,
    defaultTicketType: "FEATURE_REQUEST",
    defaultPriority: "MEDIUM",
    suggestedKbTags: [],
    generateTicketOnFulfillment: true,
    form: {
      id: "form-1",
      serviceId: "svc-1",
      formVersion: 1,
      schema: {
        fields: [{ key: "software", label: "Software", type: "TEXT", required: true }],
      },
    },
    ...overrides,
  };
}

describe("CatalogRequestsService", () => {
  let service: CatalogRequestsService;
  let repository: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    listByRequester: ReturnType<typeof vi.fn>;
    listAll: ReturnType<typeof vi.fn>;
    listHistory: ReturnType<typeof vi.fn>;
    listApprovals: ReturnType<typeof vi.fn>;
    updateAnswers: ReturnType<typeof vi.fn>;
    resetApprovalCycle: ReturnType<typeof vi.fn>;
    transitionStatus: ReturnType<typeof vi.fn>;
    addHistory: ReturnType<typeof vi.fn>;
    getApproval: ReturnType<typeof vi.fn>;
    decideApproval: ReturnType<typeof vi.fn>;
    generateTicket: ReturnType<typeof vi.fn>;
    listAttachments: ReturnType<typeof vi.fn>;
    getAttachment: ReturnType<typeof vi.fn>;
    createAttachment: ReturnType<typeof vi.fn>;
    deleteAttachment: ReturnType<typeof vi.fn>;
  };
  let servicesRepository: {
    findById: ReturnType<typeof vi.fn>;
  };
  let templatesRepository: {
    findById: ReturnType<typeof vi.fn>;
  };
  let notificationsService: {
    createSafe: ReturnType<typeof vi.fn>;
  };
  let rbacService: {
    can: ReturnType<typeof vi.fn>;
  };
  let slaEngine: {
    startTargetsForTicketWithPolicy: ReturnType<typeof vi.fn>;
  };
  let storage: {
    writeFileForRequest: ReturnType<typeof vi.fn>;
    deleteFile: ReturnType<typeof vi.fn>;
  };
  let virusScanner: {
    scan: ReturnType<typeof vi.fn>;
  };
  let prisma: {
    auditEvent: {
      create: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    repository = {
      create: vi.fn(),
      findById: vi.fn(),
      listByRequester: vi.fn(),
      listAll: vi.fn(),
      listHistory: vi.fn(),
      listApprovals: vi.fn(),
      updateAnswers: vi.fn(),
      resetApprovalCycle: vi.fn(),
      transitionStatus: vi.fn(),
      addHistory: vi.fn(),
      getApproval: vi.fn(),
      decideApproval: vi.fn(),
      generateTicket: vi.fn(),
      listAttachments: vi.fn(),
      getAttachment: vi.fn(),
      createAttachment: vi.fn(),
      deleteAttachment: vi.fn(),
    };
    servicesRepository = { findById: vi.fn() };
    templatesRepository = { findById: vi.fn() };
    notificationsService = { createSafe: vi.fn().mockResolvedValue(null) };
    rbacService = { can: vi.fn().mockResolvedValue(true) };
    slaEngine = { startTargetsForTicketWithPolicy: vi.fn().mockResolvedValue(undefined) };
    storage = {
      writeFileForRequest: vi.fn().mockResolvedValue({
        absolutePath: "/tmp/a.pdf",
        relativePath: "a.pdf",
        sha256: "x",
        storedFilename: "a.pdf",
      }),
      deleteFile: vi.fn().mockResolvedValue(undefined),
    };
    virusScanner = { scan: vi.fn().mockResolvedValue("clean") };
    prisma = {
      auditEvent: { create: vi.fn().mockResolvedValue({ id: "aud-1" }) },
    };
    service = new CatalogRequestsService(
      repository as unknown as CatalogRequestsRepository,
      servicesRepository as unknown as CatalogServicesRepository,
      templatesRepository as unknown as CatalogTemplatesRepository,
      notificationsService as unknown as NotificationsService,
      rbacService as unknown as RbacService,
      slaEngine as unknown as SlaEngineService,
      storage as unknown as LocalAttachmentStorage,
      virusScanner as unknown as VirusScanner,
      prisma as unknown as PrismaService,
    );
  });

  describe("submit", () => {
    it("submits a request without approvals and notifies the requester", async () => {
      servicesRepository.findById.mockResolvedValue(buildService());
      repository.create.mockResolvedValue(buildRequest());
      repository.findById.mockResolvedValue(buildRequest());

      const res = await service.submit(
        { tenantId: TENANT, userId: USER },
        { serviceId: "svc-1", answers: { software: "word" } },
      );

      expect(res.requestRef).toBe("REQ-000001");
      expect(repository.create).toHaveBeenCalledWith(
        TENANT,
        expect.objectContaining({ approvalMode: "NONE", approvalSteps: [] }),
        expect.anything(),
      );
      expect(notificationsService.createSafe).toHaveBeenCalledTimes(1);
    });

    it("rejects requests for unpublished services", async () => {
      servicesRepository.findById.mockResolvedValue(buildService({ state: "DRAFT" }));

      await expect(
        service.submit({ tenantId: TENANT, userId: USER }, { serviceId: "svc-1", answers: {} }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects requests when the service has no form", async () => {
      servicesRepository.findById.mockResolvedValue(buildService({ form: null }));

      await expect(
        service.submit({ tenantId: TENANT, userId: USER }, { serviceId: "svc-1", answers: {} }),
      ).rejects.toThrow(BadRequestException);
    });

    it("fails validation on invalid answers", async () => {
      servicesRepository.findById.mockResolvedValue(buildService());

      await expect(
        service.submit({ tenantId: TENANT, userId: USER }, { serviceId: "svc-1", answers: {} }),
      ).rejects.toThrow(BadRequestException);
    });

    it("creates approval steps and notifies approvers when configured", async () => {
      const service1 = buildService({
        approvalMode: "ALL",
        approvalSteps: [
          {
            ordinal: 1,
            approverRole: "manager",
            approverUserId: "55555555-5555-5555-5555-555555555555",
          },
        ],
      });
      servicesRepository.findById.mockResolvedValue(service1);
      repository.create.mockResolvedValue(buildRequest({ status: "AWAITING_APPROVAL" }));
      repository.findById.mockResolvedValue(buildRequest({ status: "AWAITING_APPROVAL" }));

      await service.submit(
        { tenantId: TENANT, userId: USER },
        { serviceId: "svc-1", answers: { software: "word" } },
      );

      expect(repository.create).toHaveBeenCalledWith(
        TENANT,
        expect.objectContaining({
          approvalMode: "ALL",
          approvalSteps: [
            {
              ordinal: 1,
              approverRole: "manager",
              approverUserId: "55555555-5555-5555-5555-555555555555",
            },
          ],
        }),
        expect.anything(),
      );
      expect(notificationsService.createSafe).toHaveBeenCalledTimes(2);
    });
  });

  describe("getRequest visibility", () => {
    it("denies access when the user is not the requester and lacks read_all", async () => {
      repository.findById.mockResolvedValue(buildRequest({ requesterUserId: "someone-else" }));
      rbacService.can.mockResolvedValue(false);

      await expect(service.getRequest({ tenantId: TENANT, userId: USER }, "req-1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("allows the requester to read their own request", async () => {
      repository.findById.mockResolvedValue(buildRequest());
      rbacService.can.mockImplementation(
        ({ permissionKey }) => permissionKey !== "catalog.request.read_all",
      );

      const res = await service.getRequest({ tenantId: TENANT, userId: USER }, "req-1");

      expect(res.id).toBe("req-1");
    });
  });

  describe("updateAnswers", () => {
    it("rejects updates outside editable statuses", async () => {
      repository.findById.mockResolvedValue(buildRequest({ status: "IN_FULFILLMENT" }));

      await expect(
        service.updateAnswers({ tenantId: TENANT, userId: USER }, "req-1", { answers: {} }),
      ).rejects.toThrow(ConflictException);
    });

    it("updates answers and resets the approval cycle for CHANGES_REQUESTED", async () => {
      repository.findById.mockResolvedValue(buildRequest({ status: "CHANGES_REQUESTED" }));
      servicesRepository.findById.mockResolvedValue(
        buildService({
          approvalMode: "ALL",
          approvalSteps: [
            {
              ordinal: 1,
              approverRole: "manager",
              approverUserId: "55555555-5555-5555-5555-555555555555",
            },
          ],
        }),
      );
      repository.updateAnswers.mockResolvedValue(buildRequest({ status: "CHANGES_REQUESTED" }));

      await service.updateAnswers({ tenantId: TENANT, userId: USER }, "req-1", {
        answers: { software: "excel" },
      });

      expect(repository.updateAnswers).toHaveBeenCalled();
      expect(repository.resetApprovalCycle).toHaveBeenCalled();
    });

    it("allows the requester to update answers on their own request without read_all", async () => {
      repository.findById.mockResolvedValue(
        buildRequest({ requesterUserId: USER, status: "CHANGES_REQUESTED" }),
      );
      servicesRepository.findById.mockResolvedValue(buildService());
      repository.updateAnswers.mockResolvedValue(buildRequest({ status: "SUBMITTED" }));
      rbacService.can.mockImplementation(
        ({ permissionKey }) => permissionKey !== "catalog.request.read_all",
      );

      await expect(
        service.updateAnswers({ tenantId: TENANT, userId: USER }, "req-1", {
          answers: { software: "excel" },
        }),
      ).resolves.toBeDefined();
    });

    it("rejects non-requester answer updates without read_all", async () => {
      repository.findById.mockResolvedValue(
        buildRequest({ requesterUserId: "other-user", status: "CHANGES_REQUESTED" }),
      );
      rbacService.can.mockImplementation(
        ({ permissionKey }) => permissionKey !== "catalog.request.read_all",
      );

      await expect(
        service.updateAnswers({ tenantId: TENANT, userId: USER }, "req-1", {
          answers: { software: "excel" },
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.updateAnswers).not.toHaveBeenCalled();
    });
  });

  describe("cancel", () => {
    it("cancels a submitted request and notifies the requester", async () => {
      repository.findById
        .mockResolvedValueOnce(buildRequest())
        .mockResolvedValueOnce(buildRequest({ status: "CANCELLED" }));
      repository.transitionStatus.mockResolvedValue(buildRequest({ status: "CANCELLED" }));

      const res = await service.cancel({ tenantId: TENANT, userId: USER }, "req-1", {
        reason: "No longer needed",
      });

      expect(repository.transitionStatus).toHaveBeenCalledWith(
        TENANT,
        "req-1",
        "SUBMITTED",
        "CANCELLED",
        USER,
        "catalog.request.cancelled",
        "No longer needed",
        expect.objectContaining({ cancelledReason: "No longer needed" }),
        expect.objectContaining({
          outbox: [expect.objectContaining({ eventType: "service_request.cancelled" })],
        }),
      );
      expect(res.status).toBe("CANCELLED");
    });

    it("rejects cancellation of terminal requests", async () => {
      repository.findById.mockResolvedValue(buildRequest({ status: "COMPLETED" }));

      await expect(service.cancel({ tenantId: TENANT, userId: USER }, "req-1", {})).rejects.toThrow(
        ConflictException,
      );
    });

    it("allows the requester to cancel their own request without read_all", async () => {
      repository.findById
        .mockResolvedValueOnce(buildRequest({ requesterUserId: USER }))
        .mockResolvedValueOnce(buildRequest({ requesterUserId: USER, status: "CANCELLED" }));
      repository.transitionStatus.mockResolvedValue(buildRequest({ status: "CANCELLED" }));
      rbacService.can.mockImplementation(
        ({ permissionKey }) => permissionKey !== "catalog.request.read_all",
      );

      const res = await service.cancel({ tenantId: TENANT, userId: USER }, "req-1", {
        reason: "No longer needed",
      });

      expect(res.status).toBe("CANCELLED");
      expect(repository.transitionStatus).toHaveBeenCalled();
    });

    it("rejects non-requester cancellation without read_all", async () => {
      repository.findById.mockResolvedValue(buildRequest({ requesterUserId: "other-user" }));
      rbacService.can.mockImplementation(
        ({ permissionKey }) => permissionKey !== "catalog.request.read_all",
      );

      await expect(
        service.cancel({ tenantId: TENANT, userId: USER }, "req-1", { reason: "Admin override" }),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.transitionStatus).not.toHaveBeenCalled();
    });

    it("rejects cancellation without the catalog.request.cancel permission", async () => {
      repository.findById
        .mockResolvedValueOnce(buildRequest({ requesterUserId: USER }))
        .mockResolvedValueOnce(buildRequest({ requesterUserId: USER, status: "CANCELLED" }));
      rbacService.can.mockResolvedValue(false);

      await expect(
        service.cancel({ tenantId: TENANT, userId: USER }, "req-1", { reason: "No longer needed" }),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.transitionStatus).not.toHaveBeenCalled();
    });
  });

  describe("decideApproval", () => {
    it("rejects when the request is not awaiting approval", async () => {
      repository.findById.mockResolvedValue(buildRequest({ status: "SUBMITTED" }));

      await expect(
        service.decideApproval({ tenantId: TENANT, userId: USER }, "req-1", "appr-1", {
          decision: "APPROVED",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("rejects decisions on already-decided steps", async () => {
      repository.findById.mockResolvedValue(buildRequest({ status: "AWAITING_APPROVAL" }));
      repository.getApproval.mockResolvedValue({ requestId: "req-1", status: "APPROVED" });

      await expect(
        service.decideApproval({ tenantId: TENANT, userId: USER }, "req-1", "appr-1", {
          decision: "APPROVED",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("transitions to REJECTED on a rejection", async () => {
      repository.findById
        .mockResolvedValueOnce(buildRequest({ status: "AWAITING_APPROVAL" }))
        .mockResolvedValueOnce(buildRequest({ status: "REJECTED" }));
      repository.getApproval.mockResolvedValue({ requestId: "req-1", status: "PENDING" });
      repository.decideApproval.mockResolvedValue({
        step: { stepNumber: 1 },
        statuses: ["REJECTED"],
      });
      repository.transitionStatus.mockResolvedValue(buildRequest({ status: "REJECTED" }));

      const res = await service.decideApproval(
        { tenantId: TENANT, userId: USER },
        "req-1",
        "appr-1",
        { decision: "REJECTED", comment: "Not eligible" },
      );

      expect(repository.transitionStatus).toHaveBeenCalledWith(
        TENANT,
        "req-1",
        "AWAITING_APPROVAL",
        "REJECTED",
        USER,
        "catalog.request.rejected",
        "Not eligible",
        expect.anything(),
        expect.objectContaining({
          outbox: [expect.objectContaining({ eventType: "service_request.approval_decided" })],
        }),
      );
      expect(res.status).toBe("REJECTED");
    });

    it("approves the request when the gate becomes satisfied", async () => {
      repository.findById
        .mockResolvedValueOnce(buildRequest({ status: "AWAITING_APPROVAL" }))
        .mockResolvedValueOnce(buildRequest({ status: "APPROVED" }));
      repository.getApproval.mockResolvedValue({ requestId: "req-1", status: "PENDING" });
      repository.decideApproval.mockResolvedValue({
        step: { stepNumber: 1 },
        statuses: ["APPROVED"],
      });
      servicesRepository.findById.mockResolvedValue(buildService({ approvalMode: "SINGLE" }));
      repository.transitionStatus.mockResolvedValue(buildRequest({ status: "APPROVED" }));

      const res = await service.decideApproval(
        { tenantId: TENANT, userId: USER },
        "req-1",
        "appr-1",
        { decision: "APPROVED" },
      );

      expect(repository.transitionStatus).toHaveBeenCalledWith(
        TENANT,
        "req-1",
        "AWAITING_APPROVAL",
        "APPROVED",
        USER,
        "catalog.request.approved",
        null,
        expect.objectContaining({ approvedAt: expect.any(Date) }),
        expect.anything(),
      );
      expect(res.status).toBe("APPROVED");
    });

    it("keeps the request awaiting approval when more steps remain in ALL mode", async () => {
      repository.findById.mockResolvedValue(buildRequest({ status: "AWAITING_APPROVAL" }));
      repository.getApproval.mockResolvedValue({ requestId: "req-1", status: "PENDING" });
      repository.decideApproval.mockResolvedValue({
        step: { stepNumber: 1 },
        statuses: ["APPROVED", "PENDING"],
      });
      servicesRepository.findById.mockResolvedValue(buildService({ approvalMode: "ALL" }));

      await service.decideApproval({ tenantId: TENANT, userId: USER }, "req-1", "appr-1", {
        decision: "APPROVED",
      });

      expect(repository.transitionStatus).not.toHaveBeenCalled();
      expect(repository.addHistory).toHaveBeenCalled();
    });
  });

  describe("startFulfillment", () => {
    it("rejects fulfillment when the approval gate is not satisfied", async () => {
      repository.findById.mockResolvedValue(buildRequest({ status: "APPROVED" }));
      servicesRepository.findById.mockResolvedValue(buildService({ approvalMode: "SINGLE" }));
      repository.listApprovals.mockResolvedValue([{ status: "PENDING" }]);

      await expect(
        service.startFulfillment({ tenantId: TENANT, userId: USER }, "req-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("starts fulfillment and generates a ticket automatically", async () => {
      repository.findById
        .mockResolvedValueOnce(buildRequest({ status: "APPROVED" }))
        .mockResolvedValueOnce(
          buildRequest({
            status: "IN_FULFILLMENT",
            ticketId: "tkt-1",
            ticket: { id: "tkt-1", publicRef: "TKT-1001" },
          }),
        )
        .mockResolvedValueOnce(
          buildRequest({
            status: "IN_FULFILLMENT",
            ticketId: "tkt-1",
            ticket: { id: "tkt-1", publicRef: "TKT-1001" },
          }),
        )
        .mockResolvedValueOnce(
          buildRequest({
            status: "IN_FULFILLMENT",
            ticketId: "tkt-1",
            ticket: { id: "tkt-1", publicRef: "TKT-1001" },
          }),
        );
      servicesRepository.findById.mockResolvedValue(buildService());
      repository.listApprovals.mockResolvedValue([]);
      repository.transitionStatus.mockResolvedValue(buildRequest({ status: "IN_FULFILLMENT" }));
      repository.generateTicket.mockResolvedValue({
        request: buildRequest({ status: "IN_FULFILLMENT", ticketId: "tkt-1" }),
        ticket: { id: "tkt-1", publicRef: "TKT-1001" },
      });

      const res = await service.startFulfillment({ tenantId: TENANT, userId: USER }, "req-1");

      expect(repository.transitionStatus).toHaveBeenCalledWith(
        TENANT,
        "req-1",
        "APPROVED",
        "IN_FULFILLMENT",
        USER,
        "catalog.request.fulfillment_started",
        undefined,
        expect.objectContaining({ fulfillmentStartedAt: expect.any(Date) }),
        expect.objectContaining({
          outbox: [expect.objectContaining({ eventType: "service_request.fulfillment_started" })],
        }),
      );
      expect(repository.generateTicket).toHaveBeenCalled();
      expect(res.ticketId).toBe("tkt-1");
    });
  });

  describe("generateTicket", () => {
    it("generates a ticket and pins SLA targets when the service has a policy", async () => {
      repository.findById.mockResolvedValue(buildRequest());
      servicesRepository.findById.mockResolvedValue(buildService({ slaPolicyId: "sla-1" }));
      repository.generateTicket.mockResolvedValue({
        request: buildRequest({ ticketId: "tkt-1" }),
        ticket: { id: "tkt-1", publicRef: "TKT-1001" },
      });

      await service.generateTicket({ tenantId: TENANT, userId: USER }, "req-1");

      expect(repository.generateTicket).toHaveBeenCalledWith(
        TENANT,
        "req-1",
        expect.objectContaining({ title: "[REQ-000001] Software Request" }),
        expect.objectContaining({ action: "catalog.request.ticket_created" }),
      );
      expect(slaEngine.startTargetsForTicketWithPolicy).toHaveBeenCalledWith(
        expect.objectContaining({ id: "tkt-1", publicRef: "TKT-1001" }),
        "sla-1",
        USER,
      );
      expect(notificationsService.createSafe).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "REQUEST_TICKET_CREATED" }),
      );
    });

    it("skips SLA pinning when the service has no policy", async () => {
      repository.findById.mockResolvedValue(buildRequest());
      servicesRepository.findById.mockResolvedValue(buildService({ slaPolicyId: null }));
      repository.generateTicket.mockResolvedValue({
        request: buildRequest({ ticketId: "tkt-1" }),
        ticket: { id: "tkt-1", publicRef: "TKT-1001" },
      });

      await service.generateTicket({ tenantId: TENANT, userId: USER }, "req-1");

      expect(slaEngine.startTargetsForTicketWithPolicy).not.toHaveBeenCalled();
    });
  });

  describe("complete", () => {
    it("completes requests in fulfillment", async () => {
      repository.findById
        .mockResolvedValueOnce(buildRequest({ status: "IN_FULFILLMENT" }))
        .mockResolvedValueOnce(buildRequest({ status: "COMPLETED" }));
      repository.transitionStatus.mockResolvedValue(buildRequest({ status: "COMPLETED" }));

      const res = await service.complete({ tenantId: TENANT, userId: USER }, "req-1", "Done");

      expect(repository.transitionStatus).toHaveBeenCalledWith(
        TENANT,
        "req-1",
        "IN_FULFILLMENT",
        "COMPLETED",
        USER,
        "catalog.request.completed",
        "Done",
        expect.objectContaining({ completedAt: expect.any(Date) }),
        expect.objectContaining({
          outbox: [expect.objectContaining({ eventType: "service_request.completed" })],
        }),
      );
      expect(res.status).toBe("COMPLETED");
    });

    it("rejects completion outside fulfillment", async () => {
      repository.findById.mockResolvedValue(buildRequest({ status: "SUBMITTED" }));

      await expect(service.complete({ tenantId: TENANT, userId: USER }, "req-1")).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("attachments", () => {
    it("rejects disallowed file types", async () => {
      repository.findById.mockResolvedValue(buildRequest());
      repository.listAttachments.mockResolvedValue([]);

      await expect(
        service.uploadAttachment({ tenantId: TENANT, userId: USER }, "req-1", {
          originalFilename: "evil.exe",
          mimeType: "application/x-msdownload",
          size: 10,
          buffer: Buffer.from("x"),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("scans, stores, and persists a valid attachment", async () => {
      repository.findById.mockResolvedValue(buildRequest());
      repository.listAttachments.mockResolvedValue([]);
      repository.createAttachment.mockResolvedValue({
        id: "att-1",
        originalName: "doc.pdf",
        sizeBytes: 10n,
        mimeType: "application/pdf",
      });

      const res = await service.uploadAttachment({ tenantId: TENANT, userId: USER }, "req-1", {
        originalFilename: "doc.pdf",
        mimeType: "application/pdf",
        size: 10,
        buffer: Buffer.from("pdf"),
      });

      expect(virusScanner.scan).toHaveBeenCalledWith("/tmp/a.pdf");
      expect(storage.writeFileForRequest).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT, requestId: "req-1", extension: "pdf" }),
      );
      expect(repository.createAttachment).toHaveBeenCalled();
      expect(res.originalName).toBe("doc.pdf");
    });

    it("deletes the stored file and throws when the virus scan is infected", async () => {
      repository.findById.mockResolvedValue(buildRequest());
      repository.listAttachments.mockResolvedValue([]);
      virusScanner.scan.mockResolvedValue("infected");

      await expect(
        service.uploadAttachment({ tenantId: TENANT, userId: USER }, "req-1", {
          originalFilename: "doc.pdf",
          mimeType: "application/pdf",
          size: 10,
          buffer: Buffer.from("x"),
        }),
      ).rejects.toThrow(/virus/i);
      expect(storage.deleteFile).toHaveBeenCalledWith("/tmp/a.pdf");
    });

    it("enforces the maximum attachment count", async () => {
      repository.findById.mockResolvedValue(buildRequest());
      repository.listAttachments.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({ id: `a-${i}` })),
      );

      await expect(
        service.uploadAttachment({ tenantId: TENANT, userId: USER }, "req-1", {
          originalFilename: "doc.pdf",
          mimeType: "application/pdf",
          size: 10,
          buffer: Buffer.from("x"),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
