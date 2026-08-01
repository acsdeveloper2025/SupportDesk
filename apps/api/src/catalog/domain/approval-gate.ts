import type { ServiceApprovalMode, ServiceApprovalStatus } from "@prisma/client";

export type ApprovalDecision = "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

export type ApprovalGateOutcome = "PENDING" | "PASSED" | "REJECTED" | "CHANGES_REQUESTED";

/**
 * Narrow contract for the request approval gate.
 *
 * The built-in step-based engine implements this interface. Future workflow-driven
 * approval engines can replace the implementation without touching request,
 * fulfillment, or ticket-generation flows.
 */
export interface ApprovalGate {
  readonly mode: ServiceApprovalMode;
  /** Number of approval steps currently pending decision. */
  pendingStepCount(): number;
  /** Current overall gate outcome given step statuses. */
  evaluate(statuses: ServiceApprovalStatus[]): ApprovalGateOutcome;
  /** Whether fulfillment may proceed given the current step statuses. */
  isSatisfied(statuses: ServiceApprovalStatus[]): boolean;
}

/**
 * Pure evaluation of the gate outcome for a given mode.
 *
 * - NONE / SINGLE: a single approval step gates the request.
 * - ALL: every step must approve (sequential chain).
 * - ANY: the first decision decides (parallel approvers).
 */
export function evaluateApprovalGate(
  mode: ServiceApprovalMode,
  statuses: ServiceApprovalStatus[],
): ApprovalGateOutcome {
  if (mode === "NONE") {
    return "PASSED";
  }

  if (mode === "SINGLE" || mode === "ANY") {
    const decided = statuses.find((status) => status !== "PENDING");
    if (!decided) {
      return "PENDING";
    }
    return decided === "APPROVED" ? "PASSED" : decided;
  }

  // ALL: sequential chain
  if (statuses.some((status) => status === "REJECTED")) {
    return "REJECTED";
  }
  if (statuses.some((status) => status === "CHANGES_REQUESTED")) {
    return "CHANGES_REQUESTED";
  }
  if (statuses.every((status) => status === "APPROVED")) {
    return "PASSED";
  }
  return "PENDING";
}

export function isApprovalGateSatisfied(
  mode: ServiceApprovalMode,
  statuses: ServiceApprovalStatus[],
): boolean {
  return evaluateApprovalGate(mode, statuses) === "PASSED";
}

/**
 * When a step is decided in ALL mode, later steps remain pending until their turn;
 * earlier steps that approved stay approved. Returns the outcome the request
 * should transition to after a step decision.
 */
export function stepDecisionOutcome(
  mode: ServiceApprovalMode,
  statuses: ServiceApprovalStatus[],
  decision: ApprovalDecision,
): {
  gate: ApprovalGateOutcome;
  requestStatus: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" | "AWAITING_APPROVAL";
} {
  if (decision === "REJECTED") {
    return { gate: "REJECTED", requestStatus: "REJECTED" };
  }
  if (decision === "CHANGES_REQUESTED") {
    return { gate: "CHANGES_REQUESTED", requestStatus: "CHANGES_REQUESTED" };
  }

  const outcome = evaluateApprovalGate(mode, statuses);
  if (outcome === "PASSED") {
    return { gate: "PASSED", requestStatus: "APPROVED" };
  }
  return { gate: "PENDING", requestStatus: "AWAITING_APPROVAL" };
}
