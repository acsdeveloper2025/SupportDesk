import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildAuditEventData } from "./audit-event";

describe("buildAuditEventData", () => {
  it("redacts secrets recursively and hashes request identifiers", () => {
    const data = buildAuditEventData({
      action: "auth.test",
      actorUserId: "22222222-2222-4222-8222-222222222222",
      correlationId: "corr-123",
      ipAddress: "203.0.113.10",
      metadata: {
        nested: {
          reason: "test",
          refreshToken: "raw-refresh-token",
        },
        password: "raw-password",
      },
      outcome: "DENIED",
      targetId: "33333333-3333-4333-8333-333333333333",
      targetType: "session",
      tenantId: "11111111-1111-4111-8111-111111111111",
      userAgent: "SupportDesk Test Browser",
    });

    expect(data).toMatchObject({
      action: "auth.test",
      actorUserId: "22222222-2222-4222-8222-222222222222",
      correlationId: "corr-123",
      outcome: "DENIED",
      targetId: "33333333-3333-4333-8333-333333333333",
      targetType: "session",
      tenantId: "11111111-1111-4111-8111-111111111111",
    });
    expect(data.metadata).toEqual({
      nested: {
        reason: "test",
        refreshToken: "[REDACTED]",
      },
      password: "[REDACTED]",
      request: {
        ipHash: hash("203.0.113.10"),
        userAgentHash: hash("SupportDesk Test Browser"),
      },
    });
    expect(JSON.stringify(data)).not.toContain("raw-password");
    expect(JSON.stringify(data)).not.toContain("raw-refresh-token");
    expect(JSON.stringify(data)).not.toContain("203.0.113.10");
    expect(JSON.stringify(data)).not.toContain("SupportDesk Test Browser");
  });
});

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
