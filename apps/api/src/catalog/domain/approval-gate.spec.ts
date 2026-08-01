import { describe, expect, it } from "vitest";

import {
  evaluateApprovalGate,
  isApprovalGateSatisfied,
  stepDecisionOutcome,
} from "./approval-gate";

describe("evaluateApprovalGate", () => {
  it("always passes with NONE mode", () => {
    expect(evaluateApprovalGate("NONE", [])).toBe("PASSED");
    expect(evaluateApprovalGate("NONE", ["PENDING"])).toBe("PASSED");
  });

  it("SINGLE mode: passes when the single step approves", () => {
    expect(evaluateApprovalGate("SINGLE", ["PENDING"])).toBe("PENDING");
    expect(evaluateApprovalGate("SINGLE", ["APPROVED"])).toBe("PASSED");
    expect(evaluateApprovalGate("SINGLE", ["REJECTED"])).toBe("REJECTED");
    expect(evaluateApprovalGate("SINGLE", ["CHANGES_REQUESTED"])).toBe("CHANGES_REQUESTED");
  });

  it("ANY mode: the first decision decides", () => {
    expect(evaluateApprovalGate("ANY", ["PENDING", "PENDING"])).toBe("PENDING");
    expect(evaluateApprovalGate("ANY", ["PENDING", "APPROVED"])).toBe("PASSED");
    expect(evaluateApprovalGate("ANY", ["REJECTED", "PENDING"])).toBe("REJECTED");
  });

  it("ALL mode: every step must approve, in order", () => {
    expect(evaluateApprovalGate("ALL", ["PENDING"])).toBe("PENDING");
    expect(evaluateApprovalGate("ALL", ["APPROVED", "PENDING"])).toBe("PENDING");
    expect(evaluateApprovalGate("ALL", ["APPROVED", "APPROVED"])).toBe("PASSED");
    expect(evaluateApprovalGate("ALL", ["REJECTED", "PENDING"])).toBe("REJECTED");
    expect(evaluateApprovalGate("ALL", ["APPROVED", "CHANGES_REQUESTED"])).toBe(
      "CHANGES_REQUESTED",
    );
  });
});

describe("isApprovalGateSatisfied", () => {
  it("is true only when the gate evaluates to PASSED", () => {
    expect(isApprovalGateSatisfied("NONE", [])).toBe(true);
    expect(isApprovalGateSatisfied("ALL", ["APPROVED", "APPROVED"])).toBe(true);
    expect(isApprovalGateSatisfied("ALL", ["APPROVED", "PENDING"])).toBe(false);
    expect(isApprovalGateSatisfied("SINGLE", ["REJECTED"])).toBe(false);
    expect(isApprovalGateSatisfied("ANY", ["PENDING", "PENDING"])).toBe(false);
  });
});

describe("stepDecisionOutcome", () => {
  it("REJECTED decision always rejects the request", () => {
    const outcome = stepDecisionOutcome("ALL", ["APPROVED"], "REJECTED");
    expect(outcome).toEqual({ gate: "REJECTED", requestStatus: "REJECTED" });
  });

  it("CHANGES_REQUESTED decision sends the request back", () => {
    const outcome = stepDecisionOutcome("SINGLE", [], "CHANGES_REQUESTED");
    expect(outcome).toEqual({ gate: "CHANGES_REQUESTED", requestStatus: "CHANGES_REQUESTED" });
  });

  it("approves when the mode's gate becomes satisfied", () => {
    expect(stepDecisionOutcome("SINGLE", ["APPROVED"], "APPROVED")).toEqual({
      gate: "PASSED",
      requestStatus: "APPROVED",
    });
    expect(stepDecisionOutcome("ALL", ["APPROVED", "APPROVED"], "APPROVED")).toEqual({
      gate: "PASSED",
      requestStatus: "APPROVED",
    });
    expect(stepDecisionOutcome("ANY", ["PENDING", "APPROVED"], "APPROVED")).toEqual({
      gate: "PASSED",
      requestStatus: "APPROVED",
    });
  });

  it("keeps the request awaiting approval when the gate is not yet satisfied", () => {
    expect(stepDecisionOutcome("ALL", ["APPROVED", "PENDING"], "APPROVED")).toEqual({
      gate: "PENDING",
      requestStatus: "AWAITING_APPROVAL",
    });
    expect(stepDecisionOutcome("ANY", ["PENDING", "PENDING"], "APPROVED")).toEqual({
      gate: "PENDING",
      requestStatus: "AWAITING_APPROVAL",
    });
  });
});
