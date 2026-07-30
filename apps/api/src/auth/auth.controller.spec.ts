import type { Server } from "node:http";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthController } from "./auth.controller";
import { AuthRegistrationService } from "./registration/auth-registration.service";

describe("AuthController registration API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthRegistrationService,
          useValue: {
            confirmEmailVerification: () => Promise.resolve({ status: "accepted" }),
            register: () => Promise.resolve({ status: "accepted" }),
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
});
