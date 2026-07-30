import { describe, expect, it } from "vitest";

import { AuthRateLimitService, InMemoryAuthRateLimitStore } from "./auth-rate-limit.service";

describe("AuthRateLimitService", () => {
  it("limits an authentication dimension within a deterministic window", async () => {
    let now = new Date("2026-07-30T00:00:00.000Z");
    const service = new AuthRateLimitService(
      new InMemoryAuthRateLimitStore(),
      {
        defaultLimit: 2,
        windowSeconds: 60,
      },
      () => now,
    );
    const attempt = {
      dimensions: ["tenant:acme", "identifier:agent@acme.test", "ip:192.0.2.1"],
      scope: "login",
    };

    await expect(service.consume(attempt)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    await expect(service.consume(attempt)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    await expect(service.consume(attempt)).resolves.toMatchObject({
      allowed: false,
      retryAfterSeconds: 60,
    });

    now = new Date("2026-07-30T00:01:00.000Z");
    await expect(service.consume(attempt)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("isolates failed-attempt buckets by tenant and endpoint scope", async () => {
    const service = new AuthRateLimitService(
      new InMemoryAuthRateLimitStore(),
      {
        defaultLimit: 1,
        windowSeconds: 60,
      },
      () => new Date("2026-07-30T00:00:00.000Z"),
    );

    await service.consume({
      dimensions: ["tenant:acme", "identifier:agent@acme.test"],
      scope: "login",
    });

    await expect(
      service.consume({
        dimensions: ["tenant:globex", "identifier:agent@acme.test"],
        scope: "login",
      }),
    ).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    await expect(
      service.consume({
        dimensions: ["tenant:acme", "identifier:agent@acme.test"],
        scope: "password-reset",
      }),
    ).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });
});
