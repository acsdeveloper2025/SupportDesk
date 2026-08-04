import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthAccessTokenGuard } from "../auth/guards/auth-access-token.guard";
import { AuthAccessTokenService } from "../auth/guards/auth-access-token.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

describe("Notifications OpenAPI Document", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        AuthAccessTokenGuard,
        {
          provide: AuthAccessTokenService,
          useValue: {
            authenticateBearer: () => Promise.resolve({ status: "denied" }),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            countUnread: () => Promise.resolve(0),
            getPreferences: () => Promise.resolve({ preferences: [], userId: "u" }),
            listForUser: () => Promise.resolve({ items: [] }),
            updateOwnNotification: () => Promise.resolve({}),
            updatePreferences: () => Promise.resolve({ preferences: [], userId: "u" }),
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

  it("publishes implemented notification endpoints and security schemas", () => {
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
      "/api/v1/notification-preferences",
      "/api/v1/notifications",
      "/api/v1/notifications/count",
      "/api/v1/notifications/{notificationId}",
    ]);

    expect(document.components?.securitySchemes).toHaveProperty("bearer");
  });
});
