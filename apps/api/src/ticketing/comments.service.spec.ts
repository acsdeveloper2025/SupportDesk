import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { CommentVisibility } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RbacService } from "../rbac/rbac.service";
import type { CommentsRepository } from "./comments.repository";
import { CommentsService } from "./comments.service";
import { CommentEntity } from "./domain/comment.entity";
import { TicketAggregate } from "./domain/ticket.aggregate";
import type { TicketsRepository } from "./tickets.repository";

describe("CommentsService", () => {
  let service: CommentsService;
  let commentsRepository: Record<string, ReturnType<typeof vi.fn>>;
  let ticketsRepository: Record<string, ReturnType<typeof vi.fn>>;
  let rbacService: Record<string, ReturnType<typeof vi.fn>>;

  const tenantA = "11111111-1111-1111-1111-111111111111";
  const userA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const ticketId = "t1111111-1111-1111-1111-111111111111";

  const sampleTicket = TicketAggregate.create({
    id: ticketId,
    tenantId: tenantA,
    publicRef: "TKT-1",
    title: "Test",
    description: "Test",
    requesterUserId: userA,
  });

  beforeEach(() => {
    commentsRepository = {
      create: vi.fn(),
      createWithAudit: vi.fn((entity, _audit) => Promise.resolve(entity)),
      findById: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateWithAudit: vi.fn((entity) => Promise.resolve(entity)),
      recordAuditEvent: vi.fn(),
    };

    ticketsRepository = {
      findById: vi.fn(),
    };

    rbacService = {
      can: vi.fn(),
    };

    const notificationsService = {
      createManySafe: vi.fn(() => Promise.resolve()),
      createSafe: vi.fn(() => Promise.resolve(null)),
    };

    service = new CommentsService(
      commentsRepository as unknown as CommentsRepository,
      ticketsRepository as unknown as TicketsRepository,
      rbacService as unknown as RbacService,
      notificationsService as never,
    );
  });

  describe("createComment", () => {
    it("throws NotFoundException if ticket does not exist", async () => {
      ticketsRepository.findById!.mockResolvedValue(null);

      await expect(
        service.createComment(tenantA, ticketId, { body: "Test" }, userA),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException if user lacks create permission", async () => {
      ticketsRepository.findById!.mockResolvedValue(sampleTicket);
      rbacService.can!.mockResolvedValue(false);

      await expect(
        service.createComment(tenantA, ticketId, { body: "Test" }, userA),
      ).rejects.toThrow(ForbiddenException);
    });

    it("creates a comment successfully", async () => {
      ticketsRepository.findById!.mockResolvedValue(sampleTicket);
      rbacService.can!.mockResolvedValue(true);

      const result = await service.createComment(tenantA, ticketId, { body: "Test" }, userA);

      expect(result.body).toBe("Test");
      expect(commentsRepository.createWithAudit).toHaveBeenCalled();
    });
  });

  describe("updateComment", () => {
    it("throws ForbiddenException if not the author", async () => {
      const comment = new CommentEntity({
        id: "c1",
        tenantId: tenantA,
        ticketId,
        authorUserId: "another-user",
        body: "Test",
        visibility: CommentVisibility.PUBLIC,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      commentsRepository.findById!.mockResolvedValue(comment);
      rbacService.can!.mockResolvedValue(true);

      await expect(
        service.updateComment(tenantA, "c1", { body: "Updated", expectedVersion: 1 }, userA),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
