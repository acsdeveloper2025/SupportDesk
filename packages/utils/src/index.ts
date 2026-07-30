import { randomUUID } from "node:crypto";

export function createCorrelationId(): string {
  return randomUUID();
}

export function toIsoTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}
