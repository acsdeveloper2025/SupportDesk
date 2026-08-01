import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("SLA OpenAPI documentation coverage", () => {
  const apiDoc = readFileSync(join(process.cwd(), "../../docs/api/sla.md"), "utf8");

  it("documents schedule, policy, status, timers, and metrics endpoints", () => {
    expect(apiDoc).toContain("`GET /api/v1/business-schedules`");
    expect(apiDoc).toContain("`POST /api/v1/business-schedules/{schedule_id}/publish`");
    expect(apiDoc).toContain("`GET /api/v1/sla-policies`");
    expect(apiDoc).toContain("`POST /api/v1/sla-policies/{policy_id}/publish`");
    expect(apiDoc).toContain("`GET /api/v1/tickets/{ticket_id}/sla`");
    expect(apiDoc).toContain("`GET /api/v1/sla/timers`");
    expect(apiDoc).toContain("`GET /api/v1/sla/metrics`");
  });

  it("marks deferred reporting and worker-driven delivery", () => {
    expect(apiDoc).toContain("`GET /api/v1/reports/sla`");
    expect(apiDoc).toContain("Deferred");
    expect(apiDoc).toContain("no background worker");
  });
});
