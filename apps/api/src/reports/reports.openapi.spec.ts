import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { ReportsModule } from "./reports.module";

describe("Reports OpenAPI Spec", () => {
  it("generates a valid OpenAPI document containing report paths and security", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ReportsModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    const config = new DocumentBuilder()
      .setTitle("SupportDesk API")
      .setVersion("1.0.0")
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);

    expect(document.paths["/api/v1/reports/executive"]).toBeDefined();
    expect(document.paths["/api/v1/reports/tickets"]).toBeDefined();
    expect(document.paths["/api/v1/reports/sla"]).toBeDefined();
    expect(document.paths["/api/v1/reports/workflows"]).toBeDefined();
    expect(document.paths["/api/v1/reports/assets"]).toBeDefined();
    expect(document.paths["/api/v1/reports/catalog"]).toBeDefined();
    expect(document.paths["/api/v1/reports/kb"]).toBeDefined();
    expect(document.paths["/api/v1/reports/agents"]).toBeDefined();
    expect(document.paths["/api/v1/reports/export"]).toBeDefined();
    expect(document.paths["/api/v1/reports/exports"]).toBeDefined();
    expect(document.paths["/api/v1/reports/exports/{id}/download"]).toBeDefined();
    expect(document.paths["/api/v1/reports/saved"]).toBeDefined();
    expect(document.paths["/api/v1/reports/saved/{id}"]).toBeDefined();
    expect(document.paths["/api/v1/reports/scheduled"]).toBeDefined();
    expect(document.paths["/api/v1/reports/scheduled/{id}"]).toBeDefined();

    await app.close();
  });
});
