import { describe, expect, it } from "vitest";

import { diffWorkflowSnapshots } from "./workflow-diff";

describe("workflow-diff", () => {
  it("diffs immutable snapshots and includes metadata", () => {
    const generatedAt = new Date("2026-08-01T12:00:00.000Z");
    const diff = diffWorkflowSnapshots(
      1,
      2,
      {
        actions: [{ ordinal: 0, params: { body: "a" }, type: "add_internal_comment" }],
        conditions: [],
        triggers: [{ type: "ticket.created" }],
      },
      {
        actions: [
          { ordinal: 0, params: { body: "b" }, type: "add_internal_comment" },
          { ordinal: 1, params: { status: "open" }, type: "change_status" },
        ],
        conditions: [{ field: "priority", operator: "eq", ordinal: 0, value: "high" }],
        triggers: [{ type: "ticket.created" }],
      },
      generatedAt,
    );

    expect(diff.fromVersion).toBe(1);
    expect(diff.toVersion).toBe(2);
    expect(diff.generatedAt).toBe("2026-08-01T12:00:00.000Z");
    expect(diff.changeCount).toBe(diff.changes.length);
    expect(diff.changeCount).toBeGreaterThan(0);
    expect(diff.changes.map((c) => c.path)).toEqual([...diff.changes.map((c) => c.path)].sort());
  });
});
