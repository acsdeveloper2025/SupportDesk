import { describe, expect, it } from "vitest";

import {
  assertAllowedAssetTransition,
  isAllowedAssetTransition,
  isTerminalAssetState,
} from "./asset-lifecycle";

describe("Asset lifecycle state machine", () => {
  it("allows draft -> in stock / assigned / disposed / archived", () => {
    expect(isAllowedAssetTransition("DRAFT", "IN_STOCK")).toBe(true);
    expect(isAllowedAssetTransition("DRAFT", "ASSIGNED")).toBe(true);
    expect(isAllowedAssetTransition("DRAFT", "DISPOSED")).toBe(true);
    expect(isAllowedAssetTransition("DRAFT", "ARCHIVED")).toBe(true);
  });

  it("rejects invalid draft transitions", () => {
    expect(isAllowedAssetTransition("DRAFT", "IN_REPAIR")).toBe(false);
    expect(isAllowedAssetTransition("DRAFT", "RETIRED")).toBe(false);
    expect(isAllowedAssetTransition("DRAFT", "LOST")).toBe(false);
  });

  it("allows in stock -> assigned / repair / retired / disposed / lost / archived", () => {
    expect(isAllowedAssetTransition("IN_STOCK", "ASSIGNED")).toBe(true);
    expect(isAllowedAssetTransition("IN_STOCK", "IN_REPAIR")).toBe(true);
    expect(isAllowedAssetTransition("IN_STOCK", "RETIRED")).toBe(true);
    expect(isAllowedAssetTransition("IN_STOCK", "DISPOSED")).toBe(true);
    expect(isAllowedAssetTransition("IN_STOCK", "LOST")).toBe(true);
    expect(isAllowedAssetTransition("IN_STOCK", "ARCHIVED")).toBe(true);
  });

  it("allows assigned -> in stock / repair / retired / disposed / lost / archived", () => {
    expect(isAllowedAssetTransition("ASSIGNED", "IN_STOCK")).toBe(true);
    expect(isAllowedAssetTransition("ASSIGNED", "IN_REPAIR")).toBe(true);
    expect(isAllowedAssetTransition("ASSIGNED", "RETIRED")).toBe(true);
    expect(isAllowedAssetTransition("ASSIGNED", "DISPOSED")).toBe(true);
    expect(isAllowedAssetTransition("ASSIGNED", "LOST")).toBe(true);
  });

  it("allows in repair to return to stock or assigned", () => {
    expect(isAllowedAssetTransition("IN_REPAIR", "IN_STOCK")).toBe(true);
    expect(isAllowedAssetTransition("IN_REPAIR", "ASSIGNED")).toBe(true);
    expect(isAllowedAssetTransition("IN_REPAIR", "RETIRED")).toBe(true);
    expect(isAllowedAssetTransition("IN_REPAIR", "DISPOSED")).toBe(true);
  });

  it("allows recovery from lost", () => {
    expect(isAllowedAssetTransition("LOST", "IN_STOCK")).toBe(true);
    expect(isAllowedAssetTransition("LOST", "ARCHIVED")).toBe(true);
  });

  it("disposed is a terminal state except archival", () => {
    expect(isAllowedAssetTransition("DISPOSED", "ARCHIVED")).toBe(true);
    expect(isAllowedAssetTransition("DISPOSED", "IN_STOCK")).toBe(false);
    expect(isAllowedAssetTransition("DISPOSED", "ASSIGNED")).toBe(false);
  });

  it("archived is a full terminal state", () => {
    expect(isAllowedAssetTransition("ARCHIVED", "DRAFT")).toBe(false);
    expect(isAllowedAssetTransition("ARCHIVED", "IN_STOCK")).toBe(false);
    expect(isTerminalAssetState("ARCHIVED")).toBe(true);
  });

  it("rejects same-state transitions and reports terminal states", () => {
    expect(isAllowedAssetTransition("DRAFT", "DRAFT")).toBe(false);
    expect(isTerminalAssetState("RETIRED")).toBe(true);
    expect(isTerminalAssetState("DISPOSED")).toBe(true);
    expect(isTerminalAssetState("LOST")).toBe(true);
    expect(isTerminalAssetState("ASSIGNED")).toBe(false);
    expect(isTerminalAssetState("DRAFT")).toBe(false);
  });

  it("assertAllowedAssetTransition throws on invalid transitions", () => {
    expect(() => assertAllowedAssetTransition("DRAFT", "RETIRED")).toThrow("not allowed");
    expect(() => assertAllowedAssetTransition("IN_STOCK", "ASSIGNED")).not.toThrow();
  });
});
