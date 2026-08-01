import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { AssetsModule } from "./assets.module";

describe("Assets OpenAPI Spec", () => {
  it("generates a valid OpenAPI document containing asset paths and security", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AssetsModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    const config = new DocumentBuilder()
      .setTitle("SupportDesk API")
      .setVersion("1.0.0")
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);

    expect(document.paths["/api/v1/assets"]).toBeDefined();
    expect(document.paths["/api/v1/assets/types"]).toBeDefined();
    expect(document.paths["/api/v1/assets/categories"]).toBeDefined();
    expect(document.paths["/api/v1/assets/locations"]).toBeDefined();
    expect(document.paths["/api/v1/assets/{id}"]).toBeDefined();
    expect(document.paths["/api/v1/assets/{id}/transition"]).toBeDefined();
    expect(document.paths["/api/v1/assets/{id}/history"]).toBeDefined();
    expect(document.paths["/api/v1/assets/{id}/assignments"]).toBeDefined();
    expect(document.paths["/api/v1/assets/{id}/relationships"]).toBeDefined();
    expect(document.paths["/api/v1/assets/{id}/tickets"]).toBeDefined();
    expect(document.paths["/api/v1/assets/{assetId}/attachments"]).toBeDefined();
    expect(document.paths["/api/v1/assets/types/{id}/kb"]).toBeDefined();

    await app.close();
  });
});
