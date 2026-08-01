import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("schema boundary", () => {
  const tableNames = Prisma.dmmf.datamodel.models.map((model) => model.dbName ?? model.name);

  it("contains the auth, identity, ticket, attachment, notification, SLA, workflow, and outbox foundation tables", () => {
    expect(tableNames).toEqual(
      expect.arrayContaining([
        "attachments",
        "audit_events",
        "auth_tokens",
        "business_schedule_versions",
        "business_schedules",
        "comments",
        "notification_intents",
        "notification_preferences",
        "notifications",
        "outbox_events",
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
        "workflow_action_attempts",
        "workflow_executions",
        "workflow_versions",
        "workflows",
      ]),
    );
  });

  it("does not introduce deferred business feature tables", () => {
    const deferredTables = ["organizations", "reports"];

    for (const tableName of deferredTables) {
      expect(tableNames).not.toContain(tableName);
    }
  });
});
