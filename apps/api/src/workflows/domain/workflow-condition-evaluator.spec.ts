import { describe, expect, it } from "vitest";

import type { WorkflowCondition } from "./workflow-condition-evaluator";
import { evaluateCondition, evaluateWorkflowConditions } from "./workflow-condition-evaluator";

describe("evaluateCondition", () => {
  const snapshot = {
    ticket: {
      status: "open",
      priority: "high",
      tags: ["vip", "billing"],
      ageHours: 24,
      assignedUser: null,
    },
    event: "ticket.created",
  };

  it("evaluates equals and not_equals", () => {
    expect(
      evaluateCondition({ field: "ticket.status", operator: "equals", value: "open" }, snapshot)
        .passed,
    ).toBe(true);
    expect(
      evaluateCondition({ field: "ticket.status", operator: "equals", value: "closed" }, snapshot)
        .passed,
    ).toBe(false);
    expect(
      evaluateCondition(
        { field: "ticket.status", operator: "not_equals", value: "closed" },
        snapshot,
      ).passed,
    ).toBe(true);
  });

  it("evaluates contains and not_contains for string and arrays", () => {
    expect(
      evaluateCondition({ field: "ticket.priority", operator: "contains", value: "ig" }, snapshot)
        .passed,
    ).toBe(true);
    expect(
      evaluateCondition({ field: "ticket.tags", operator: "contains", value: "vip" }, snapshot)
        .passed,
    ).toBe(true);
    expect(
      evaluateCondition({ field: "ticket.tags", operator: "contains", value: "urgent" }, snapshot)
        .passed,
    ).toBe(false);
    expect(
      evaluateCondition(
        { field: "ticket.tags", operator: "not_contains", value: "urgent" },
        snapshot,
      ).passed,
    ).toBe(true);
  });

  it("evaluates in and not_in", () => {
    expect(
      evaluateCondition(
        { field: "ticket.priority", operator: "in", value: ["high", "urgent"] },
        snapshot,
      ).passed,
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "ticket.priority", operator: "in", value: ["low", "medium"] },
        snapshot,
      ).passed,
    ).toBe(false);
    expect(
      evaluateCondition(
        { field: "ticket.priority", operator: "not_in", value: ["low", "medium"] },
        snapshot,
      ).passed,
    ).toBe(true);
  });

  it("evaluates greater_than and less_than", () => {
    expect(
      evaluateCondition({ field: "ticket.ageHours", operator: "greater_than", value: 10 }, snapshot)
        .passed,
    ).toBe(true);
    expect(
      evaluateCondition({ field: "ticket.ageHours", operator: "less_than", value: 50 }, snapshot)
        .passed,
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "ticket.ageHours", operator: "greater_than", value: 100 },
        snapshot,
      ).passed,
    ).toBe(false);
  });

  it("evaluates set and not_set", () => {
    expect(evaluateCondition({ field: "ticket.priority", operator: "set" }, snapshot).passed).toBe(
      true,
    );
    expect(
      evaluateCondition({ field: "ticket.assignedUser", operator: "set" }, snapshot).passed,
    ).toBe(false);
    expect(
      evaluateCondition({ field: "ticket.assignedUser", operator: "not_set" }, snapshot).passed,
    ).toBe(true);
    expect(
      evaluateCondition({ field: "ticket.missingField", operator: "not_set" }, snapshot).passed,
    ).toBe(true);
  });
});

describe("evaluateWorkflowConditions", () => {
  const snapshot = {
    ticket: {
      status: "new",
      priority: "urgent",
    },
  };

  it("returns true for empty conditions", () => {
    const res = evaluateWorkflowConditions([], snapshot);
    expect(res.passed).toBe(true);
    expect(res.details).toHaveLength(0);
  });

  it("requires ALL conditions to pass (AND evaluation)", () => {
    const conditions: WorkflowCondition[] = [
      { field: "ticket.status", operator: "equals", value: "new" },
      { field: "ticket.priority", operator: "equals", value: "urgent" },
    ];
    expect(evaluateWorkflowConditions(conditions, snapshot).passed).toBe(true);

    const failingConditions: WorkflowCondition[] = [
      { field: "ticket.status", operator: "equals", value: "new" },
      { field: "ticket.priority", operator: "equals", value: "low" },
    ];
    expect(evaluateWorkflowConditions(failingConditions, snapshot).passed).toBe(false);
  });
});
