import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { AuthRateLimitGuard } from "./auth-rate-limit.guard";

describe("AuthRateLimitGuard", () => {
  it("returns 429 with retry guidance and audits an exceeded auth bucket", async () => {
    const responseHeaders = new Map<string, string>();
    const audits: Array<{ action: string; outcome: string }> = [];
    const guard = new AuthRateLimitGuard(
      {
        consume: () =>
          Promise.resolve({
            allowed: false,
            retryAfterSeconds: 42,
          }),
      },
      {
        recordExceeded: () => {
          audits.push({
            action: "auth.rate_limit.exceeded",
            outcome: "DENIED",
          });

          return Promise.resolve();
        },
      },
      new Reflector(),
    );
    const handler = () => undefined;
    Reflect.defineMetadata("authRateLimit", { scope: "login" }, handler);
    const context = {
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => ({
          body: {
            email: "agent@acme.test",
            tenantId: "11111111-1111-4111-8111-111111111111",
          },
          header: (name: string) => (name === "user-agent" ? "Test Browser" : undefined),
          ip: "192.0.2.1",
        }),
        getResponse: () => ({
          setHeader: (name: string, value: string) => responseHeaders.set(name, value),
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 429,
    });
    expect(responseHeaders.get("Retry-After")).toBe("42");
    expect(audits).toEqual([
      {
        action: "auth.rate_limit.exceeded",
        outcome: "DENIED",
      },
    ]);
  });
});
