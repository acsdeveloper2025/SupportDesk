export type WorkflowDiffChangeType = "added" | "removed" | "changed";

export interface WorkflowDiffChange {
  path: string;
  change: WorkflowDiffChangeType;
  before?: unknown;
  after?: unknown;
}

export interface WorkflowVersionSnapshot {
  triggers: unknown;
  conditions: unknown;
  actions: unknown;
}

export interface WorkflowVersionDiff {
  fromVersion: number;
  toVersion: number;
  generatedAt: string;
  changeCount: number;
  changes: WorkflowDiffChange[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pushChange(
  changes: WorkflowDiffChange[],
  path: string,
  change: WorkflowDiffChangeType,
  before?: unknown,
  after?: unknown,
): void {
  const entry: WorkflowDiffChange = { change, path };
  if (before !== undefined) entry.before = before;
  if (after !== undefined) entry.after = after;
  changes.push(entry);
}

function diffValue(
  path: string,
  before: unknown,
  after: unknown,
  changes: WorkflowDiffChange[],
): void {
  if (Object.is(before, after)) {
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const max = Math.max(before.length, after.length);
    for (let i = 0; i < max; i += 1) {
      const childPath = `${path}[${i}]`;
      if (i >= before.length) {
        pushChange(changes, childPath, "added", undefined, after[i]);
      } else if (i >= after.length) {
        pushChange(changes, childPath, "removed", before[i], undefined);
      } else {
        diffValue(childPath, before[i], after[i], changes);
      }
    }
    return;
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of [...keys].sort()) {
      const childPath = path ? `${path}.${key}` : key;
      if (!(key in before)) {
        pushChange(changes, childPath, "added", undefined, after[key]);
      } else if (!(key in after)) {
        pushChange(changes, childPath, "removed", before[key], undefined);
      } else {
        diffValue(childPath, before[key], after[key], changes);
      }
    }
    return;
  }

  if (before === undefined) {
    pushChange(changes, path, "added", undefined, after);
    return;
  }
  if (after === undefined) {
    pushChange(changes, path, "removed", before, undefined);
    return;
  }
  pushChange(changes, path, "changed", before, after);
}

/**
 * Diff immutable workflow version JSON snapshots (triggers/conditions/actions only).
 */
export function diffWorkflowSnapshots(
  fromVersion: number,
  toVersion: number,
  fromSnapshot: WorkflowVersionSnapshot,
  toSnapshot: WorkflowVersionSnapshot,
  generatedAt: Date = new Date(),
): WorkflowVersionDiff {
  const changes: WorkflowDiffChange[] = [];
  diffValue("triggers", fromSnapshot.triggers, toSnapshot.triggers, changes);
  diffValue("conditions", fromSnapshot.conditions, toSnapshot.conditions, changes);
  diffValue("actions", fromSnapshot.actions, toSnapshot.actions, changes);

  changes.sort((a, b) => a.path.localeCompare(b.path));

  return {
    changeCount: changes.length,
    changes,
    fromVersion,
    generatedAt: generatedAt.toISOString(),
    toVersion,
  };
}
