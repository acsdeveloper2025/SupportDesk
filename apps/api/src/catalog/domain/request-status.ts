import type { ServiceRequestStatus } from "@prisma/client";

export const SERVICE_REQUEST_TRANSITIONS: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
  SUBMITTED: ["AWAITING_APPROVAL", "IN_FULFILLMENT", "CANCELLED", "CHANGES_REQUESTED"],
  AWAITING_APPROVAL: ["APPROVED", "REJECTED", "CHANGES_REQUESTED", "CANCELLED"],
  APPROVED: ["IN_FULFILLMENT", "CANCELLED"],
  REJECTED: [],
  CHANGES_REQUESTED: ["SUBMITTED", "CANCELLED"],
  IN_FULFILLMENT: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** Request answers may be edited while the request is submitted or changes were requested. */
export const EDITABLE_STATUSES: ReadonlySet<ServiceRequestStatus> = new Set([
  "SUBMITTED",
  "CHANGES_REQUESTED",
]);

export function canTransition(from: ServiceRequestStatus, to: ServiceRequestStatus): boolean {
  return SERVICE_REQUEST_TRANSITIONS[from].includes(to);
}

export function assertTransition(
  from: ServiceRequestStatus,
  to: ServiceRequestStatus,
  requestRef: string,
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid service request transition ${from} -> ${to} for request ${requestRef}`,
    );
  }
}

export function isEditableStatus(status: ServiceRequestStatus): boolean {
  return EDITABLE_STATUSES.has(status);
}

export function isTerminalStatus(status: ServiceRequestStatus): boolean {
  return status === "COMPLETED" || status === "REJECTED" || status === "CANCELLED";
}
