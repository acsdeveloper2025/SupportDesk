import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { KbModule } from "./kb.module";

describe("Knowledge Base OpenAPI Spec", () => {
  it("generates a valid OpenAPI document containing KB paths and security", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [KbModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    const config = new DocumentBuilder()
      .setTitle("SupportDesk API")
      .setVersion("1.0.0")
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);

    expect(document.paths["/api/v1/kb/categories"]).toBeDefined();
    expect(document.paths["/api/v1/kb/categories/{idOrSlug}"]).toBeDefined();
    expect(document.paths["/api/v1/kb/articles"]).toBeDefined();
    expect(document.paths["/api/v1/kb/articles/search"]).toBeDefined();
    expect(document.paths["/api/v1/kb/articles/{idOrSlug}"]).toBeDefined();
    expect(document.paths["/api/v1/kb/articles/{id}/publish"]).toBeDefined();
    expect(document.paths["/api/v1/kb/articles/{id}/versions"]).toBeDefined();
    expect(document.paths["/api/v1/kb/articles/{id}/links/tickets"]).toBeDefined();

    await app.close();
  });
});
