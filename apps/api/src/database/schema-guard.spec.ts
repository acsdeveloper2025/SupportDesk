import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("schema boundary", () => {
  const tableNames = Prisma.dmmf.datamodel.models.map((model) => model.dbName ?? model.name);

  it("contains the auth, identity, ticket, attachment, notification, SLA, workflow, outbox, catalog, KB, and CMDB foundation tables", () => {
    expect(tableNames).toEqual(
      expect.arrayContaining([
        "asset_assignments",
        "asset_attachments",
        "asset_categories",
        "asset_history",
        "asset_locations",
        "asset_relationships",
        "asset_ticket_links",
        "asset_type_kb_links",
        "asset_types",
        "assets",
        "attachments",
        "audit_events",
        "auth_tokens",
        "business_schedule_versions",
        "business_schedules",
        "comments",
        "kb_article_tags",
        "kb_article_versions",
        "kb_articles",
        "kb_categories",
        "kb_ticket_links",
        "kb_tags",
        "notification_intents",
        "notification_preferences",
        "notifications",
        "outbox_events",
        "permissions",
        "refresh_tokens",
        "role_permissions",
        "roles",
        "sessions",
        "service_categories",
        "service_items",
        "service_request_forms",
        "request_templates",
        "service_request_approvals",
        "service_request_attachments",
        "service_request_history",
        "service_requests",
        "request_templates",
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
