import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import {
  CreateReportExportDto,
  CreateSavedReportDto,
  CreateScheduledReportDto,
  ReportQueryDto,
} from "./dto/report-dtos";
import { ReportExportData, ReportExporter } from "./export/report-exporter";
import { ReportsRepository } from "./reports.repository";

interface AgentItem {
  userId: string;
  name: string;
  ticketsAssigned: number;
  ticketsClosed: number;
  commentsAdded: number;
  avgResponseTimeHours: number;
  avgResolutionTimeHours: number;
  slaCompliancePercent: number;
}

@Injectable()
export class ReportsService {
  constructor(
    @Inject(ReportsRepository) private readonly repo: ReportsRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getExecutiveDashboard(tenantId: string, filters: ReportQueryDto) {
    const data = await this.repo.getExecutiveDashboard(tenantId, filters);
    this.recordAudit(tenantId, filters.userId, "report.executive.viewed", "Report", undefined, {
      range: filters.range,
    });
    return data;
  }

  async getTicketAnalytics(tenantId: string, filters: ReportQueryDto) {
    const data = await this.repo.getTicketAnalytics(tenantId, filters);
    this.recordAudit(tenantId, filters.userId, "report.tickets.viewed", "Report", undefined, {
      range: filters.range,
    });
    return data;
  }

  async getSlaReports(tenantId: string, filters: ReportQueryDto) {
    const data = await this.repo.getSlaReports(tenantId, filters);
    this.recordAudit(tenantId, filters.userId, "report.sla.viewed", "Report", undefined, {
      range: filters.range,
    });
    return data;
  }

  async getWorkflowReports(tenantId: string, filters: ReportQueryDto) {
    const data = await this.repo.getWorkflowReports(tenantId, filters);
    this.recordAudit(tenantId, filters.userId, "report.workflows.viewed", "Report", undefined, {
      range: filters.range,
    });
    return data;
  }

  async getAssetReports(tenantId: string, filters: ReportQueryDto) {
    const data = await this.repo.getAssetReports(tenantId, filters);
    this.recordAudit(tenantId, filters.userId, "report.assets.viewed", "Report", undefined, {
      range: filters.range,
    });
    return data;
  }

  async getCatalogReports(tenantId: string, filters: ReportQueryDto) {
    const data = await this.repo.getServiceCatalogReports(tenantId, filters);
    this.recordAudit(tenantId, filters.userId, "report.catalog.viewed", "Report", undefined, {
      range: filters.range,
    });
    return data;
  }

  async getKbReports(tenantId: string, filters: ReportQueryDto) {
    const data = await this.repo.getKbReports(tenantId, filters);
    this.recordAudit(tenantId, filters.userId, "report.kb.viewed", "Report", undefined, {
      range: filters.range,
    });
    return data;
  }

  async getAgentProductivity(tenantId: string, filters: ReportQueryDto) {
    const data = await this.repo.getAgentProductivity(tenantId, filters);
    this.recordAudit(tenantId, filters.userId, "report.agents.viewed", "Report", undefined, {
      range: filters.range,
    });
    return data;
  }

  async exportReport(tenantId: string, userId: string, dto: CreateReportExportDto) {
    const filters: ReportQueryDto = {
      range: (dto.filters?.range as "7d" | "30d" | "90d" | "1y" | "custom") || "30d",
      startDate: dto.filters?.startDate as string | undefined,
      endDate: dto.filters?.endDate as string | undefined,
      userId: dto.filters?.userId as string | undefined,
    };

    let rawData: unknown;
    switch (dto.reportType) {
      case "executive":
        rawData = await this.repo.getExecutiveDashboard(tenantId, filters);
        break;
      case "tickets":
        rawData = await this.repo.getTicketAnalytics(tenantId, filters);
        break;
      case "sla":
        rawData = await this.repo.getSlaReports(tenantId, filters);
        break;
      case "workflows":
        rawData = await this.repo.getWorkflowReports(tenantId, filters);
        break;
      case "assets":
        rawData = await this.repo.getAssetReports(tenantId, filters);
        break;
      case "catalog":
        rawData = await this.repo.getServiceCatalogReports(tenantId, filters);
        break;
      case "kb":
        rawData = await this.repo.getKbReports(tenantId, filters);
        break;
      case "agents":
        rawData = await this.repo.getAgentProductivity(tenantId, filters);
        break;
      default:
        rawData = await this.repo.getExecutiveDashboard(tenantId, filters);
    }

    const payload = this.buildExportData(tenantId, dto.reportType, rawData);
    let fileBuffer: Buffer;
    let mimeType: string;
    let extension: string;

    if (dto.exportFormat === "csv") {
      fileBuffer = ReportExporter.exportToCsv(payload);
      mimeType = "text/csv; charset=utf-8";
      extension = "csv";
    } else if (dto.exportFormat === "pdf") {
      fileBuffer = ReportExporter.exportToPdf(payload);
      mimeType = "application/pdf";
      extension = "pdf";
    } else {
      fileBuffer = ReportExporter.exportToExcel(payload);
      mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      extension = "xlsx";
    }

    const fileName = `${dto.reportType}_report_${Date.now()}.${extension}`;
    const reportExport = await this.repo.createReportExport(tenantId, userId, {
      fileName,
      reportType: dto.reportType,
      exportFormat: dto.exportFormat ?? "csv",
      fileSize: fileBuffer.length,
      status: "COMPLETED",
    });

    this.recordAudit(tenantId, userId, "report.exported", "ReportExport", reportExport.id, {
      format: dto.exportFormat,
      type: dto.reportType,
    });

    return {
      exportId: reportExport.id,
      fileName,
      mimeType,
      fileBuffer,
    };
  }

  async createSavedReport(tenantId: string, userId: string, dto: CreateSavedReportDto) {
    const saved = await this.repo.createSavedReport(tenantId, userId, dto);
    this.recordAudit(tenantId, userId, "report.saved.created", "SavedReport", saved.id, {
      name: dto.name,
    });
    return saved;
  }

  async listSavedReports(tenantId: string, userId: string) {
    return await this.repo.getSavedReports(tenantId, userId);
  }

  async getSavedReportById(tenantId: string, userId: string, id: string) {
    const report = await this.repo.getSavedReportById(tenantId, id);
    if (!report || (report.createdById !== userId && !report.isPublic)) {
      throw new NotFoundException("Saved report not found");
    }
    return report;
  }

  async deleteSavedReport(tenantId: string, userId: string, id: string) {
    const report = await this.repo.getSavedReportById(tenantId, id);
    if (!report || (report.createdById !== userId && !report.isPublic)) {
      throw new NotFoundException("Saved report not found");
    }
    const deleted = await this.repo.deleteSavedReport(tenantId, id);
    this.recordAudit(tenantId, userId, "report.saved.deleted", "SavedReport", id);
    return deleted;
  }

  async createScheduledReport(tenantId: string, userId: string, dto: CreateScheduledReportDto) {
    const schedule = await this.repo.createScheduledReport(tenantId, userId, dto);
    this.recordAudit(tenantId, userId, "report.scheduled.created", "ScheduledReport", schedule.id, {
      frequency: dto.frequency,
    });
    return schedule;
  }

  async listScheduledReports(tenantId: string) {
    return await this.repo.getScheduledReports(tenantId);
  }

  async deleteScheduledReport(tenantId: string, userId: string, id: string) {
    const deleted = await this.repo.deleteScheduledReport(tenantId, id);
    this.recordAudit(tenantId, userId, "report.scheduled.deleted", "ScheduledReport", id);
    return deleted;
  }

  async listReportExports(tenantId: string, userId: string) {
    return await this.repo.getReportExports(tenantId, userId);
  }

  async downloadExportFile(tenantId: string, userId: string, id: string) {
    const exportRecord = await this.repo.getReportExportById(tenantId, id);
    if (!exportRecord) {
      throw new NotFoundException("Report export file not found");
    }

    const filters: ReportQueryDto = { range: "30d" };
    const rawData = await this.repo.getExecutiveDashboard(tenantId, filters);
    const payload = this.buildExportData(tenantId, exportRecord.reportType, rawData);
    let fileBuffer: Buffer;
    let mimeType: string;

    if (exportRecord.exportFormat === "csv") {
      fileBuffer = ReportExporter.exportToCsv(payload);
      mimeType = "text/csv; charset=utf-8";
    } else if (exportRecord.exportFormat === "pdf") {
      fileBuffer = ReportExporter.exportToPdf(payload);
      mimeType = "application/pdf";
    } else {
      fileBuffer = ReportExporter.exportToExcel(payload);
      mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }

    return {
      fileName: exportRecord.fileName,
      mimeType,
      fileBuffer,
    };
  }

  private buildExportData(
    tenantId: string,
    reportType: string,
    rawData: unknown,
  ): ReportExportData {
    const generatedAt = new Date().toISOString();
    const data = (rawData || {}) as Record<string, unknown>;

    if (reportType === "tickets") {
      const statusDist = (data.statusDistribution || {}) as Record<string, number>;
      const priorityDist = (data.priorityDistribution || {}) as Record<string, number>;
      const typeDist = (data.typeDistribution || {}) as Record<string, number>;
      const agingRep = (data.agingReport || {}) as Record<string, number>;

      return {
        title: "Ticket Analytics Report",
        description: "Comprehensive ticket volume, status, priority, and resolution metrics.",
        generatedAt,
        tenantId,
        summary: {
          TotalTickets: (data.totalTickets as number) || 0,
          OpenTickets: (data.openTickets as number) || 0,
          ClosedTickets: (data.closedTickets as number) || 0,
          MTTRHours: (data.mttrHours as number) || 0,
          MTTAHours: (data.mttaHours as number) || 0,
        },
        headers: [
          { label: "Metric Category", key: "category" },
          { label: "Attribute / Key", key: "key" },
          { label: "Value / Count", key: "value" },
        ],
        rows: [
          ...Object.entries(statusDist).map(([k, v]) => ({
            category: "Status Distribution",
            key: k,
            value: v,
          })),
          ...Object.entries(priorityDist).map(([k, v]) => ({
            category: "Priority Distribution",
            key: k,
            value: v,
          })),
          ...Object.entries(typeDist).map(([k, v]) => ({
            category: "Type Distribution",
            key: k,
            value: v,
          })),
          ...Object.entries(agingRep).map(([k, v]) => ({
            category: "Aging Report",
            key: k,
            value: v,
          })),
        ],
      };
    } else if (reportType === "sla") {
      const respSla = (data.responseSla || {}) as Record<string, number>;
      const resSla = (data.resolutionSla || {}) as Record<string, number>;
      const breaches = (data.breachesByPriority || {}) as Record<string, number>;

      return {
        title: "SLA Performance Report",
        description: "SLA target compliance rates, breach statistics, and resolution targets.",
        generatedAt,
        tenantId,
        summary: {
          ComplianceRatePercent: (data.compliancePercent as number) || 100,
          TotalTargets: (data.totalTargets as number) || 0,
          MetTargets: (data.metTargets as number) || 0,
          BreachedTargets: (data.breachedTargets as number) || 0,
          ResponseCompliancePercent: respSla.compliancePercent || 100,
          ResolutionCompliancePercent: resSla.compliancePercent || 100,
        },
        headers: [
          { label: "Breach Category", key: "category" },
          { label: "Priority Level", key: "priority" },
          { label: "Breach Count", key: "count" },
        ],
        rows: Object.entries(breaches).map(([prio, cnt]) => ({
          category: "SLA Breaches",
          priority: prio,
          count: cnt,
        })),
      };
    } else if (reportType === "agents") {
      const agentList = (data.agents || []) as AgentItem[];
      const rows = agentList.map((a) => ({
        agentName: a.name,
        assigned: a.ticketsAssigned,
        closed: a.ticketsClosed,
        comments: a.commentsAdded,
        avgResponseHours: a.avgResponseTimeHours,
        avgResolutionHours: a.avgResolutionTimeHours,
        slaCompliance: `${a.slaCompliancePercent}%`,
      }));

      return {
        title: "Agent Productivity Report",
        description: "Agent workload, closed tickets, comments, and SLA performance.",
        generatedAt,
        tenantId,
        summary: {
          TotalAgents: rows.length,
        },
        headers: [
          { label: "Agent Name", key: "agentName" },
          { label: "Tickets Assigned", key: "assigned" },
          { label: "Tickets Closed", key: "closed" },
          { label: "Comments Added", key: "comments" },
          { label: "Avg Response (hrs)", key: "avgResponseHours" },
          { label: "Avg Resolution (hrs)", key: "avgResolutionHours" },
          { label: "SLA Compliance", key: "slaCompliance" },
        ],
        rows,
      };
    } else {
      return {
        title: `${reportType.toUpperCase()} SUMMARY REPORT`,
        description: "Analytical summary metric snapshot.",
        generatedAt,
        tenantId,
        summary: {
          ReportType: reportType,
        },
        headers: [
          { label: "Metric Name", key: "metric" },
          { label: "Metric Value", key: "value" },
        ],
        rows: Object.entries(data)
          .filter(([, v]) => typeof v !== "object")
          .map(([k, v]) => ({ metric: k, value: String(v) })),
      };
    }
  }

  private recordAudit(
    tenantId: string,
    actorUserId: string | undefined,
    action: string,
    targetType: string,
    correlationId?: string,
    metadata?: Record<string, unknown>,
  ) {
    this.prisma.auditEvent
      .create({
        data: {
          tenantId,
          actorUserId: actorUserId || null,
          action,
          outcome: "SUCCESS",
          targetType,
          correlationId: correlationId || null,
          metadata: metadata ? (metadata as Prisma.InputJsonObject) : undefined,
        },
      })
      .catch(() => {
        // Audit record background catch
      });
  }
}
