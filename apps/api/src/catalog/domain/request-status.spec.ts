import { describe, expect, it } from "vitest";

import {
  assertTransition,
  canTransition,
  isEditableStatus,
  isTerminalStatus,
} from "./request-status";

describe("canTransition", () => {
  it("allows documented transitions", () => {
    expect(canTransition("SUBMITTED", "AWAITING_APPROVAL")).toBe(true);
    expect(canTransition("SUBMITTED", "IN_FULFILLMENT")).toBe(true);
    expect(canTransition("SUBMITTED", "CANCELLED")).toBe(true);
    expect(canTransition("AWAITING_APPROVAL", "APPROVED")).toBe(true);
    expect(canTransition("AWAITING_APPROVAL", "REJECTED")).toBe(true);
    expect(canTransition("AWAITING_APPROVAL", "CHANGES_REQUESTED")).toBe(true);
    expect(canTransition("APPROVED", "IN_FULFILLMENT")).toBe(true);
    expect(canTransition("CHANGES_REQUESTED", "SUBMITTED")).toBe(true);
    expect(canTransition("IN_FULFILLMENT", "COMPLETED")).toBe(true);
  });

  it("rejects illegal transitions", () => {
    expect(canTransition("SUBMITTED", "COMPLETED")).toBe(false);
    expect(canTransition("REJECTED", "APPROVED")).toBe(false);
    expect(canTransition("COMPLETED", "IN_FULFILLMENT")).toBe(false);
    expect(canTransition("CANCELLED", "SUBMITTED")).toBe(false);
    expect(canTransition("IN_FULFILLMENT", "CANCELLED")).toBe(false);
  });
});

describe("assertTransition", () => {
  it("throws on illegal transitions", () => {
    expect(() => assertTransition("COMPLETED", "SUBMITTED", "REQ-000001")).toThrow(/REQ-000001/);
  });

  it("does not throw on legal transitions", () => {
    expect(() => assertTransition("APPROVED", "IN_FULFILLMENT", "REQ-000001")).not.toThrow();
  });
});

describe("isEditableStatus", () => {
  it("returns true only for SUBMITTED and CHANGES_REQUESTED", () => {
    expect(isEditableStatus("SUBMITTED")).toBe(true);
    expect(isEditableStatus("CHANGES_REQUESTED")).toBe(true);
    expect(isEditableStatus("AWAITING_APPROVAL")).toBe(false);
    expect(isEditableStatus("APPROVED")).toBe(false);
    expect(isEditableStatus("IN_FULFILLMENT")).toBe(false);
  });
});

describe("isTerminalStatus", () => {
  it("returns true for COMPLETED, REJECTED, CANCELLED", () => {
    expect(isTerminalStatus("COMPLETED")).toBe(true);
    expect(isTerminalStatus("REJECTED")).toBe(true);
    expect(isTerminalStatus("CANCELLED")).toBe(true);
    expect(isTerminalStatus("SUBMITTED")).toBe(false);
    expect(isTerminalStatus("IN_FULFILLMENT")).toBe(false);
  });
});
