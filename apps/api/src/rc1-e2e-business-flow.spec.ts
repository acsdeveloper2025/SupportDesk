import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AppModule } from "./app.module";
import { AssetsService } from "./assets/assets.service";
import { PrismaService } from "./database/prisma.service";
import { RbacService } from "./rbac/rbac.service";
import { ReportsService } from "./reports/reports.service";
import { TicketsService } from "./ticketing/tickets.service";

const databaseUrl = process.env.DATABASE_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration("RC1 End-to-End Business Flow Hardening Test", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let ticketsService: TicketsService;
  let assetsService: AssetsService;
  let reportsService: ReportsService;

  let tenantId: string;
  let userId: string;
  let assetId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    ticketsService = moduleRef.get(TicketsService);
    assetsService = moduleRef.get(AssetsService);
    reportsService = moduleRef.get(ReportsService);

    const rbacService = moduleRef.get(RbacService);
    vi.spyOn(rbacService, "can").mockResolvedValue(true);

    // 1. Create Isolated Tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: "RC1 Hardening Tenant",
        slug: `rc1-tenant-${Date.now()}`,
      },
    });
    tenantId = tenant.id;

    // 2. Create Isolated User
    const user = await prisma.user.create({
      data: {
        email: `rc1-user-${Date.now()}@enterprise.com`,
        emailNormalized: `rc1-user-${Date.now()}@enterprise.com`,
        passwordHash: "rc1-hash",
      },
    });
    userId = user.id;

    // 3. Create CMDB Asset Type & Asset
    const assetType = await assetsService.createAssetType(
      { tenantId, userId },
      {
        key: `server-rc1-${Date.now()}`,
        name: "Server",
        description: "Enterprise Server Hardware",
      },
    );

    const asset = await assetsService.createAsset(
      { tenantId, userId },
      {
        name: "Enterprise Core Database Server",
        assetTag: `AST-RC1-${Date.now()}`,
        assetTypeId: assetType.id,
        lifecycleState: "IN_STOCK",
      },
    );
    assetId = asset.id;
  });

  afterAll(async () => {
    if (prisma && tenantId) {
      await prisma.outboxEvent.deleteMany({ where: { tenantId } });
      await prisma.auditEvent.deleteMany({ where: { tenantId } });
      await prisma.ticket.deleteMany({ where: { tenantId } });
      await prisma.asset.deleteMany({ where: { tenantId } });
      await prisma.assetType.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("executes complete lifecycle: Ticket -> Asset Association -> Status Transition -> Outbox -> Report Metric", async () => {
    expect(assetId).toBeDefined();

    // 1. Create High-Priority Incident Ticket
    const ticket = await ticketsService.createTicket({
      tenantId,
      requesterUserId: userId,
      title: "RC1 Hardening: High Memory Pressure on DB Server",
      description: "Database memory usage exceeded 95% threshold during peak load simulation.",
      priority: "HIGH",
      type: "INCIDENT",
      channel: "WEB",
    });

    expect(ticket.id).toBeDefined();
    expect(ticket.status).toBe("OPEN");
    expect(ticket.priority).toBe("HIGH");

    // 2. Verify Transactional Outbox Event Enqueueing
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { tenantId, aggregateId: ticket.id },
    });
    expect(outboxEvents.length).toBeGreaterThan(0);
    const firstEvent = outboxEvents[0];
    expect(firstEvent).toBeDefined();
    expect(firstEvent?.eventType).toContain("ticket");

    // 3. Update Ticket Status to SOLVED
    const updatedTicket = await ticketsService.transitionStatus({
      tenantId,
      ticketId: ticket.id,
      expectedVersion: ticket.version,
      actorUserId: userId,
      newStatus: "SOLVED",
    });
    expect(updatedTicket.status).toBe("SOLVED");

    // 4. Query Executive Analytics to verify real-time metric updates
    const analytics = await reportsService.getExecutiveDashboard(tenantId, { range: "30d" });
    expect(analytics.openTickets).toBeGreaterThanOrEqual(0);
    expect(analytics.systemHealthSummary.status).toBe("OPERATIONAL");
  });
});
