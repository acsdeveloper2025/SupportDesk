import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { CatalogModule } from "./catalog.module";

describe("Service Catalog OpenAPI Spec", () => {
  it("generates a valid OpenAPI document containing catalog paths and security", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CatalogModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    const config = new DocumentBuilder()
      .setTitle("SupportDesk API")
      .setVersion("1.0.0")
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);

    expect(document.paths["/api/v1/catalog/categories"]).toBeDefined();
    expect(document.paths["/api/v1/catalog/categories/{idOrSlug}"]).toBeDefined();
    expect(document.paths["/api/v1/catalog/services"]).toBeDefined();
    expect(document.paths["/api/v1/catalog/services/published"]).toBeDefined();
    expect(document.paths["/api/v1/catalog/services/{idOrSlug}"]).toBeDefined();
    expect(document.paths["/api/v1/catalog/services/{id}/publish"]).toBeDefined();
    expect(document.paths["/api/v1/catalog/services/{id}/retire"]).toBeDefined();
    expect(document.paths["/api/v1/catalog/services/{id}/form"]).toBeDefined();
    expect(document.paths["/api/v1/catalog/services/{id}/suggestions"]).toBeDefined();
    expect(document.paths["/api/v1/catalog/requests"]).toBeDefined();
    expect(document.paths["/api/v1/catalog/requests/{id}"]).toBeDefined();
    expect(document.paths["/api/v1/catalog/requests/{id}/history"]).toBeDefined();
    expect(document.paths["/api/v1/catalog/requests/{id}/approvals"]).toBeDefined();
    expect(document.paths["/api/v1/catalog/requests/{id}/answers"]).toBeDefined();
    expect(document.paths["/api/v1/catalog/requests/{id}/cancel"]).toBeDefined();
    expect(
      document.paths["/api/v1/catalog/requests/{id}/approvals/{approvalId}/decide"],
    ).toBeDefined();
    expect(document.paths["/api/v1/catalog/requests/{id}/fulfillment"]).toBeDefined();
    expect(document.paths["/api/v1/catalog/requests/{id}/ticket"]).toBeDefined();
    expect(document.paths["/api/v1/catalog/requests/{id}/complete"]).toBeDefined();
    expect(document.paths["/api/v1/catalog/requests/{id}/attachments"]).toBeDefined();
    expect(
      document.paths["/api/v1/catalog/requests/{id}/attachments/{attachmentId}"],
    ).toBeDefined();

    await app.close();
  });
});
