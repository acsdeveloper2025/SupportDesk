import { describe, expect, it } from "vitest";

import type { WorkflowDefinition } from "./workflow-definition";
import {
  buildPureValidationReport,
  finalizeReport,
  sortValidationIssues,
  WORKFLOW_LIMITS,
  WORKFLOW_VALIDATION_SCHEMA_VERSION,
  type WorkflowValidationIssue,
} from "./workflow-validation";

function baseDefinition(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    actions: [{ ordinal: 0, params: { body: "hello" }, type: "add_internal_comment" }],
    conditions: [],
    triggers: [{ type: "ticket.created" }],
    ...overrides,
  };
}

describe("workflow-validation", () => {
  it("returns schemaVersion 1 and valid for a simple definition", () => {
    const report = buildPureValidationReport(baseDefinition());
    expect(report.schemaVersion).toBe(WORKFLOW_VALIDATION_SCHEMA_VERSION);
    expect(report.valid).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it("sorts issues by path, severity, then code", () => {
    const unsorted: WorkflowValidationIssue[] = [
      { code: "B", message: "b", path: "a", severity: "warning" },
      { code: "A", message: "a", path: "a", severity: "error" },
      { code: "C", message: "c", path: "b", severity: "error" },
    ];
    expect(sortValidationIssues(unsorted).map((i) => `${i.path}:${i.severity}:${i.code}`)).toEqual([
      "a:error:A",
      "a:warning:B",
      "b:error:C",
    ]);
    expect(finalizeReport(unsorted).valid).toBe(false);
  });

  it("rejects group conditions and assign groupId", () => {
    const report = buildPureValidationReport(
      baseDefinition({
        actions: [
          {
            ordinal: 0,
            params: { groupId: "11111111-1111-4111-8111-111111111111" },
            type: "assign",
          },
        ],
        conditions: [{ field: "group", operator: "eq", ordinal: 0, value: "g1" }],
      }),
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.code === "WORKFLOW_GROUP_UNSUPPORTED")).toBe(true);
  });

  it("rejects illegal change_status target paired with unrestricted status_changed (cycle risk)", () => {
    const report = buildPureValidationReport(
      baseDefinition({
        actions: [{ ordinal: 0, params: { status: "open" }, type: "change_status" }],
        triggers: [{ type: "ticket.status_changed" }],
      }),
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.code === "WORKFLOW_CYCLE_RISK")).toBe(true);
  });

  it("rejects illegal trigger transition filter", () => {
    const report = buildPureValidationReport(
      baseDefinition({
        triggers: [{ fromStatus: "closed", toStatus: "open", type: "ticket.status_changed" }],
      }),
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.code === "WORKFLOW_ILLEGAL_TRANSITION")).toBe(true);
  });

  it("enforces max actions limit", () => {
    const actions = Array.from({ length: WORKFLOW_LIMITS.maxActions + 1 }, (_, ordinal) => ({
      ordinal,
      params: { body: `n${ordinal}` },
      type: "add_internal_comment" as const,
    }));
    const report = buildPureValidationReport(baseDefinition({ actions }));
    expect(report.valid).toBe(false);
    expect(
      report.errors.some((e) => e.code === "WORKFLOW_LIMIT_EXCEEDED" && e.path === "actions"),
    ).toBe(true);
  });

  it("rejects invalid assignee UUID shape", () => {
    const report = buildPureValidationReport(
      baseDefinition({
        actions: [{ ordinal: 0, params: { assigneeUserId: "not-a-uuid" }, type: "assign" }],
      }),
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.code === "WORKFLOW_INVALID_UUID")).toBe(true);
  });

  it("warnings alone keep valid true", () => {
    const report = finalizeReport([{ code: "W", message: "warn", path: "x", severity: "warning" }]);
    expect(report.valid).toBe(true);
    expect(report.warnings).toHaveLength(1);
    expect(report.errors).toHaveLength(0);
  });
});
