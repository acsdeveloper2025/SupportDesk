import { TicketChannel, TicketPriority, TicketStatus, TicketType } from "@prisma/client";

import { isAllowedTicketTransition } from "../../ticketing/domain/ticket.aggregate";
import {
  assertValidWorkflowDefinition,
  WORKFLOW_ACTION_TYPES,
  WORKFLOW_CONDITION_FIELDS,
  WORKFLOW_CONDITION_OPERATORS,
  WORKFLOW_TRIGGER_TYPES,
  type WorkflowAction,
  type WorkflowCondition,
  type WorkflowDefinition,
  type WorkflowTrigger,
} from "./workflow-definition";

export const WORKFLOW_VALIDATION_SCHEMA_VERSION = 1 as const;

export const WORKFLOW_LIMITS = {
  maxActions: 25,
  maxConditions: 25,
  maxDefinitionBytes: 64 * 1024,
  maxNestingDepth: 1,
  maxTriggers: 10,
} as const;

export type WorkflowValidationSeverity = "error" | "warning";

export interface WorkflowValidationIssue {
  code: string;
  severity: WorkflowValidationSeverity;
  path: string;
  message: string;
}

export interface WorkflowValidationReport {
  schemaVersion: typeof WORKFLOW_VALIDATION_SCHEMA_VERSION;
  valid: boolean;
  errors: WorkflowValidationIssue[];
  warnings: WorkflowValidationIssue[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATUS_VALUES = new Set(Object.values(TicketStatus).map((v) => String(v).toLowerCase()));
const PRIORITY_VALUES = new Set(Object.values(TicketPriority).map((v) => String(v).toLowerCase()));
const TYPE_VALUES = new Set(Object.values(TicketType).map((v) => String(v).toLowerCase()));
const CHANNEL_VALUES = new Set(Object.values(TicketChannel).map((v) => String(v).toLowerCase()));

const SEVERITY_RANK: Record<WorkflowValidationSeverity, number> = {
  error: 0,
  warning: 1,
};

export function sortValidationIssues(issues: WorkflowValidationIssue[]): WorkflowValidationIssue[] {
  return [...issues].sort((a, b) => {
    const byPath = a.path.localeCompare(b.path);
    if (byPath !== 0) return byPath;
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return a.code.localeCompare(b.code);
  });
}

export function finalizeReport(issues: WorkflowValidationIssue[]): WorkflowValidationReport {
  const sorted = sortValidationIssues(issues);
  const errors = sorted.filter((i) => i.severity === "error");
  const warnings = sorted.filter((i) => i.severity === "warning");
  return {
    errors,
    schemaVersion: WORKFLOW_VALIDATION_SCHEMA_VERSION,
    valid: errors.length === 0,
    warnings,
  };
}

function issue(
  code: string,
  severity: WorkflowValidationSeverity,
  path: string,
  message: string,
): WorkflowValidationIssue {
  return { code, message, path, severity };
}

function normalizeEnumToken(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return value.trim().toLowerCase();
}

function toTicketStatus(value: unknown): TicketStatus | null {
  const token = normalizeEnumToken(value);
  if (!token) return null;
  const match = Object.values(TicketStatus).find((s) => String(s).toLowerCase() === token);
  return match ?? null;
}

function collectReferencedUserIds(
  definition: WorkflowDefinition,
): Array<{ path: string; userId: string }> {
  const refs: Array<{ path: string; userId: string }> = [];

  definition.actions.forEach((action, index) => {
    if (action.type !== "assign") return;
    const userId = action.params.assigneeUserId;
    if (typeof userId === "string" && userId.length > 0) {
      refs.push({ path: `actions[${index}].params.assigneeUserId`, userId });
    }
  });

  definition.conditions.forEach((condition, index) => {
    if (condition.field !== "assignee" && condition.field !== "requester") return;
    const values =
      condition.operator === "in" || condition.operator === "not_in"
        ? Array.isArray(condition.value)
          ? condition.value
          : []
        : [condition.value];
    values.forEach((value, valueIndex) => {
      if (typeof value === "string" && value.length > 0) {
        const path =
          condition.operator === "in" || condition.operator === "not_in"
            ? `conditions[${index}].value[${valueIndex}]`
            : `conditions[${index}].value`;
        refs.push({ path, userId: value });
      }
    });
  });

  return refs;
}

export function collectWorkflowUserReferences(
  definition: WorkflowDefinition,
): Array<{ path: string; userId: string }> {
  return collectReferencedUserIds(definition);
}

function validateLimits(definition: WorkflowDefinition, issues: WorkflowValidationIssue[]): void {
  if (definition.triggers.length > WORKFLOW_LIMITS.maxTriggers) {
    issues.push(
      issue(
        "WORKFLOW_LIMIT_EXCEEDED",
        "error",
        "triggers",
        `At most ${WORKFLOW_LIMITS.maxTriggers} triggers are allowed`,
      ),
    );
  }
  if (definition.conditions.length > WORKFLOW_LIMITS.maxConditions) {
    issues.push(
      issue(
        "WORKFLOW_LIMIT_EXCEEDED",
        "error",
        "conditions",
        `At most ${WORKFLOW_LIMITS.maxConditions} conditions are allowed`,
      ),
    );
  }
  if (definition.actions.length > WORKFLOW_LIMITS.maxActions) {
    issues.push(
      issue(
        "WORKFLOW_LIMIT_EXCEEDED",
        "error",
        "actions",
        `At most ${WORKFLOW_LIMITS.maxActions} actions are allowed`,
      ),
    );
  }

  const serialized = JSON.stringify(definition);
  if (serialized.length > WORKFLOW_LIMITS.maxDefinitionBytes) {
    issues.push(
      issue(
        "WORKFLOW_LIMIT_EXCEEDED",
        "error",
        "$",
        `Definition exceeds ${WORKFLOW_LIMITS.maxDefinitionBytes} bytes`,
      ),
    );
  }
}

function validateStructuralCatalog(
  definition: WorkflowDefinition,
  issues: WorkflowValidationIssue[],
): void {
  try {
    assertValidWorkflowDefinition(definition);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid workflow definition";
    let code = "WORKFLOW_REQUIRED_FIELD";
    if (message.includes("Unknown trigger")) code = "WORKFLOW_UNKNOWN_TRIGGER";
    else if (
      message.includes("Unknown condition field") ||
      message.includes("Unknown condition operator")
    )
      code = "WORKFLOW_UNKNOWN_CONDITION";
    else if (message.includes("Unknown action")) code = "WORKFLOW_UNKNOWN_ACTION";
    else if (message.includes("Duplicate")) code = "WORKFLOW_DUPLICATE_ORDINAL";
    else if (message.includes("requires") || message.includes("params"))
      code = "WORKFLOW_INVALID_PARAM";
    issues.push(issue(code, "error", "$", message));
  }

  // Nesting: conditions must be flat objects — reject nested condition trees if encoded as objects with children
  definition.conditions.forEach((condition, index) => {
    if (
      condition &&
      typeof condition === "object" &&
      ("all" in (condition as object) ||
        "any" in (condition as object) ||
        "not" in (condition as object) ||
        "children" in (condition as object))
    ) {
      issues.push(
        issue(
          "WORKFLOW_NESTING_UNSUPPORTED",
          "error",
          `conditions[${index}]`,
          `Condition nesting depth exceeds ${WORKFLOW_LIMITS.maxNestingDepth}`,
        ),
      );
    }
  });
}

function validateTriggerSemantics(
  trigger: WorkflowTrigger,
  path: string,
  issues: WorkflowValidationIssue[],
): void {
  if (!WORKFLOW_TRIGGER_TYPES.includes(trigger.type)) {
    issues.push(
      issue(
        "WORKFLOW_UNKNOWN_TRIGGER",
        "error",
        `${path}.type`,
        `Unknown trigger type: ${String(trigger.type)}`,
      ),
    );
    return;
  }

  if (trigger.type === "ticket.status_changed") {
    const from = trigger.fromStatus !== undefined ? toTicketStatus(trigger.fromStatus) : null;
    const to = trigger.toStatus !== undefined ? toTicketStatus(trigger.toStatus) : null;
    if (trigger.fromStatus !== undefined && !from) {
      issues.push(
        issue(
          "WORKFLOW_INVALID_PARAM",
          "error",
          `${path}.fromStatus`,
          "fromStatus must be a valid ticket status",
        ),
      );
    }
    if (trigger.toStatus !== undefined && !to) {
      issues.push(
        issue(
          "WORKFLOW_INVALID_PARAM",
          "error",
          `${path}.toStatus`,
          "toStatus must be a valid ticket status",
        ),
      );
    }
    if (from && to && !isAllowedTicketTransition(from, to)) {
      issues.push(
        issue(
          "WORKFLOW_ILLEGAL_TRANSITION",
          "error",
          path,
          `Illegal trigger transition filter from ${from} to ${to}`,
        ),
      );
    }
  }
}

function validateConditionSemantics(
  condition: WorkflowCondition,
  path: string,
  issues: WorkflowValidationIssue[],
): void {
  if (!WORKFLOW_CONDITION_FIELDS.includes(condition.field)) {
    issues.push(
      issue(
        "WORKFLOW_UNKNOWN_CONDITION",
        "error",
        `${path}.field`,
        `Unknown condition field: ${String(condition.field)}`,
      ),
    );
    return;
  }
  if (!WORKFLOW_CONDITION_OPERATORS.includes(condition.operator)) {
    issues.push(
      issue(
        "WORKFLOW_UNKNOWN_CONDITION",
        "error",
        `${path}.operator`,
        `Unknown condition operator: ${String(condition.operator)}`,
      ),
    );
  }

  if (condition.field === "group") {
    issues.push(
      issue(
        "WORKFLOW_GROUP_UNSUPPORTED",
        "error",
        path,
        "Group conditions are unsupported until Organizations/Groups exist",
      ),
    );
    return;
  }

  const checkEnum = (set: Set<string>, label: string) => {
    const values =
      condition.operator === "in" || condition.operator === "not_in"
        ? Array.isArray(condition.value)
          ? condition.value
          : [condition.value]
        : [condition.value];
    values.forEach((value, idx) => {
      const token = normalizeEnumToken(value);
      if (!token || !set.has(token)) {
        issues.push(
          issue(
            "WORKFLOW_INVALID_PARAM",
            "error",
            condition.operator === "in" || condition.operator === "not_in"
              ? `${path}.value[${idx}]`
              : `${path}.value`,
            `${label} value is invalid`,
          ),
        );
      }
    });
  };

  if (condition.field === "status") checkEnum(STATUS_VALUES, "status");
  if (condition.field === "priority") checkEnum(PRIORITY_VALUES, "priority");
  if (condition.field === "type") checkEnum(TYPE_VALUES, "type");
  if (condition.field === "channel") checkEnum(CHANNEL_VALUES, "channel");

  if (condition.field === "assignee" || condition.field === "requester") {
    const values =
      condition.operator === "in" || condition.operator === "not_in"
        ? Array.isArray(condition.value)
          ? condition.value
          : []
        : [condition.value];
    values.forEach((value, idx) => {
      if (typeof value !== "string" || !UUID_RE.test(value)) {
        issues.push(
          issue(
            "WORKFLOW_INVALID_UUID",
            "error",
            condition.operator === "in" || condition.operator === "not_in"
              ? `${path}.value[${idx}]`
              : `${path}.value`,
            "Expected a UUID user id",
          ),
        );
      }
    });
  }
}

function validateActionSemantics(
  action: WorkflowAction,
  path: string,
  issues: WorkflowValidationIssue[],
): void {
  if (!WORKFLOW_ACTION_TYPES.includes(action.type)) {
    issues.push(
      issue(
        "WORKFLOW_UNKNOWN_ACTION",
        "error",
        `${path}.type`,
        `Unknown action type: ${String(action.type)}`,
      ),
    );
    return;
  }

  if (action.type === "change_status") {
    const status = toTicketStatus(action.params.status);
    if (!status) {
      issues.push(
        issue(
          "WORKFLOW_INVALID_PARAM",
          "error",
          `${path}.params.status`,
          "status must be a valid ticket status",
        ),
      );
    }
  }

  if (action.type === "assign") {
    if (typeof action.params.groupId === "string" && action.params.groupId.length > 0) {
      issues.push(
        issue(
          "WORKFLOW_GROUP_UNSUPPORTED",
          "error",
          `${path}.params.groupId`,
          "Group assignment is unsupported until Organizations/Groups exist",
        ),
      );
    }
    const userId = action.params.assigneeUserId;
    if (typeof userId === "string" && userId.length > 0 && !UUID_RE.test(userId)) {
      issues.push(
        issue(
          "WORKFLOW_INVALID_UUID",
          "error",
          `${path}.params.assigneeUserId`,
          "Expected a UUID user id",
        ),
      );
    }
  }
}

function detectCycleRisk(definition: WorkflowDefinition, issues: WorkflowValidationIssue[]): void {
  const statusTriggers = definition.triggers
    .map((trigger, index) => ({ index, trigger }))
    .filter(({ trigger }) => trigger.type === "ticket.status_changed");
  const statusActions = definition.actions
    .map((action, index) => ({ action, index }))
    .filter(({ action }) => action.type === "change_status");

  if (statusTriggers.length === 0 || statusActions.length === 0) {
    return;
  }

  for (const { action, index: actionIndex } of statusActions) {
    const target = toTicketStatus(action.params.status);
    if (!target) continue;

    for (const { index: triggerIndex, trigger } of statusTriggers) {
      const unrestricted = trigger.fromStatus === undefined && trigger.toStatus === undefined;
      const to = trigger.toStatus !== undefined ? toTicketStatus(trigger.toStatus) : null;
      if (unrestricted || (to && to === target)) {
        issues.push(
          issue(
            "WORKFLOW_CYCLE_RISK",
            "error",
            `actions[${actionIndex}]`,
            `change_status may re-fire ticket.status_changed trigger at triggers[${triggerIndex}]`,
          ),
        );
      }
    }
  }
}

/**
 * Pure structural + semantic + limit + cycle validation (no DB lookups).
 * Caller merges reference issues from WorkflowValidationService.
 * @param mode `draft` = structural + limits + group/uuid guards; `publish` = full semantic/cycle.
 */
export function buildPureValidationReport(
  definition: WorkflowDefinition,
  mode: "draft" | "publish" = "publish",
): WorkflowValidationReport {
  const issues: WorkflowValidationIssue[] = [];

  validateStructuralCatalog(definition, issues);
  validateLimits(definition, issues);

  if (mode === "draft") {
    // Still reject group refs early (ADR-0008) and UUID shape on assign
    definition.conditions.forEach((condition, index) => {
      if (condition.field === "group") {
        issues.push(
          issue(
            "WORKFLOW_GROUP_UNSUPPORTED",
            "error",
            `conditions[${index}]`,
            "Group conditions are unsupported until Organizations/Groups exist",
          ),
        );
      }
    });
    definition.actions.forEach((action, index) => {
      if (action.type === "assign") {
        if (typeof action.params.groupId === "string" && action.params.groupId.length > 0) {
          issues.push(
            issue(
              "WORKFLOW_GROUP_UNSUPPORTED",
              "error",
              `actions[${index}].params.groupId`,
              "Group assignment is unsupported until Organizations/Groups exist",
            ),
          );
        }
        const userId = action.params.assigneeUserId;
        if (typeof userId === "string" && userId.length > 0 && !UUID_RE.test(userId)) {
          issues.push(
            issue(
              "WORKFLOW_INVALID_UUID",
              "error",
              `actions[${index}].params.assigneeUserId`,
              "Expected a UUID user id",
            ),
          );
        }
      }
    });
    return finalizeReport(issues);
  }

  definition.triggers.forEach((trigger, index) => {
    validateTriggerSemantics(trigger, `triggers[${index}]`, issues);
  });
  definition.conditions.forEach((condition, index) => {
    validateConditionSemantics(condition, `conditions[${index}]`, issues);
  });
  definition.actions.forEach((action, index) => {
    validateActionSemantics(action, `actions[${index}]`, issues);
  });

  detectCycleRisk(definition, issues);

  return finalizeReport(issues);
}

export function mergeValidationIssues(
  base: WorkflowValidationReport,
  extra: WorkflowValidationIssue[],
): WorkflowValidationReport {
  return finalizeReport([...base.errors, ...base.warnings, ...extra]);
}
