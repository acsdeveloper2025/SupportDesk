import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AppModule } from "./app.module";
import { PrismaService } from "./database/prisma.service";
import { RbacService } from "./rbac/rbac.service";
import { ReportsService } from "./reports/reports.service";
import { TicketsService } from "./ticketing/tickets.service";

const databaseUrl = process.env.DATABASE_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration("RC1 Performance & Load Hardening Test", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let ticketsService: TicketsService;
  let reportsService: ReportsService;

  let tenantId: string;
  let userId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    ticketsService = moduleRef.get(TicketsService);
    reportsService = moduleRef.get(ReportsService);

    const rbacService = moduleRef.get(RbacService);
    vi.spyOn(rbacService, "can").mockResolvedValue(true);

    const tenant = await prisma.tenant.create({
      data: {
        name: "RC1 Performance Tenant",
        slug: `rc1-perf-tenant-${Date.now()}`,
      },
    });
    tenantId = tenant.id;

    const user = await prisma.user.create({
      data: {
        email: `rc1-perf-user-${Date.now()}@enterprise.com`,
        emailNormalized: `rc1-perf-user-${Date.now()}@enterprise.com`,
        passwordHash: "rc1-perf-hash",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (prisma && tenantId) {
      await prisma.outboxEvent.deleteMany({ where: { tenantId } });
      await prisma.auditEvent.deleteMany({ where: { tenantId } });
      await prisma.ticket.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("handles batch concurrent ticket creation under sub-400ms latency", async () => {
    const batchSize = 25;
    const startTime = Date.now();

    const promises = Array.from({ length: batchSize }).map((_, i) =>
      ticketsService.createTicket({
        tenantId,
        requesterUserId: userId,
        title: `RC1 Performance Benchmark Ticket #${i + 1}`,
        description: "Simulated load testing payload for enterprise concurrent stress test.",
        priority: i % 2 === 0 ? "HIGH" : "MEDIUM",
        type: "INCIDENT",
        channel: "WEB",
      }),
    );

    const createdTickets = await Promise.all(promises);
    const totalDurationMs = Date.now() - startTime;

    expect(createdTickets.length).toBe(batchSize);
    expect(totalDurationMs).toBeLessThan(10000); // 25 tickets created concurrently under 10 seconds

    const averageLatencyPerTicket = totalDurationMs / batchSize;
    expect(averageLatencyPerTicket).toBeLessThan(400);
  });

  it("queries executive dashboard analytics over 25+ tickets in sub-500ms", async () => {
    const startTime = Date.now();
    const metrics = await reportsService.getExecutiveDashboard(tenantId, { range: "30d" });
    const queryDurationMs = Date.now() - startTime;

    expect(metrics.openTickets).toBeGreaterThanOrEqual(25);
    expect(queryDurationMs).toBeLessThan(500); // Analytics aggregation executes sub-500ms
  });
});
