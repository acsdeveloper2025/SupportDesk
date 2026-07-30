import { describe, expect, it } from "vitest";

import { PasswordHashingService } from "./password-hashing.service";

describe("PasswordHashingService", () => {
  it("hashes passwords with Argon2id and verifies only the matching password", async () => {
    const service = new PasswordHashingService();

    const hash = await service.hashPassword("CorrectHorse9!Battery");

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain("CorrectHorse9!Battery");
    await expect(service.verifyPassword(hash, "CorrectHorse9!Battery")).resolves.toBe(true);
    await expect(service.verifyPassword(hash, "WrongHorse9!Battery")).resolves.toBe(false);
  });

  it("fails closed for malformed stored hashes", async () => {
    const service = new PasswordHashingService();

    await expect(service.verifyPassword("not-a-valid-hash", "CorrectHorse9!Battery")).resolves.toBe(
      false,
    );
  });
});
