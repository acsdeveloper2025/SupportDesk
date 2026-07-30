import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { AuditOutcome } from "@prisma/client";

export interface AuditEventInput {
  action: string;
  actorUserId?: string | null;
  correlationId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
  outcome: keyof typeof AuditOutcome;
  targetId?: string | null;
  targetType?: string | null;
  tenantId?: string | null;
  userAgent?: string;
}

export function buildAuditEventData(input: AuditEventInput) {
  const metadata = sanitizeAuditMetadata(input.metadata);
  const requestMetadata = {
    ...(input.ipAddress ? { ipHash: hashAuditIdentifier(input.ipAddress) } : {}),
    ...(input.userAgent ? { userAgentHash: hashAuditIdentifier(input.userAgent) } : {}),
  };

  if (Object.keys(requestMetadata).length > 0) {
    metadata.request = requestMetadata;
  }

  return {
    action: input.action,
    actorUserId: input.actorUserId,
    correlationId: input.correlationId,
    metadata: Object.keys(metadata).length > 0 ? (metadata as Prisma.InputJsonValue) : undefined,
    outcome: AuditOutcome[input.outcome],
    targetId: input.targetId,
    targetType: input.targetType,
    tenantId: input.tenantId,
  };
}

function sanitizeAuditMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, Prisma.JsonValue> {
  if (!metadata) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, isSecretKey(key) ? "[REDACTED]" : sanitizeAuditValue(value)]),
  );
}

function sanitizeAuditValue(value: unknown): Prisma.JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeAuditValue);
  }

  if (typeof value === "object") {
    return sanitizeAuditMetadata(value as Record<string, unknown>);
  }

  return "[UNSUPPORTED]";
}

function isSecretKey(key: string): boolean {
  const normalized = key.replaceAll(/[^a-zA-Z0-9]/g, "").toLowerCase();

  return (
    normalized.includes("password") ||
    normalized.includes("secret") ||
    normalized.includes("authorization") ||
    normalized.includes("cookie") ||
    normalized.includes("credential") ||
    normalized.endsWith("token") ||
    normalized.endsWith("tokenhash")
  );
}

function hashAuditIdentifier(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
