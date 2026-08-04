import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthAccessTokenGuard } from "../auth/guards/auth-access-token.guard";
import { AuthAccessTokenService } from "../auth/guards/auth-access-token.service";
import { CommentsController } from "./comments.controller";
import { CommentsService } from "./comments.service";

describe("Comments OpenAPI Document", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [
        AuthAccessTokenGuard,
        {
          provide: AuthAccessTokenService,
          useValue: {
            authenticateBearer: () => Promise.resolve({ status: "denied" }),
          },
        },
        {
          provide: CommentsService,
          useValue: {
            createComment: () => Promise.resolve({}),
            getComment: () => Promise.resolve({}),
            listComments: () =>
              Promise.resolve({
                items: [],
                meta: { hasNextPage: false, page: 1, pageSize: 20, totalPages: 0, totalRecords: 0 },
              }),
            softDeleteComment: () => Promise.resolve(),
            updateComment: () => Promise.resolve({}),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("publishes implemented Comment endpoints", () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("SupportDesk API")
        .setDescription("SupportDesk API")
        .setVersion("1.0.0")
        .addBearerAuth({
          bearerFormat: "JWT",
          scheme: "bearer",
          type: "http",
        })
        .build(),
    );

    expect(Object.keys(document.paths).sort()).toEqual([
      "/api/v1/comments/{commentId}",
      "/api/v1/tickets/{ticketId}/comments",
    ]);

    expect(document.paths["/api/v1/tickets/{ticketId}/comments"]?.post?.summary).toBe(
      "Create a new comment on a ticket",
    );
    expect(document.paths["/api/v1/tickets/{ticketId}/comments"]?.get?.summary).toBe(
      "List comments for a ticket",
    );
    expect(document.paths["/api/v1/comments/{commentId}"]?.get?.summary).toBe(
      "Get a specific comment by ID",
    );
    expect(document.paths["/api/v1/comments/{commentId}"]?.patch?.summary).toBe(
      "Update an existing comment",
    );
    expect(document.paths["/api/v1/comments/{commentId}"]?.delete?.summary).toBe(
      "Soft delete a comment",
    );
  });
});
