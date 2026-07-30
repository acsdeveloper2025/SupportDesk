import { describe, expect, it } from "vitest";

import { SecureTokenService } from "./secure-token.service";

describe("SecureTokenService", () => {
  it("generates unique URL-safe one-time tokens and stable storage hashes", () => {
    const service = new SecureTokenService();

    const first = service.generateToken();
    const second = service.generateToken();

    expect(first.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).toBe(service.hashToken(first.token));
    expect(first.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.tokenHash).not.toContain(first.token);
  });
});
