import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { TicketPriority, TicketStatus, TicketType } from "@prisma/client";
import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthenticatedRequestContext } from "../auth/guards/auth-context";
import { setAuthenticatedRequestContext } from "../auth/guards/auth-context";
import type { RbacService } from "../rbac/rbac.service";
import { TicketAggregate, TicketConcurrencyException } from "./domain/ticket.aggregate";
import { TicketsController } from "./tickets.controller";
import type { TicketsService } from "./tickets.service";

describe("TicketsController (Unit & API Integration Tests)", () => {
  let controller: TicketsController;
  let service: TicketsService;
  let rbacService: RbacService;

  let createTicketMock: ReturnType<typeof vi.fn>;
  let getTicketByIdMock: ReturnType<typeof vi.fn>;
  let getTicketByPublicRefMock: ReturnType<typeof vi.fn>;
  let updateTicketMock: ReturnType<typeof vi.fn>;
  let transitionStatusMock: ReturnType<typeof vi.fn>;
  let assignTicketMock: ReturnType<typeof vi.fn>;
  let unassignTicketMock: ReturnType<typeof vi.fn>;
  let listTicketsMock: ReturnType<typeof vi.fn>;
  let countTicketsMock: ReturnType<typeof vi.fn>;
  let canMock: ReturnType<typeof vi.fn>;

  const tenantA = "11111111-1111-1111-1111-111111111111";
  const userA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

  const mockContext: AuthenticatedRequestContext = {
    email: "agent@tenant.com",
    emailNormalized: "agent@tenant.com",
    emailVerified: true,
    passwordChangeRequired: false,
    permissions: [],
    preferences: {},
    profile: {
      displayName: "Agent Smith",
      firstName: "Agent",
      language: "en",
      lastName: "Smith",
      locale: "en-US",
      profilePicturePlaceholder: null,
      timeZone: "UTC",
    },
    publicId: "pub-1",
    roles: [],
    sessionId: "sess-1",
    tenantId: tenantA,
    userId: userA,
  };

  const sampleTicket = TicketAggregate.create({
    description: "Laptop screen flickering intermittently.",
    id: "tkt-id-001",
    publicRef: "TKT-1001",
    requesterUserId: userA,
    tenantId: tenantA,
    title: "Screen Flickering Issue",
  });

  const updatedSampleTicket = TicketAggregate.create({
    description: "Updated description details.",
    id: "tkt-id-001",
    publicRef: "TKT-1001",
    requesterUserId: userA,
    tenantId: tenantA,
    title: "Updated Title",
  });

  beforeEach(() => {
    createTicketMock = vi.fn().mockResolvedValue(sampleTicket);
    getTicketByIdMock = vi.fn().mockImplementation((tId: string, id: string) => {
      if (tId === tenantA && id === "tkt-id-001") {
        return Promise.resolve(sampleTicket);
      }
      return Promise.reject(new NotFoundException(`Ticket with ID ${id} not found`));
    });
    getTicketByPublicRefMock = vi.fn().mockImplementation((tId: string, ref: string) => {
      if (tId === tenantA && ref === "TKT-1001") {
        return Promise.resolve(sampleTicket);
      }
      return Promise.reject(new NotFoundException(`Ticket with reference ${ref} not found`));
    });
    updateTicketMock = vi.fn().mockImplementation((dto: { expectedVersion: number }) => {
      if (dto.expectedVersion !== 1) {
        return Promise.reject(new TicketConcurrencyException(dto.expectedVersion, 2, "tkt-id-001"));
      }
      return Promise.resolve(updatedSampleTicket);
    });
    listTicketsMock = vi.fn().mockResolvedValue({
      appliedFilters: {},
      currentPage: 1,
      hasNextPage: false,
      hasPreviousPage: false,
      items: [sampleTicket],
      pageSize: 20,
      sort: { field: "createdAt", direction: "desc" },
      totalPages: 1,
      totalRecords: 1,
    });
    countTicketsMock = vi.fn().mockResolvedValue({ count: 1 });
    canMock = vi.fn().mockResolvedValue(true);

    transitionStatusMock = vi.fn().mockResolvedValue(
      // Simulate a ticket in OPEN state after transition
      (() => {
        const t = TicketAggregate.create({
          description: "Laptop screen flickering intermittently.",
          id: "tkt-id-001",
          publicRef: "TKT-1001",
          requesterUserId: userA,
          tenantId: tenantA,
          title: "Screen Flickering Issue",
        });
        t.transitionTo(TicketStatus.OPEN, 1);
        return t;
      })(),
    );

    const agentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const assignedTicket = TicketAggregate.create({
      description: "Laptop screen flickering intermittently.",
      id: "tkt-id-001",
      publicRef: "TKT-1001",
      requesterUserId: userA,
      tenantId: tenantA,
      title: "Screen Flickering Issue",
    });
    assignedTicket.assign({ assigneeUserId: agentId }, 1);

    assignTicketMock = vi.fn().mockResolvedValue(assignedTicket);
    unassignTicketMock = vi.fn().mockResolvedValue(sampleTicket);

    service = {
      assignTicket: assignTicketMock,
      countTickets: countTicketsMock,
      createTicket: createTicketMock,
      getTicketById: getTicketByIdMock,
      getTicketByPublicRef: getTicketByPublicRefMock,
      listTickets: listTicketsMock,
      transitionStatus: transitionStatusMock,
      unassignTicket: unassignTicketMock,
      updateTicket: updateTicketMock,
    } as unknown as TicketsService;

    rbacService = {
      can: canMock,
    } as unknown as RbacService;

    controller = new TicketsController(service, rbacService);
  });

  function createMockRequest(): Request {
    const req = {
      header: vi.fn().mockReturnValue("test-user-agent"),
      headers: { "user-agent": "test-user-agent" },
      ip: "127.0.0.1",
    } as unknown as Request;
    setAuthenticatedRequestContext(req, mockContext);
    return req;
  }

  describe("POST /api/v1/tickets", () => {
    it("creates a ticket when authorized", async () => {
      const req = createMockRequest();

      const result = await controller.createTicket(
        {
          description: "Laptop screen flickering intermittently.",
          priority: TicketPriority.MEDIUM,
          title: "Screen Flickering Issue",
          type: TicketType.INCIDENT,
        },
        req,
      );

      expect(result.id).toBe("tkt-id-001");
      expect(result.publicRef).toBe("TKT-1001");
      expect(result.title).toBe("Screen Flickering Issue");
      expect(result.status).toBe(TicketStatus.NEW);
      expect(createTicketMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Laptop screen flickering intermittently.",
          requesterUserId: userA,
          tenantId: tenantA,
          title: "Screen Flickering Issue",
        }),
      );
    });

    it("throws 400 Bad Request when title or description is empty", async () => {
      const req = createMockRequest();

      await expect(
        controller.createTicket(
          {
            description: "Printer out of toner",
            title: "",
          },
          req,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws 403 Forbidden when ticket.create permission is denied", async () => {
      canMock.mockResolvedValue(false);
      const req = createMockRequest();

      await expect(
        controller.createTicket(
          {
            description: "Printer out of toner",
            title: "Printer Issue",
          },
          req,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws 401 Unauthorized when request context is missing", async () => {
      const req = {} as Request;

      await expect(
        controller.createTicket(
          {
            description: "Printer out of toner",
            title: "Printer Issue",
          },
          req,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("GET /api/v1/tickets", () => {
    it("returns listed tickets when authorized", async () => {
      const req = createMockRequest();
      const query = { page: 1, pageSize: 10, sortBy: "createdAt" };

      const result = await controller.getTickets(query, req);

      expect(listTicketsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: tenantA,
          page: 1,
          pageSize: 10,
        }),
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.id).toBe("tkt-id-001");
      expect(result.totalRecords).toBe(1);
    });

    it("throws 403 Forbidden when ticket.read permission is denied", async () => {
      canMock.mockResolvedValueOnce(false);
      const req = createMockRequest();
      await expect(controller.getTickets({}, req)).rejects.toThrow(ForbiddenException);
    });

    it("throws 400 Bad Request when query is invalid", async () => {
      const req = createMockRequest();
      await expect(controller.getTickets({ page: -1 }, req)).rejects.toThrow(BadRequestException);
    });
  });

  describe("GET /api/v1/tickets/count", () => {
    it("returns ticket count when authorized", async () => {
      const req = createMockRequest();
      const result = await controller.countTickets({ status: "NEW" }, req);

      expect(countTicketsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: tenantA,
        }),
      );
      expect(result.count).toBe(1);
    });

    it("throws 403 Forbidden when ticket.read permission is denied", async () => {
      canMock.mockResolvedValueOnce(false);
      const req = createMockRequest();
      await expect(controller.countTickets({}, req)).rejects.toThrow(ForbiddenException);
    });
  });

  describe("GET /api/v1/tickets/:id", () => {
    it("returns ticket when authorized", async () => {
      const req = createMockRequest();

      const result = await controller.getTicketById("tkt-id-001", req);

      expect(result.id).toBe("tkt-id-001");
      expect(result.publicRef).toBe("TKT-1001");
      expect(result.title).toBe("Screen Flickering Issue");
    });

    it("throws 404 Not Found when ticket does not exist", async () => {
      const req = createMockRequest();

      await expect(controller.getTicketById("non-existent-id", req)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws 403 Forbidden when ticket.read permission is denied", async () => {
      canMock.mockResolvedValue(false);
      const req = createMockRequest();

      await expect(controller.getTicketById("tkt-id-001", req)).rejects.toThrow(ForbiddenException);
    });
  });

  describe("GET /api/v1/tickets/reference/:publicRef", () => {
    it("returns ticket by publicRef when authorized", async () => {
      const req = createMockRequest();

      const result = await controller.getTicketByPublicRef("TKT-1001", req);

      expect(result.id).toBe("tkt-id-001");
      expect(result.publicRef).toBe("TKT-1001");
    });

    it("throws 404 Not Found when publicRef does not exist", async () => {
      const req = createMockRequest();

      await expect(controller.getTicketByPublicRef("TKT-9999", req)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("PATCH /api/v1/tickets/:id", () => {
    it("updates ticket editable fields when authorized and version matches", async () => {
      const req = createMockRequest();

      const result = await controller.updateTicketById(
        "tkt-id-001",
        {
          description: "Updated description details.",
          title: "Updated Title",
          version: 1,
        },
        req,
      );

      expect(result.id).toBe("tkt-id-001");
      expect(result.title).toBe("Updated Title");
      expect(result.description).toBe("Updated description details.");
      expect(updateTicketMock).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: userA,
          description: "Updated description details.",
          expectedVersion: 1,
          tenantId: tenantA,
          ticketId: "tkt-id-001",
          title: "Updated Title",
        }),
      );
    });

    it("throws 409 Conflict when expected version mismatches current version", async () => {
      const req = createMockRequest();

      await expect(
        controller.updateTicketById(
          "tkt-id-001",
          {
            title: "Updated Title",
            version: 99,
          },
          req,
        ),
      ).rejects.toThrow(TicketConcurrencyException);
    });

    it("throws 400 Bad Request when version is missing", async () => {
      const req = createMockRequest();

      await expect(
        controller.updateTicketById(
          "tkt-id-001",
          {
            title: "Updated Title",
          } as unknown as { version: number },
          req,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws 400 Bad Request when attempting to update immutable field id", async () => {
      const req = createMockRequest();

      await expect(
        controller.updateTicketById(
          "tkt-id-001",
          {
            id: "hacked-id",
            title: "Updated Title",
            version: 1,
          } as unknown as { version: number },
          req,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws 400 Bad Request when no editable fields are supplied", async () => {
      const req = createMockRequest();

      await expect(
        controller.updateTicketById(
          "tkt-id-001",
          {
            version: 1,
          },
          req,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws 403 Forbidden when ticket.update permission is denied", async () => {
      canMock.mockResolvedValue(false);
      const req = createMockRequest();

      await expect(
        controller.updateTicketById(
          "tkt-id-001",
          {
            title: "Updated Title",
            version: 1,
          },
          req,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws 401 Unauthorized when auth context is missing", async () => {
      const req = {} as Request;

      await expect(
        controller.updateTicketById(
          "tkt-id-001",
          {
            title: "Updated Title",
            version: 1,
          },
          req,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("PATCH /api/v1/tickets/reference/:publicRef", () => {
    it("updates ticket by public reference code when authorized", async () => {
      const req = createMockRequest();

      const result = await controller.updateTicketByPublicRef(
        "TKT-1001",
        {
          title: "Updated Title",
          version: 1,
        },
        req,
      );

      expect(result.id).toBe("tkt-id-001");
      expect(result.publicRef).toBe("TKT-1001");
    });

    it("throws 404 Not Found when publicRef does not exist", async () => {
      const req = createMockRequest();

      await expect(
        controller.updateTicketByPublicRef(
          "TKT-9999",
          {
            title: "Updated Title",
            version: 1,
          },
          req,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("Optimistic Concurrency Simulation", () => {
    it("simulates two concurrent updates where first succeeds and second gets 409 Conflict", async () => {
      const req1 = createMockRequest();
      const req2 = createMockRequest();

      let dbVersion = 1;

      updateTicketMock.mockImplementation((dto: { expectedVersion: number }) => {
        if (dto.expectedVersion !== dbVersion) {
          return Promise.reject(
            new TicketConcurrencyException(dto.expectedVersion, dbVersion, "tkt-id-001"),
          );
        }
        dbVersion += 1;
        return Promise.resolve(updatedSampleTicket);
      });

      // User 1 updates with version 1 (succeeds)
      const res1 = await controller.updateTicketById(
        "tkt-id-001",
        { title: "First update", version: 1 },
        req1,
      );
      expect(res1.id).toBe("tkt-id-001");
      expect(dbVersion).toBe(2);

      // User 2 tries to update with stale version 1 (fails with 409)
      await expect(
        controller.updateTicketById(
          "tkt-id-001",
          { title: "Stale second update", version: 1 },
          req2,
        ),
      ).rejects.toThrow(TicketConcurrencyException);
    });
  });

  // ── Issue #19: Ticket Lifecycle ──────────────────────────────────────────

  describe("POST /api/v1/tickets/:id/status", () => {
    it("transitions ticket status when authorized and version matches", async () => {
      const req = createMockRequest();

      const result = await controller.transitionTicketStatusById(
        "tkt-id-001",
        { status: TicketStatus.OPEN, version: 1 },
        req,
      );

      expect(result.id).toBe("tkt-id-001");
      expect(result.status).toBe(TicketStatus.OPEN);
      expect(transitionStatusMock).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: userA,
          expectedVersion: 1,
          newStatus: TicketStatus.OPEN,
          tenantId: tenantA,
          ticketId: "tkt-id-001",
        }),
      );
    });

    it("throws 400 Bad Request when version is missing", async () => {
      const req = createMockRequest();

      await expect(
        controller.transitionTicketStatusById(
          "tkt-id-001",
          { status: TicketStatus.OPEN } as unknown as { status: TicketStatus; version: number },
          req,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws 400 Bad Request when status is invalid", async () => {
      const req = createMockRequest();

      await expect(
        controller.transitionTicketStatusById(
          "tkt-id-001",
          { status: "UNKNOWN_STATUS" as TicketStatus, version: 1 },
          req,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws 401 Unauthorized when auth context is missing", async () => {
      const req = {} as Request;

      await expect(
        controller.transitionTicketStatusById(
          "tkt-id-001",
          { status: TicketStatus.OPEN, version: 1 },
          req,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("throws 403 Forbidden when ticket.transition permission is denied", async () => {
      canMock.mockResolvedValue(false);
      const req = createMockRequest();

      await expect(
        controller.transitionTicketStatusById(
          "tkt-id-001",
          { status: TicketStatus.OPEN, version: 1 },
          req,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws 409 Conflict when version mismatches", async () => {
      transitionStatusMock.mockRejectedValue(new TicketConcurrencyException(99, 2, "tkt-id-001"));
      const req = createMockRequest();

      await expect(
        controller.transitionTicketStatusById(
          "tkt-id-001",
          { status: TicketStatus.OPEN, version: 99 },
          req,
        ),
      ).rejects.toThrow(TicketConcurrencyException);
    });
  });

  describe("POST /api/v1/tickets/reference/:publicRef/status", () => {
    it("transitions ticket status by publicRef when authorized", async () => {
      const req = createMockRequest();

      const result = await controller.transitionTicketStatusByPublicRef(
        "TKT-1001",
        { status: TicketStatus.OPEN, version: 1 },
        req,
      );

      expect(result.id).toBe("tkt-id-001");
      expect(result.status).toBe(TicketStatus.OPEN);
    });

    it("throws 404 Not Found when publicRef does not exist", async () => {
      const req = createMockRequest();

      await expect(
        controller.transitionTicketStatusByPublicRef(
          "TKT-9999",
          { status: TicketStatus.OPEN, version: 1 },
          req,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Issue #20: Assignment endpoints ─────────────────────────────────

  describe("POST /api/v1/tickets/:id/assign", () => {
    const agentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    it("assigns ticket successfully by ID", async () => {
      const req = createMockRequest();

      const result = await controller.assignTicketById(
        "tkt-id-001",
        { assigneeUserId: agentId, version: 1 },
        req,
      );

      expect(result.id).toBe("tkt-id-001");
      expect(assignTicketMock).toHaveBeenCalledWith(
        expect.objectContaining({
          assigneeUserId: agentId,
          expectedVersion: 1,
          tenantId: tenantA,
          ticketId: "tkt-id-001",
        }),
      );
    });

    it("throws 400 when version is missing", async () => {
      const req = createMockRequest();

      await expect(
        controller.assignTicketById("tkt-id-001", { assigneeUserId: agentId } as never, req),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws 400 when assigneeUserId is missing", async () => {
      const req = createMockRequest();

      await expect(
        controller.assignTicketById("tkt-id-001", { version: 1 } as never, req),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws 400 when assignedGroupId is provided", async () => {
      const req = createMockRequest();

      await expect(
        controller.assignTicketById(
          "tkt-id-001",
          {
            assigneeUserId: agentId,
            assignedGroupId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            version: 1,
          },
          req,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws 401 when request context is missing", async () => {
      const req = {
        header: vi.fn(),
        headers: {},
        ip: "127.0.0.1",
      } as unknown as Request;

      await expect(
        controller.assignTicketById("tkt-id-001", { assigneeUserId: agentId, version: 1 }, req),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("throws 403 when ticket.assign permission is denied", async () => {
      canMock.mockResolvedValue(false);
      const req = createMockRequest();

      await expect(
        controller.assignTicketById("tkt-id-001", { assigneeUserId: agentId, version: 1 }, req),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws 404 when ticket is not found", async () => {
      assignTicketMock.mockRejectedValue(new NotFoundException("Ticket not found"));
      const req = createMockRequest();

      await expect(
        controller.assignTicketById("tkt-no-exist", { assigneeUserId: agentId, version: 1 }, req),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws 409 when version conflicts", async () => {
      assignTicketMock.mockRejectedValue(new TicketConcurrencyException(99, 2, "tkt-id-001"));
      const req = createMockRequest();

      await expect(
        controller.assignTicketById("tkt-id-001", { assigneeUserId: agentId, version: 99 }, req),
      ).rejects.toThrow(TicketConcurrencyException);
    });
  });

  describe("POST /api/v1/tickets/reference/:publicRef/assign", () => {
    const agentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    it("assigns ticket successfully by public reference", async () => {
      const req = createMockRequest();

      const result = await controller.assignTicketByPublicRef(
        "TKT-1001",
        { assigneeUserId: agentId, version: 1 },
        req,
      );

      expect(result.id).toBe("tkt-id-001");
      expect(getTicketByPublicRefMock).toHaveBeenCalledWith(tenantA, "TKT-1001");
      expect(assignTicketMock).toHaveBeenCalledWith(
        expect.objectContaining({ assigneeUserId: agentId, tenantId: tenantA }),
      );
    });

    it("throws 404 for unknown public reference", async () => {
      const req = createMockRequest();

      await expect(
        controller.assignTicketByPublicRef(
          "TKT-9999",
          { assigneeUserId: agentId, version: 1 },
          req,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws 403 when ticket.assign permission is denied", async () => {
      canMock.mockResolvedValue(false);
      const req = createMockRequest();

      await expect(
        controller.assignTicketByPublicRef(
          "TKT-1001",
          { assigneeUserId: agentId, version: 1 },
          req,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("POST /api/v1/tickets/:id/unassign", () => {
    it("unassigns ticket successfully by ID", async () => {
      const req = createMockRequest();

      const result = await controller.unassignTicketById("tkt-id-001", { version: 1 }, req);

      expect(result.id).toBe("tkt-id-001");
      expect(unassignTicketMock).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedVersion: 1,
          tenantId: tenantA,
          ticketId: "tkt-id-001",
        }),
      );
    });

    it("throws 400 when version is missing", async () => {
      const req = createMockRequest();

      await expect(controller.unassignTicketById("tkt-id-001", {} as never, req)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws 401 when request context is missing", async () => {
      const req = {
        header: vi.fn(),
        headers: {},
        ip: "127.0.0.1",
      } as unknown as Request;

      await expect(
        controller.unassignTicketById("tkt-id-001", { version: 1 }, req),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("throws 403 when ticket.assign permission is denied", async () => {
      canMock.mockResolvedValue(false);
      const req = createMockRequest();

      await expect(
        controller.unassignTicketById("tkt-id-001", { version: 1 }, req),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws 409 when version conflicts", async () => {
      unassignTicketMock.mockRejectedValue(new TicketConcurrencyException(99, 2, "tkt-id-001"));
      const req = createMockRequest();

      await expect(
        controller.unassignTicketById("tkt-id-001", { version: 99 }, req),
      ).rejects.toThrow(TicketConcurrencyException);
    });
  });
});
