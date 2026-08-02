import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../database/prisma.service";
import { ReportExporter } from "./export/report-exporter";
import type { ReportsRepository } from "./reports.repository";
import { ReportsService } from "./reports.service";

describe("ReportsService Unit Tests", () => {
  it("exports CSV report with UTF-8 BOM and correct header/row content", () => {
    const csvBuffer = ReportExporter.exportToCsv({
      title: "Executive Ticket Report",
      description: "Unit test export",
      generatedAt: new Date("2026-08-01T12:00:00Z"),
      tenantId: "tenant-123",
      summary: { TotalTickets: 10, OpenTickets: 4 },
      headers: [
        { label: "Ticket Ref", key: "ref" },
        { label: "Status", key: "status" },
      ],
      rows: [
        { ref: "TICK-101", status: "OPEN" },
        { ref: "TICK-102", status: "CLOSED" },
      ],
    });

    const csvStr = csvBuffer.toString("utf-8");
    expect(csvStr).toContain('# Title: "Executive Ticket Report"');
    expect(csvStr).toContain("# Tenant ID: tenant-123");
    expect(csvStr).toContain('"Ticket Ref","Status"');
    expect(csvStr).toContain('"TICK-101","OPEN"');
  });

  it("exports PDF report formatted buffer", () => {
    const pdfBuffer = ReportExporter.exportToPdf({
      title: "Executive SLA Report",
      generatedAt: new Date("2026-08-01T12:00:00Z"),
      tenantId: "tenant-123",
      summary: { CompliancePercent: 98.5 },
      headers: [{ label: "Priority", key: "priority" }],
      rows: [{ priority: "URGENT" }],
    });

    const pdfStr = pdfBuffer.toString("utf-8");
    expect(pdfStr).toContain("%PDF-1.4");
    expect(pdfStr).toContain("SUPPORTDESK ENTERPRISE REPORT");
  });

  it("exports Excel SpreadsheetML formatted buffer", () => {
    const xlsxBuffer = ReportExporter.exportToExcel({
      title: "Asset Summary Report",
      generatedAt: new Date("2026-08-01T12:00:00Z"),
      tenantId: "tenant-123",
      summary: { TotalAssets: 45 },
      headers: [{ label: "Asset Tag", key: "tag" }],
      rows: [{ tag: "AST-99" }],
    });

    const xmlStr = xlsxBuffer.toString("utf-8");
    expect(xmlStr).toContain('<?mso-application progid="Excel.Sheet"?>');
    expect(xmlStr).toContain("Asset Summary Report");
    expect(xmlStr).toContain("AST-99");
  });

  it("invokes reports repository for executive dashboard metrics", async () => {
    const repoMock = {
      getExecutiveDashboard: vi.fn().mockResolvedValue({
        openTickets: 12,
        closedTickets: 85,
        slaComplianceRate: 97.4,
      }),
    };
    const prismaMock = {
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };

    const service = new ReportsService(
      repoMock as unknown as ReportsRepository,
      prismaMock as unknown as PrismaService,
    );
    const result = await service.getExecutiveDashboard("t-1", { range: "30d" });

    expect(result.openTickets).toBe(12);
    expect(repoMock.getExecutiveDashboard).toHaveBeenCalledWith("t-1", { range: "30d" });
  });
});
