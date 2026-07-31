import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Workflow OpenAPI documentation coverage", () => {
  const apiDoc = readFileSync(join(process.cwd(), "../../docs/api/workflows.md"), "utf8");

  it("documents CRUD publish pause resume delete", () => {
    expect(apiDoc).toContain("`GET /api/v1/workflows`");
    expect(apiDoc).toContain("`POST /api/v1/workflows`");
    expect(apiDoc).toContain("`PATCH /api/v1/workflows/{workflow_id}`");
    expect(apiDoc).toContain("`POST /api/v1/workflows/{workflow_id}/publish`");
    expect(apiDoc).toContain("`POST /api/v1/workflows/{workflow_id}/pause`");
    expect(apiDoc).toContain("`POST /api/v1/workflows/{workflow_id}/resume`");
    expect(apiDoc).toContain("`DELETE /api/v1/workflows/{workflow_id}`");
  });

  it("marks execution as deferred", () => {
    expect(apiDoc).toContain("E11-I03");
    expect(apiDoc).toContain("Deferred");
  });
});
