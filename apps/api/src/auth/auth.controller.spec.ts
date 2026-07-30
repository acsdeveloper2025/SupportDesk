import type { Server } from "node:http";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthController } from "./auth.controller";
import { AuthPasswordService } from "./password/auth-password.service";
import { AuthPasswordResetService } from "./password-reset/auth-password-reset.service";
import { AuthRegistrationService } from "./registration/auth-registration.service";
import { AuthSessionService } from "./session/auth-session.service";
import { AuthTokenService } from "./tokens/auth-token.service";

describe("AuthController registration API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthPasswordService,
          useValue: {
            changePassword: (input: { currentPassword?: string }) =>
              Promise.resolve(
                input.currentPassword === "CorrectHorse9!Battery"
                  ? { status: "changed" }
                  : { status: "denied" },
              ),
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
          provide: AuthPasswordResetService,
          useValue: {
            confirmPasswordReset: () => Promise.resolve({ status: "accepted" }),
            requestPasswordReset: () => Promise.resolve({ status: "accepted" }),
          },
        },
        {
          provide: AuthSessionService,
          useValue: {
            listSessions: () =>
              Promise.resolve({
                sessions: [
                  {
                    deviceName: "Browser",
                    expiresAt: new Date("2026-07-31T00:00:00.000Z"),
                    id: "33333333-3333-4333-8333-333333333333",
                    lastSeenAt: null,
                    rememberMe: false,
                    state: "ACTIVE",
                  },
                ],
                status: "ok",
              }),
            login: (input: { email?: string }) =>
              Promise.resolve({
                session: {
                  deviceName: "Browser",
                  expiresAt: new Date("2026-07-31T00:00:00.000Z"),
                  id: "33333333-3333-4333-8333-333333333333",
                  lastSeenAt: null,
                  rememberMe: false,
                  state: "ACTIVE",
                },
                status:
                  input.email === "expired@acme.test"
                    ? "password_change_required"
                    : "authenticated",
                tokens: {
                  accessToken: "access-token",
                  accessTokenExpiresAt: new Date("2026-07-30T00:15:00.000Z"),
                  refreshToken: "refresh-token",
                  refreshTokenExpiresAt: new Date("2026-07-31T00:00:00.000Z"),
                },
              }),
            logout: () => Promise.resolve({ status: "accepted" }),
          },
        },
        {
          provide: AuthTokenService,
          useValue: {
            refreshTokenPair: () =>
              Promise.resolve({
                accessToken: "next-access-token",
                accessTokenExpiresAt: new Date("2026-07-30T00:15:00.000Z"),
                refreshToken: "next-refresh-token",
                refreshTokenExpiresAt: new Date("2026-07-31T00:00:00.000Z"),
                status: "refreshed",
              }),
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

  it("accepts registration requests without exposing account existence", async () => {
    const server = app.getHttpServer() as Server;
    const response = await request(server)
      .post("/api/v1/auth/register")
      .send({
        email: "agent@acme.test",
        password: "CorrectHorse9!Battery",
        tenant: {
          slug: "acme",
        },
      })
      .expect(202);

    expect(response.body).toEqual({
      status: "accepted",
    });
  });

  it("accepts email verification confirmations without exposing token validity", async () => {
    const server = app.getHttpServer() as Server;
    const response = await request(server)
      .post("/api/v1/auth/email-verification/confirm")
      .send({
        token: "opaque-token",
      })
      .expect(202);

    expect(response.body).toEqual({
      status: "accepted",
    });
  });

  it("creates a session for valid login requests", async () => {
    const server = app.getHttpServer() as Server;
    const response = await request(server)
      .post("/api/v1/auth/login")
      .send({
        email: "agent@acme.test",
        password: "CorrectHorse9!Battery",
        tenantId: "11111111-1111-4111-8111-111111111111",
      })
      .expect(200);

    expect(response.body).toEqual({
      session: {
        deviceName: "Browser",
        expiresAt: "2026-07-31T00:00:00.000Z",
        id: "33333333-3333-4333-8333-333333333333",
        lastSeenAt: null,
        rememberMe: false,
        state: "ACTIVE",
      },
      status: "authenticated",
      tokens: {
        accessToken: "access-token",
        accessTokenExpiresAt: "2026-07-30T00:15:00.000Z",
        refreshToken: "refresh-token",
        refreshTokenExpiresAt: "2026-07-31T00:00:00.000Z",
      },
    });
  });

  it("rotates refresh tokens", async () => {
    const server = app.getHttpServer() as Server;
    const response = await request(server)
      .post("/api/v1/auth/refresh")
      .send({
        refreshToken: "refresh-token",
      })
      .expect(200);

    expect(response.body).toMatchObject({
      accessToken: "next-access-token",
      refreshToken: "next-refresh-token",
      status: "refreshed",
    });
  });

  it("returns an explicit password-change-required login response", async () => {
    const server = app.getHttpServer() as Server;
    const response = await request(server)
      .post("/api/v1/auth/login")
      .send({
        email: "expired@acme.test",
        password: "CorrectHorse9!Battery",
        tenantId: "11111111-1111-4111-8111-111111111111",
      })
      .expect(200);

    expect(response.body).toMatchObject({
      status: "password_change_required",
    });
  });

  it("changes an authenticated password and rejects a wrong current password", async () => {
    const server = app.getHttpServer() as Server;

    await request(server)
      .post("/api/v1/auth/password/change")
      .set("x-session-id", "33333333-3333-4333-8333-333333333333")
      .send({
        currentPassword: "CorrectHorse9!Battery",
        newPassword: "NewCorrectHorse9!Battery",
      })
      .expect(200)
      .expect({
        status: "changed",
      });

    await request(server)
      .post("/api/v1/auth/password/change")
      .set("x-session-id", "33333333-3333-4333-8333-333333333333")
      .send({
        currentPassword: "WrongHorse9!Battery",
        newPassword: "NewCorrectHorse9!Battery",
      })
      .expect(401);
  });

  it("accepts password reset request and confirmation without exposing identity or token validity", async () => {
    const server = app.getHttpServer() as Server;

    await request(server)
      .post("/api/v1/auth/password-reset/request")
      .send({
        email: "agent@acme.test",
        tenant: {
          slug: "acme",
        },
      })
      .expect(202)
      .expect({
        status: "accepted",
      });

    await request(server)
      .post("/api/v1/auth/password-reset/confirm")
      .send({
        password: "NewCorrectHorse9!Battery",
        token: "password-reset-token",
      })
      .expect(202)
      .expect({
        status: "accepted",
      });
  });

  it("accepts logout and session management requests for the current session", async () => {
    const server = app.getHttpServer() as Server;

    await request(server)
      .post("/api/v1/auth/logout")
      .set("x-session-id", "33333333-3333-4333-8333-333333333333")
      .send({})
      .expect(202);

    const sessions = await request(server)
      .get("/api/v1/auth/sessions")
      .set("x-session-id", "33333333-3333-4333-8333-333333333333")
      .expect(200);
    const sessionsBody = sessions.body as Record<string, unknown>;

    expect(sessionsBody["status"]).toBe("ok");

    await request(server)
      .delete("/api/v1/auth/sessions/33333333-3333-4333-8333-333333333333")
      .set("x-session-id", "33333333-3333-4333-8333-333333333333")
      .expect(202);
  });
});
