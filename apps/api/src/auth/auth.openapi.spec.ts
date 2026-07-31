import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthController } from "./auth.controller";
import { AuthAccessTokenGuard } from "./guards/auth-access-token.guard";
import { AuthAccessTokenService } from "./guards/auth-access-token.service";
import { AuthPasswordService } from "./password/auth-password.service";
import { AuthPasswordResetService } from "./password-reset/auth-password-reset.service";
import { AuthRegistrationService } from "./registration/auth-registration.service";
import { AuthSessionService } from "./session/auth-session.service";
import { AuthTokenService } from "./tokens/auth-token.service";

describe("Authentication OpenAPI document", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthAccessTokenGuard,
        {
          provide: AuthAccessTokenService,
          useValue: {
            authenticateBearer: () => Promise.resolve({ status: "denied" }),
          },
        },
        {
          provide: AuthPasswordService,
          useValue: {
            changePassword: () => Promise.resolve({ status: "changed" }),
          },
        },
        {
          provide: AuthPasswordResetService,
          useValue: {
            confirmPasswordReset: () => Promise.resolve({ status: "accepted" }),
            requestPasswordReset: () => Promise.resolve({ status: "accepted" }),
          },
        },
        {
          provide: AuthRegistrationService,
          useValue: {
            confirmEmailVerification: () => Promise.resolve({ status: "accepted" }),
            register: () => Promise.resolve({ status: "accepted" }),
          },
        },
        {
          provide: AuthSessionService,
          useValue: {
            listSessions: () => Promise.resolve({ sessions: [], status: "ok" }),
            login: () => Promise.resolve({ status: "denied" }),
            logout: () => Promise.resolve({ status: "accepted" }),
          },
        },
        {
          provide: AuthTokenService,
          useValue: {
            refreshTokenPair: () => Promise.resolve({ status: "denied" }),
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

  it("publishes the implemented authentication endpoint inventory and bearer scheme", () => {
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
      "/api/v1/auth/email-verification/confirm",
      "/api/v1/auth/login",
      "/api/v1/auth/logout",
      "/api/v1/auth/me",
      "/api/v1/auth/password-reset/confirm",
      "/api/v1/auth/password-reset/request",
      "/api/v1/auth/password/change",
      "/api/v1/auth/refresh",
      "/api/v1/auth/register",
      "/api/v1/auth/sessions",
      "/api/v1/auth/sessions/{sessionId}",
    ]);
    expect(document.components?.securitySchemes?.["bearer"]).toMatchObject({
      bearerFormat: "JWT",
      scheme: "bearer",
      type: "http",
    });
    expect(document.paths["/api/v1/auth/me"]?.get?.security).toEqual([
      {
        bearer: [],
      },
    ]);
    expect(document.paths["/api/v1/auth/password/change"]?.post?.security).toEqual([
      {
        bearer: [],
      },
    ]);
  });
});
