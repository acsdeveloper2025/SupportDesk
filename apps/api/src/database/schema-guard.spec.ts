import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("schema boundary", () => {
  const tableNames = Prisma.dmmf.datamodel.models.map((model) => model.dbName ?? model.name);

  it("contains the auth, identity, ticket, attachment, and notification foundation tables", () => {
    expect(tableNames).toEqual(
      expect.arrayContaining([
        "attachments",
        "audit_events",
        "auth_tokens",
        "comments",
        "notification_preferences",
        "notifications",
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
