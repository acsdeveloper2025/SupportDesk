import { CommentVisibility } from "@prisma/client";
import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthenticatedRequestContext } from "../auth/guards/auth-context";
import { setAuthenticatedRequestContext } from "../auth/guards/auth-context";
import { CommentsController } from "./comments.controller";
import type { CommentsService } from "./comments.service";
import { CommentEntity } from "./domain/comment.entity";

describe("CommentsController", () => {
  let controller: CommentsController;
  let service: CommentsService;

  let createCommentMock: ReturnType<typeof vi.fn>;
  let getCommentMock: ReturnType<typeof vi.fn>;
  let listCommentsMock: ReturnType<typeof vi.fn>;
  let updateCommentMock: ReturnType<typeof vi.fn>;
  let softDeleteCommentMock: ReturnType<typeof vi.fn>;

  const tenantA = "11111111-1111-1111-1111-111111111111";
  const userA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const ticketId = "t1111111-1111-1111-1111-111111111111";

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

  const sampleComment = new CommentEntity({
    id: "c1111111-1111-1111-1111-111111111111",
    tenantId: tenantA,
    ticketId,
    authorUserId: userA,
    body: "Test comment",
    visibility: CommentVisibility.PUBLIC,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    createCommentMock = vi.fn();
    getCommentMock = vi.fn();
    listCommentsMock = vi.fn();
    updateCommentMock = vi.fn();
    softDeleteCommentMock = vi.fn();

    service = {
      createComment: createCommentMock,
      getComment: getCommentMock,
      listComments: listCommentsMock,
      updateComment: updateCommentMock,
      softDeleteComment: softDeleteCommentMock,
    } as unknown as CommentsService;

    controller = new CommentsController(service);
  });

  const getMockRequest = (): Request => {
    const req = {} as Request;
    setAuthenticatedRequestContext(req, mockContext);
    return req;
  };

  describe("createComment", () => {
    it("creates a comment and returns a CommentResponseDto", async () => {
      createCommentMock.mockResolvedValue(sampleComment);
      const req = getMockRequest();

      const result = await controller.createComment(req, ticketId, { body: "Test comment" });

      expect(createCommentMock).toHaveBeenCalledWith(
        tenantA,
        ticketId,
        { body: "Test comment" },
        userA,
      );
      expect(result.id).toBe(sampleComment.id);
      expect(result.body).toBe("Test comment");
    });
  });

  describe("getComment", () => {
    it("returns a comment by ID", async () => {
      getCommentMock.mockResolvedValue(sampleComment);
      const req = getMockRequest();

      const result = await controller.getComment(req, sampleComment.id);

      expect(getCommentMock).toHaveBeenCalledWith(tenantA, sampleComment.id, userA);
      expect(result.id).toBe(sampleComment.id);
    });
  });

  describe("listComments", () => {
    it("returns a paginated list of comments", async () => {
      listCommentsMock.mockResolvedValue({
        items: [sampleComment],
        meta: {
          totalRecords: 1,
          totalPages: 1,
          currentPage: 1,
          pageSize: 20,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
      const req = getMockRequest();

      const result = await controller.listComments(req, ticketId, { page: 1, pageSize: 20 });

      expect(listCommentsMock).toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
      expect(result.meta.totalRecords).toBe(1);
    });
  });

  describe("updateComment", () => {
    it("updates a comment", async () => {
      updateCommentMock.mockResolvedValue(sampleComment);
      const req = getMockRequest();

      const result = await controller.updateComment(req, sampleComment.id, {
        body: "Updated",
        expectedVersion: 1,
      });

      expect(updateCommentMock).toHaveBeenCalledWith(
        tenantA,
        sampleComment.id,
        { body: "Updated", expectedVersion: 1 },
        userA,
      );
      expect(result.id).toBe(sampleComment.id);
    });
  });

  describe("deleteComment", () => {
    it("soft deletes a comment", async () => {
      softDeleteCommentMock.mockResolvedValue(undefined);
      const req = getMockRequest();

      await controller.deleteComment(req, sampleComment.id, 1, "Testing");

      expect(softDeleteCommentMock).toHaveBeenCalledWith(
        tenantA,
        sampleComment.id,
        1,
        "Testing",
        userA,
      );
    });
  });
});
