import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("schema boundary", () => {
  const tableNames = Prisma.dmmf.datamodel.models.map((model) => model.dbName ?? model.name);

  it("contains the auth, identity, ticket, attachment, notification, SLA, and workflow foundation tables", () => {
    expect(tableNames).toEqual(
      expect.arrayContaining([
        "attachments",
        "audit_events",
        "auth_tokens",
        "business_schedule_versions",
        "business_schedules",
        "comments",
        "notification_preferences",
        "notifications",
        "permissions",
        "refresh_tokens",
        "role_permissions",
        "roles",
        "sessions",
        "sla_evaluations",
        "sla_policies",
        "sla_policy_versions",
        "sla_targets",
        "tenant_domains",
        "tenant_settings",
        "tenants",
        "tickets",
        "user_preferences",
        "user_profiles",
        "user_roles",
        "users",
        "workflow_versions",
        "workflows",
      ]),
    );
  });

  it("does not introduce deferred business feature tables", () => {
    const deferredTables = [
      "notification_intents",
      "organizations",
      "reports",
      "workflow_executions",
    ];

    for (const tableName of deferredTables) {
      expect(tableNames).not.toContain(tableName);
    }
  });
});
