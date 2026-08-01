import { describe, expect, it } from "vitest";

import {
  evaluateRecursionBudget,
  PLATFORM_HARD_MAX_AUTOMATION_DEPTH,
} from "./workflow-recursion-budget";

describe("evaluateRecursionBudget", () => {
  it("allows depth below platform max", () => {
    expect(evaluateRecursionBudget(0).isCapped).toBe(false);
    expect(evaluateRecursionBudget(1).isCapped).toBe(false);
    expect(evaluateRecursionBudget(2).isCapped).toBe(false);
  });

  it("caps depth at platform hard max 3", () => {
    const res = evaluateRecursionBudget(3);
    expect(res.isCapped).toBe(true);
    expect(res.maxAllowedDepth).toBe(PLATFORM_HARD_MAX_AUTOMATION_DEPTH);
  });

  it("caps depth if depth > 3", () => {
    expect(evaluateRecursionBudget(4).isCapped).toBe(true);
  });

  it("respects tenant soft limit if lower than platform max", () => {
    const res = evaluateRecursionBudget(2, 2);
    expect(res.isCapped).toBe(true);
    expect(res.maxAllowedDepth).toBe(2);
  });

  it("ignores tenant soft limit if higher than platform max", () => {
    const res = evaluateRecursionBudget(3, 10);
    expect(res.isCapped).toBe(true);
    expect(res.maxAllowedDepth).toBe(3);
  });
});
