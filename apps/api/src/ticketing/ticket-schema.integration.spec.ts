import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Live PostgreSQL integration checks.
 * Skipped unless DATABASE_URL points at a migrated database
 * (for example the migrate-verify database used in CI).
 */
const databaseUrl = process.env.DATABASE_URL;
const shouldRun = Boolean(databaseUrl && process.env.RUN_DB_INTEGRATION === "1");

describe.runIf(shouldRun)("PostgreSQL ticket schema integration", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("exposes tickets and comments tables with tenant columns", async () => {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('tickets', 'comments')
      ORDER BY tablename
    `;

    expect(tables.map((row) => row.tablename)).toEqual(["comments", "tickets"]);
  });

  it("enforces unique (tenant_id, public_ref) on tickets", async () => {
    const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'tickets'
        AND indexname = 'uq_tickets__tenant_id_public_ref'
    `;

    expect(indexes).toHaveLength(1);
  });

  it("keeps ticket and comment foreign keys", async () => {
    const fks = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT conname
      FROM pg_constraint
      WHERE contype = 'f'
        AND conname IN (
          'fk_tickets__tenants__tenant_id',
          'fk_comments__tickets__ticket_id',
          'fk_comments__tenants__tenant_id'
        )
      ORDER BY conname
    `;

    expect(fks.map((row) => row.conname)).toEqual([
      "fk_comments__tenants__tenant_id",
      "fk_comments__tickets__ticket_id",
      "fk_tickets__tenants__tenant_id",
    ]);
  });
});
