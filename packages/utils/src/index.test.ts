import { describe, expect, it } from "vitest";

import { createCorrelationId, toIsoTimestamp } from "./index";

describe("utils", () => {
  it("creates correlation IDs", () => {
    expect(createCorrelationId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("formats ISO timestamps", () => {
    expect(toIsoTimestamp(new Date("2026-07-30T00:00:00.000Z"))).toBe("2026-07-30T00:00:00.000Z");
  });
});
