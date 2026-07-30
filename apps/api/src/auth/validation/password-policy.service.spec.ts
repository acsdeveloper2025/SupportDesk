import { describe, expect, it } from "vitest";

import { PasswordPolicyService } from "./password-policy.service";

describe("PasswordPolicyService", () => {
  it("accepts a password that satisfies the default enterprise policy", () => {
    const service = new PasswordPolicyService();

    expect(service.validate("CorrectHorse9!Battery", { email: "agent@acme.test" })).toEqual({
      errors: [],
      valid: true,
    });
  });

  it("returns safe policy codes for invalid passwords without echoing the password", () => {
    const service = new PasswordPolicyService();

    const result = service.validate("agent", { email: "agent@acme.test" });

    expect(result).toEqual({
      errors: [
        "PASSWORD_TOO_SHORT",
        "PASSWORD_MISSING_UPPERCASE",
        "PASSWORD_MISSING_NUMBER",
        "PASSWORD_MISSING_SYMBOL",
        "PASSWORD_CONTAINS_IDENTIFIER",
      ],
      valid: false,
    });
    expect(JSON.stringify(result)).not.toContain("agent");
  });

  it("detects supported password reuse checks", () => {
    const service = new PasswordPolicyService();

    expect(
      service.validate("CorrectHorse9!Battery", {
        passwordAlreadyUsed: true,
      }),
    ).toEqual({
      errors: ["PASSWORD_RECENTLY_USED"],
      valid: false,
    });
  });
});
