export interface WorkflowCondition {
  field: string;
  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "not_contains"
    | "in"
    | "not_in"
    | "greater_than"
    | "less_than"
    | "set"
    | "not_set";
  value?: unknown;
}

export interface ConditionEvaluationDetail {
  field: string;
  operator: string;
  expectedValue?: unknown;
  actualValue?: unknown;
  passed: boolean;
}

export interface ConditionEvaluationResult {
  passed: boolean;
  details: ConditionEvaluationDetail[];
}

function getNestedValue(obj: Record<string, unknown> | null | undefined, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function resolveFieldValue(snapshot: Record<string, unknown>, field: string): unknown {
  const direct = getNestedValue(snapshot, field);
  if (direct !== undefined) {
    return direct;
  }
  if (!field.includes(".")) {
    const ticket = getNestedValue(snapshot, `ticket.${field}`);
    if (ticket !== undefined) {
      return ticket;
    }
    const asset = getNestedValue(snapshot, `asset.${field}`);
    if (asset !== undefined) {
      return asset;
    }
  }
  return direct;
}

function normalizeOperator(operator: string): string {
  switch (operator) {
    case "eq":
      return "equals";
    case "neq":
      return "not_equals";
    default:
      return operator;
  }
}

export function evaluateCondition(
  condition: WorkflowCondition,
  snapshot: Record<string, unknown>,
): ConditionEvaluationDetail {
  const actualValue = resolveFieldValue(snapshot, condition.field);
  const { operator: rawOperator, value: expectedValue } = condition;
  const operator = normalizeOperator(rawOperator);
  let passed: boolean;

  switch (operator) {
    case "equals":
      passed = actualValue === expectedValue;
      break;

    case "not_equals":
      passed = actualValue !== expectedValue;
      break;

    case "contains":
      if (typeof actualValue === "string" && typeof expectedValue === "string") {
        passed = actualValue.toLowerCase().includes(expectedValue.toLowerCase());
      } else if (Array.isArray(actualValue)) {
        passed = actualValue.includes(expectedValue);
      } else {
        passed = false;
      }
      break;

    case "not_contains":
      if (typeof actualValue === "string" && typeof expectedValue === "string") {
        passed = !actualValue.toLowerCase().includes(expectedValue.toLowerCase());
      } else if (Array.isArray(actualValue)) {
        passed = !actualValue.includes(expectedValue);
      } else {
        passed = true;
      }
      break;

    case "in":
      if (Array.isArray(expectedValue)) {
        passed = expectedValue.includes(actualValue);
      } else {
        passed = false;
      }
      break;

    case "not_in":
      if (Array.isArray(expectedValue)) {
        passed = !expectedValue.includes(actualValue);
      } else {
        passed = true;
      }
      break;

    case "greater_than":
      if (typeof actualValue === "number" && typeof expectedValue === "number") {
        passed = actualValue > expectedValue;
      } else if (typeof actualValue === "string" && typeof expectedValue === "string") {
        passed = new Date(actualValue).getTime() > new Date(expectedValue).getTime();
      } else {
        passed = false;
      }
      break;

    case "less_than":
      if (typeof actualValue === "number" && typeof expectedValue === "number") {
        passed = actualValue < expectedValue;
      } else if (typeof actualValue === "string" && typeof expectedValue === "string") {
        passed = new Date(actualValue).getTime() < new Date(expectedValue).getTime();
      } else {
        passed = false;
      }
      break;

    case "set":
      passed = actualValue !== null && actualValue !== undefined && actualValue !== "";
      break;

    case "not_set":
      passed = actualValue === null || actualValue === undefined || actualValue === "";
      break;

    default:
      passed = false;
  }

  return {
    field: condition.field,
    operator: condition.operator,
    expectedValue: condition.value,
    actualValue,
    passed,
  };
}

export function evaluateWorkflowConditions(
  conditions: WorkflowCondition[],
  snapshot: Record<string, unknown>,
): ConditionEvaluationResult {
  if (!conditions || conditions.length === 0) {
    return { passed: true, details: [] };
  }

  const details: ConditionEvaluationDetail[] = [];
  let allPassed = true;

  for (const condition of conditions) {
    const detail = evaluateCondition(condition, snapshot);
    details.push(detail);
    if (!detail.passed) {
      allPassed = false;
    }
  }

  return {
    passed: allPassed,
    details,
  };
}
