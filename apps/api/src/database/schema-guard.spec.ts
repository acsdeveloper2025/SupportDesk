import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("schema boundary", () => {
  const tableNames = Prisma.dmmf.datamodel.models.map((model) => model.dbName ?? model.name);

  it("contains the auth, identity, and ticket foundation tables", () => {
    expect(tableNames).toEqual(
      expect.arrayContaining([
        "audit_events",
        "auth_tokens",
        "comments",
        "permissions",
        "refresh_tokens",
        "role_permissions",
        "roles",
        "sessions",
        "tenant_domains",
        "tenant_settings",
        "tenants",
        "tickets",
        "user_preferences",
        "user_profiles",
        "user_roles",
        "users",
      ]),
    );
  });

  it("does not introduce deferred business feature tables", () => {
    const deferredTables = [
      "attachments",
      "notification_intents",
      "organizations",
      "reports",
      "sla_policies",
      "workflows",
    ];

    for (const tableName of deferredTables) {
      expect(tableNames).not.toContain(tableName);
    }
  });
});
