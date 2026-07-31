import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthAccessTokenGuard } from "../../auth/guards/auth-access-token.guard";
import { AuthAccessTokenService } from "../../auth/guards/auth-access-token.service";
import { AttachmentsController } from "./attachments.controller";
import { AttachmentsService } from "./attachments.service";

describe("Attachments OpenAPI Document", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AttachmentsController],
      providers: [
        AuthAccessTokenGuard,
        {
          provide: AuthAccessTokenService,
          useValue: {
            authenticateBearer: () => Promise.resolve({ status: "denied" }),
          },
        },
        {
          provide: AttachmentsService,
          useValue: {
            getDownload: () => Promise.resolve({}),
            list: () => Promise.resolve([]),
            softDelete: () => Promise.resolve(),
            upload: () => Promise.resolve({}),
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

  it("publishes attachment upload, list, download, and delete endpoints", () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("SupportDesk API")
        .setDescription("SupportDesk API")
        .setVersion("0.1.0")
        .addBearerAuth({
          bearerFormat: "JWT",
          scheme: "bearer",
          type: "http",
        })
        .build(),
    );

    expect(Object.keys(document.paths).sort()).toEqual([
      "/api/v1/attachments/{attachmentId}",
      "/api/v1/tickets/{ticketId}/attachments",
    ]);

    expect(document.paths["/api/v1/tickets/{ticketId}/attachments"]?.post?.summary).toBe(
      "Upload ticket attachment",
    );
    expect(document.paths["/api/v1/tickets/{ticketId}/attachments"]?.get?.summary).toBe(
      "List ticket attachments",
    );
    expect(document.paths["/api/v1/attachments/{attachmentId}"]?.get?.summary).toBe(
      "Download attachment",
    );
    expect(document.paths["/api/v1/attachments/{attachmentId}"]?.delete?.summary).toBe(
      "Delete attachment",
    );
    expect(document.components?.securitySchemes?.bearer).toBeDefined();
  });
});
