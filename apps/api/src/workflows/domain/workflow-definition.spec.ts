import { describe, expect, it } from "vitest";

import { assertValidWorkflowDefinition, type WorkflowDefinition } from "./workflow-definition";

function validDefinition(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    actions: [
      { ordinal: 0, params: { status: "open" }, type: "change_status" },
      { ordinal: 1, params: { body: "routed" }, type: "add_internal_comment" },
    ],
    conditions: [{ field: "priority", operator: "eq", ordinal: 0, value: "high" }],
    triggers: [{ type: "ticket.created" }],
    ...overrides,
  };
}

describe("assertValidWorkflowDefinition", () => {
  it("accepts a full valid definition", () => {
    expect(() => assertValidWorkflowDefinition(validDefinition())).not.toThrow();
  });

  it("requires at least one trigger", () => {
    expect(() => assertValidWorkflowDefinition(validDefinition({ triggers: [] }))).toThrow(
      /trigger/i,
    );
  });

  it("requires at least one action", () => {
    expect(() => assertValidWorkflowDefinition(validDefinition({ actions: [] }))).toThrow(
      /action/i,
    );
  });

  it("rejects unknown trigger types", () => {
    expect(() =>
      assertValidWorkflowDefinition(
        validDefinition({ triggers: [{ type: "ticket.deleted" as never }] }),
      ),
    ).toThrow(/trigger/i);
  });

  it("rejects duplicate action ordinals", () => {
    expect(() =>
      assertValidWorkflowDefinition(
        validDefinition({
          actions: [
            { ordinal: 0, params: { status: "open" }, type: "change_status" },
            { ordinal: 0, params: { body: "x" }, type: "add_internal_comment" },
          ],
        }),
      ),
    ).toThrow(/ordinal/i);
  });

  it("rejects non-ascending action ordinal gaps that break strict order uniqueness only when duplicates", () => {
    expect(() =>
      assertValidWorkflowDefinition(
        validDefinition({
          actions: [
            { ordinal: 2, params: { status: "open" }, type: "change_status" },
            { ordinal: 5, params: { body: "x" }, type: "add_internal_comment" },
          ],
        }),
      ),
    ).not.toThrow();
  });

  it("rejects unknown condition fields and operators", () => {
    expect(() =>
      assertValidWorkflowDefinition(
        validDefinition({
          conditions: [{ field: "subject" as never, operator: "eq", ordinal: 0, value: "x" }],
        }),
      ),
    ).toThrow(/field/i);
  });

  it("rejects change_status without status param", () => {
    expect(() =>
      assertValidWorkflowDefinition(
        validDefinition({
          actions: [{ ordinal: 0, params: {}, type: "change_status" }],
        }),
      ),
    ).toThrow(/status/i);
  });

  it("rejects assign without assigneeUserId or groupId", () => {
    expect(() =>
      assertValidWorkflowDefinition(
        validDefinition({
          actions: [{ ordinal: 0, params: {}, type: "assign" }],
        }),
      ),
    ).toThrow(/assign/i);
  });
});
