import type { Server } from "node:http";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { CorrelationIdMiddleware } from "./common/logging/correlation-id.middleware";

describe("bootstrap API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    const correlationIdMiddleware = new CorrelationIdMiddleware();
    app.use(correlationIdMiddleware.use.bind(correlationIdMiddleware));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the API root", async () => {
    const server = app.getHttpServer() as Server;
    const response = await request(server).get("/").expect(200);

    const body = response.body as Record<string, unknown>;

    expect(body).toEqual({
      message: "SupportDesk API",
      status: "ok",
    });
  });

  it("returns health status with a correlation ID", async () => {
    const server = app.getHttpServer() as Server;
    const response = await request(server).get("/health").expect(200);

    const body = response.body as Record<string, unknown>;

    expect(body).toMatchObject({
      check: "health",
      service: "supportdesk-api",
      status: "ok",
    });
    expect(typeof body.correlationId).toBe("string");
  });
});
