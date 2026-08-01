export const WORKFLOW_TRIGGER_TYPES = [
  "ticket.created",
  "ticket.status_changed",
  "ticket.assigned",
  "comment.added",
  "sla.warning",
  "sla.breached",
  "asset.created",
  "asset.status_changed",
] as const;

export type WorkflowTriggerType = (typeof WORKFLOW_TRIGGER_TYPES)[number];

export const WORKFLOW_CONDITION_FIELDS = [
  "status",
  "priority",
  "type",
  "channel",
  "tags",
  "requester",
  "group",
  "assignee",
  "assetType",
  "lifecycleState",
] as const;

export type WorkflowConditionField = (typeof WORKFLOW_CONDITION_FIELDS)[number];

export const WORKFLOW_CONDITION_OPERATORS = ["eq", "neq", "in", "not_in", "contains"] as const;

export type WorkflowConditionOperator = (typeof WORKFLOW_CONDITION_OPERATORS)[number];

export const WORKFLOW_ACTION_TYPES = [
  "change_status",
  "assign",
  "add_internal_comment",
  "create_notification",
  "sla_start",
  "sla_stop",
  "change_asset_status",
] as const;

export type WorkflowActionType = (typeof WORKFLOW_ACTION_TYPES)[number];

export interface WorkflowTrigger {
  type: WorkflowTriggerType;
  fromStatus?: string;
  toStatus?: string;
}

export interface WorkflowCondition {
  ordinal: number;
  field: WorkflowConditionField;
  operator: WorkflowConditionOperator;
  value: unknown;
}

export interface WorkflowAction {
  ordinal: number;
  type: WorkflowActionType;
  params: Record<string, unknown>;
}

export interface WorkflowDefinition {
  triggers: WorkflowTrigger[];
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function assertUniqueOrdinals(label: string, ordinals: number[]): void {
  const seen = new Set<number>();
  for (const ordinal of ordinals) {
    if (!isNonNegativeInt(ordinal)) {
      throw new Error(`${label} ordinal must be a non-negative integer`);
    }
    if (seen.has(ordinal)) {
      throw new Error(`Duplicate ${label} ordinal: ${ordinal}`);
    }
    seen.add(ordinal);
  }
}

function assertActionParams(action: WorkflowAction): void {
  const { params, type } = action;
  switch (type) {
    case "change_status":
      if (typeof params.status !== "string" || !params.status.trim()) {
        throw new Error("change_status action requires string params.status");
      }
      return;
    case "assign": {
      const hasUser = typeof params.assigneeUserId === "string" && params.assigneeUserId.length > 0;
      const hasGroup = typeof params.groupId === "string" && params.groupId.length > 0;
      if (!hasUser && !hasGroup) {
        throw new Error("assign action requires assigneeUserId and/or groupId");
      }
      return;
    }
    case "add_internal_comment":
      if (typeof params.body !== "string" || !params.body.trim()) {
        throw new Error("add_internal_comment action requires string params.body");
      }
      return;
    case "create_notification":
      if (typeof params.eventType !== "string" || !params.eventType.trim()) {
        throw new Error("create_notification action requires string params.eventType");
      }
      return;
    case "sla_start":
    case "sla_stop":
      if (
        params.targetType !== undefined &&
        params.targetType !== "response" &&
        params.targetType !== "resolution"
      ) {
        throw new Error(`${type} action targetType must be response or resolution when set`);
      }
      return;
    case "change_asset_status":
      if (
        typeof params.lifecycleState !== "string" ||
        ![
          "DRAFT",
          "IN_STOCK",
          "ASSIGNED",
          "IN_REPAIR",
          "RETIRED",
          "DISPOSED",
          "LOST",
          "ARCHIVED",
        ].includes(params.lifecycleState)
      ) {
        throw new Error(
          "change_asset_status action requires params.lifecycleState to be a valid asset lifecycle state",
        );
      }
      return;
    default:
      throw new Error(`Unknown action type: ${String(type)}`);
  }
}

export function assertValidWorkflowDefinition(definition: WorkflowDefinition): void {
  if (!Array.isArray(definition.triggers) || definition.triggers.length === 0) {
    throw new Error("At least one trigger is required");
  }
  if (!Array.isArray(definition.actions) || definition.actions.length === 0) {
    throw new Error("At least one action is required");
  }
  if (!Array.isArray(definition.conditions)) {
    throw new Error("conditions must be an array");
  }

  for (const trigger of definition.triggers) {
    if (!WORKFLOW_TRIGGER_TYPES.includes(trigger.type)) {
      throw new Error(`Unknown trigger type: ${String(trigger.type)}`);
    }
  }

  assertUniqueOrdinals(
    "condition",
    definition.conditions.map((condition) => condition.ordinal),
  );
  for (const condition of definition.conditions) {
    if (!WORKFLOW_CONDITION_FIELDS.includes(condition.field)) {
      throw new Error(`Unknown condition field: ${String(condition.field)}`);
    }
    if (!WORKFLOW_CONDITION_OPERATORS.includes(condition.operator)) {
      throw new Error(`Unknown condition operator: ${String(condition.operator)}`);
    }
  }

  const sortedActions = [...definition.actions].sort((a, b) => a.ordinal - b.ordinal);
  assertUniqueOrdinals(
    "action",
    sortedActions.map((action) => action.ordinal),
  );
  for (const action of sortedActions) {
    if (!WORKFLOW_ACTION_TYPES.includes(action.type)) {
      throw new Error(`Unknown action type: ${String(action.type)}`);
    }
    if (!action.params || typeof action.params !== "object" || Array.isArray(action.params)) {
      throw new Error("action params must be an object");
    }
    assertActionParams(action);
  }
}
