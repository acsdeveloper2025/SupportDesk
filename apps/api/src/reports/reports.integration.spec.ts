import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AppModule } from "../app.module";
import { PrismaService } from "../database/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import { ReportsService } from "./reports.service";

const databaseUrl = process.env.DATABASE_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration("Reports & Analytics Integration Tests", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let reportsService: ReportsService;

  let tenantId: string;
  let userId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    reportsService = moduleRef.get(ReportsService);
    const rbacService = moduleRef.get(RbacService);
    vi.spyOn(rbacService, "can").mockResolvedValue(true);

    const tenant = await prisma.tenant.create({
      data: {
        name: "Reports Test Tenant",
        slug: `reports-tenant-${Date.now()}`,
      },
    });
    tenantId = tenant.id;

    const user = await prisma.user.create({
      data: {
        email: `reports-user-${Date.now()}@test.com`,
        emailNormalized: `reports-user-${Date.now()}@test.com`,
        passwordHash: "hash",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (prisma && tenantId) {
      await prisma.reportExport.deleteMany({ where: { tenantId } });
      await prisma.scheduledReport.deleteMany({ where: { tenantId } });
      await prisma.savedReport.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("calculates executive dashboard metrics for tenant", async () => {
    const res = await reportsService.getExecutiveDashboard(tenantId, { range: "30d" });
    expect(res).toBeDefined();
    expect(res.openTickets).toBeDefined();
    expect(res.slaComplianceRate).toBeDefined();
    expect(res.systemHealthSummary.status).toBe("OPERATIONAL");
  });

  it("creates, lists, and deletes saved reports with tenant isolation", async () => {
    const saved = await reportsService.createSavedReport(tenantId, userId, {
      name: "Custom SLA Report",
      description: "Monthly SLA breakdown",
      reportType: "sla",
      config: { range: "30d" },
      isPublic: true,
    });

    expect(saved.id).toBeDefined();
    expect(saved.name).toBe("Custom SLA Report");

    const list = await reportsService.listSavedReports(tenantId, userId);
    expect(list.some((r) => r.id === saved.id)).toBe(true);

    await reportsService.deleteSavedReport(tenantId, userId, saved.id);
    const listAfter = await reportsService.listSavedReports(tenantId, userId);
    expect(listAfter.some((r) => r.id === saved.id)).toBe(false);
  });

  it("creates and lists scheduled reports", async () => {
    const sched = await reportsService.createScheduledReport(tenantId, userId, {
      name: "Daily Executive Brief",
      reportType: "executive",
      frequency: "daily",
      exportFormat: "pdf",
      enabled: true,
    });

    expect(sched.id).toBeDefined();
    expect(sched.frequency).toBe("daily");

    const list = await reportsService.listScheduledReports(tenantId);
    expect(list.some((s) => s.id === sched.id)).toBe(true);

    await reportsService.deleteScheduledReport(tenantId, userId, sched.id);
  });

  it("generates report data exports in CSV, PDF, and XLSX formats", async () => {
    const csvResult = await reportsService.exportReport(tenantId, userId, {
      reportType: "tickets",
      exportFormat: "csv",
      filters: {},
    });

    expect(csvResult.mimeType).toContain("csv");
    expect(csvResult.fileBuffer.length).toBeGreaterThan(0);

    const pdfResult = await reportsService.exportReport(tenantId, userId, {
      reportType: "sla",
      exportFormat: "pdf",
      filters: {},
    });

    expect(pdfResult.mimeType).toBe("application/pdf");
    expect(pdfResult.fileBuffer.toString("utf-8")).toContain("%PDF-1.4");
  });
});
