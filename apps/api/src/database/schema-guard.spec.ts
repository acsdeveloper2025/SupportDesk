import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("auth identity schema boundary", () => {
  const tableNames = Prisma.dmmf.datamodel.models.map((model) => model.dbName ?? model.name);

  it("contains the auth and identity foundation tables", () => {
    expect(tableNames).toEqual(
      expect.arrayContaining([
        "audit_events",
        "permissions",
        "refresh_tokens",
        "role_permissions",
        "roles",
        "sessions",
        "tenant_domains",
        "tenant_settings",
        "tenants",
        "user_preferences",
        "user_profiles",
        "user_roles",
        "users",
      ]),
    );
  });

  it("does not introduce business feature tables", () => {
    expect(tableNames).not.toEqual(
      expect.arrayContaining([
        "attachments",
        "comments",
        "notification_intents",
        "reports",
        "sla_policies",
        "tickets",
        "workflows",
      ]),
    );
  });
});
