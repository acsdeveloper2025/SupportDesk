import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthAccessTokenGuard } from "../auth/guards/auth-access-token.guard";
import { AuthAccessTokenService } from "../auth/guards/auth-access-token.service";
import { RbacService } from "../rbac/rbac.service";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";

describe("Tickets OpenAPI Document", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        AuthAccessTokenGuard,
        {
          provide: AuthAccessTokenService,
          useValue: {
            authenticateBearer: () => Promise.resolve({ status: "denied" }),
          },
        },
        {
          provide: TicketsService,
          useValue: {
            assignTicket: () => Promise.resolve({}),
            createTicket: () => Promise.resolve({}),
            getTicketById: () => Promise.resolve({}),
            getTicketByPublicRef: () => Promise.resolve({}),
            getTicketTimeline: () => Promise.resolve({ items: [], totalRecords: 0 }),
            transitionStatus: () => Promise.resolve({}),
            unassignTicket: () => Promise.resolve({}),
            updateTicket: () => Promise.resolve({}),
          },
        },
        {
          provide: RbacService,
          useValue: {
            can: () => Promise.resolve(true),
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

  it("publishes implemented Ticket endpoints and security schemas", () => {
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
      "/api/v1/tickets",
      "/api/v1/tickets/count",
      "/api/v1/tickets/reference/{publicRef}",
      "/api/v1/tickets/reference/{publicRef}/assign",
      "/api/v1/tickets/reference/{publicRef}/status",
      "/api/v1/tickets/{id}",
      "/api/v1/tickets/{id}/assign",
      "/api/v1/tickets/{id}/status",
      "/api/v1/tickets/{id}/timeline",
      "/api/v1/tickets/{id}/unassign",
    ]);

    expect(document.paths["/api/v1/tickets"]?.post?.summary).toBe("Create a ticket");
    expect(document.paths["/api/v1/tickets/{id}"]?.get?.summary).toBe("Get ticket by ID");
    expect(document.paths["/api/v1/tickets/{id}"]?.patch?.summary).toBe("Update ticket by ID");
    expect(document.paths["/api/v1/tickets/{id}/status"]?.post?.summary).toBe(
      "Transition ticket status by ID",
    );
    expect(document.paths["/api/v1/tickets/reference/{publicRef}"]?.get?.summary).toBe(
      "Get ticket by public reference",
    );
    expect(document.paths["/api/v1/tickets/reference/{publicRef}"]?.patch?.summary).toBe(
      "Update ticket by public reference",
    );
    expect(document.paths["/api/v1/tickets/reference/{publicRef}/status"]?.post?.summary).toBe(
      "Transition ticket status by public reference",
    );
    expect(document.paths["/api/v1/tickets/{id}/assign"]?.post?.summary).toBe(
      "Assign ticket by ID",
    );
    expect(document.paths["/api/v1/tickets/reference/{publicRef}/assign"]?.post?.summary).toBe(
      "Assign ticket by public reference",
    );
    expect(document.paths["/api/v1/tickets/{id}/unassign"]?.post?.summary).toBe(
      "Unassign ticket by ID",
    );
  });
});
