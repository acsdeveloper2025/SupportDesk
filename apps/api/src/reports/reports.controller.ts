import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Request, Response } from "express";

import { AuthAccessTokenGuard } from "../auth/guards/auth-access-token.guard";
import { getAuthenticatedRequestContext } from "../auth/guards/auth-context";
import { RbacService } from "../rbac/rbac.service";
import {
  CreateReportExportSchema,
  CreateSavedReportSchema,
  CreateScheduledReportSchema,
  ReportQuerySchema,
} from "./dto/report-dtos";
import { ReportsService } from "./reports.service";

@ApiTags("Reports & Analytics")
@ApiBearerAuth()
@UseGuards(AuthAccessTokenGuard)
@Controller("api/v1/reports")
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly rbacService: RbacService,
  ) {}

  private requireAuth(req: Request): { tenantId: string; userId: string } {
    const context = getAuthenticatedRequestContext(req);
    if (!context) {
      throw new UnauthorizedException("Authentication token is invalid or missing");
    }
    return { tenantId: context.tenantId, userId: context.userId };
  }

  private async checkPermission(
    tenantId: string,
    userId: string,
    permissionKey: string,
  ): Promise<void> {
    const allowed = await this.rbacService.can({ tenantId, userId, permissionKey });
    if (!allowed) {
      throw new ForbiddenException(`Permission ${permissionKey} denied`);
    }
  }

  // 1. Executive Dashboard
  @Get("executive")
  @ApiOperation({ summary: "Get executive dashboard report metrics" })
  @ApiOkResponse({ description: "Executive dashboard metrics" })
  public async getExecutiveDashboard(@Req() req: Request, @Query() query: unknown) {
    const auth = this.requireAuth(req);
    await this.checkPermission(auth.tenantId, auth.userId, "report.read");
    const filters = ReportQuerySchema.parse(query);
    return this.reportsService.getExecutiveDashboard(auth.tenantId, filters);
  }

  // 2. Ticket Analytics
  @Get("tickets")
  @ApiOperation({ summary: "Get ticket analytics and aging metrics" })
  @ApiOkResponse({ description: "Ticket analytics metrics" })
  public async getTicketAnalytics(@Req() req: Request, @Query() query: unknown) {
    const auth = this.requireAuth(req);
    await this.checkPermission(auth.tenantId, auth.userId, "report.ticket.read");
    const filters = ReportQuerySchema.parse(query);
    return this.reportsService.getTicketAnalytics(auth.tenantId, filters);
  }

  // 3. SLA Reports
  @Get("sla")
  @ApiOperation({ summary: "Get SLA compliance and breach metrics" })
  @ApiOkResponse({ description: "SLA compliance metrics" })
  public async getSlaReports(@Req() req: Request, @Query() query: unknown) {
    const auth = this.requireAuth(req);
    await this.checkPermission(auth.tenantId, auth.userId, "report.sla.read");
    const filters = ReportQuerySchema.parse(query);
    return this.reportsService.getSlaReports(auth.tenantId, filters);
  }

  // 4. Workflow Reports
  @Get("workflows")
  @ApiOperation({ summary: "Get workflow and automation performance metrics" })
  @ApiOkResponse({ description: "Workflow performance metrics" })
  public async getWorkflowReports(@Req() req: Request, @Query() query: unknown) {
    const auth = this.requireAuth(req);
    await this.checkPermission(auth.tenantId, auth.userId, "report.workflow.read");
    const filters = ReportQuerySchema.parse(query);
    return this.reportsService.getWorkflowReports(auth.tenantId, filters);
  }

  // 5. Asset Reports (CMDB)
  @Get("assets")
  @ApiOperation({ summary: "Get asset inventory and CMDB metrics" })
  @ApiOkResponse({ description: "Asset inventory metrics" })
  public async getAssetReports(@Req() req: Request, @Query() query: unknown) {
    const auth = this.requireAuth(req);
    await this.checkPermission(auth.tenantId, auth.userId, "report.asset.read");
    const filters = ReportQuerySchema.parse(query);
    return this.reportsService.getAssetReports(auth.tenantId, filters);
  }

  // 6. Catalog Reports
  @Get("catalog")
  @ApiOperation({ summary: "Get service catalog analytics" })
  @ApiOkResponse({ description: "Service catalog metrics" })
  public async getCatalogReports(@Req() req: Request, @Query() query: unknown) {
    const auth = this.requireAuth(req);
    await this.checkPermission(auth.tenantId, auth.userId, "report.catalog.read");
    const filters = ReportQuerySchema.parse(query);
    return this.reportsService.getCatalogReports(auth.tenantId, filters);
  }

  // 7. Knowledge Base Reports
  @Get("kb")
  @ApiOperation({ summary: "Get knowledge base usage metrics" })
  @ApiOkResponse({ description: "Knowledge base usage metrics" })
  public async getKbReports(@Req() req: Request, @Query() query: unknown) {
    const auth = this.requireAuth(req);
    await this.checkPermission(auth.tenantId, auth.userId, "report.kb.read");
    const filters = ReportQuerySchema.parse(query);
    return this.reportsService.getKbReports(auth.tenantId, filters);
  }

  // 8. Agent Productivity
  @Get("agents")
  @ApiOperation({ summary: "Get agent productivity and workload metrics" })
  @ApiOkResponse({ description: "Agent productivity metrics" })
  public async getAgentProductivity(@Req() req: Request, @Query() query: unknown) {
    const auth = this.requireAuth(req);
    await this.checkPermission(auth.tenantId, auth.userId, "report.agent.read");
    const filters = ReportQuerySchema.parse(query);
    return this.reportsService.getAgentProductivity(auth.tenantId, filters);
  }

  // Export Engine
  @Post("export")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Export report metrics (CSV, PDF, XLSX)" })
  @ApiOkResponse({ description: "Report export file stream" })
  public async exportReport(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    const auth = this.requireAuth(req);
    await this.checkPermission(auth.tenantId, auth.userId, "report.export.create");
    const payload = CreateReportExportSchema.parse(body);
    const result = await this.reportsService.exportReport(auth.tenantId, auth.userId, payload);

    res.setHeader("Content-Type", result.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
    res.status(200).send(result.fileBuffer);
  }

  // Export History & File Downloads
  @Get("exports")
  @ApiOperation({ summary: "List past generated export files" })
  @ApiOkResponse({ description: "List of report exports" })
  public async listReportExports(@Req() req: Request) {
    const auth = this.requireAuth(req);
    await this.checkPermission(auth.tenantId, auth.userId, "report.export.read");
    return this.reportsService.listReportExports(auth.tenantId, auth.userId);
  }

  @Get("exports/:id/download")
  @ApiOperation({ summary: "Download past exported file" })
  @ApiOkResponse({ description: "Export file stream" })
  public async downloadExportFile(
    @Req() req: Request,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const auth = this.requireAuth(req);
    await this.checkPermission(auth.tenantId, auth.userId, "report.export.download");
    const result = await this.reportsService.downloadExportFile(auth.tenantId, auth.userId, id);

    res.setHeader("Content-Type", result.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
    res.status(200).send(result.fileBuffer);
  }

  // Saved Reports
  @Post("saved")
  @ApiOperation({ summary: "Save custom report configuration" })
  @ApiCreatedResponse({ description: "Saved report created" })
  public async createSavedReport(@Req() req: Request, @Body() body: unknown) {
    const auth = this.requireAuth(req);
    await this.checkPermission(auth.tenantId, auth.userId, "report.saved.create");
    const payload = CreateSavedReportSchema.parse(body);
    return this.reportsService.createSavedReport(auth.tenantId, auth.userId, payload);
  }

  @Get("saved")
  @ApiOperation({ summary: "List saved report configurations" })
  @ApiOkResponse({ description: "List of saved reports" })
  public async getSavedReports(@Req() req: Request) {
    const auth = this.requireAuth(req);
    await this.checkPermission(auth.tenantId, auth.userId, "report.saved.read");
    return this.reportsService.listSavedReports(auth.tenantId, auth.userId);
  }

  @Delete("saved/:id")
  @ApiOperation({ summary: "Delete a saved report" })
  @ApiOkResponse({ description: "Saved report deleted" })
  public async deleteSavedReport(@Req() req: Request, @Param("id") id: string) {
    const auth = this.requireAuth(req);
    await this.checkPermission(auth.tenantId, auth.userId, "report.saved.delete");
    return this.reportsService.deleteSavedReport(auth.tenantId, auth.userId, id);
  }

  // Scheduled Reports
  @Post("scheduled")
  @ApiOperation({ summary: "Create a scheduled report job" })
  @ApiCreatedResponse({ description: "Scheduled report created" })
  public async createScheduledReport(@Req() req: Request, @Body() body: unknown) {
    const auth = this.requireAuth(req);
    await this.checkPermission(auth.tenantId, auth.userId, "report.schedule.create");
    const payload = CreateScheduledReportSchema.parse(body);
    return this.reportsService.createScheduledReport(auth.tenantId, auth.userId, payload);
  }

  @Get("scheduled")
  @ApiOperation({ summary: "List scheduled report jobs" })
  @ApiOkResponse({ description: "List of scheduled reports" })
  public async getScheduledReports(@Req() req: Request) {
    const auth = this.requireAuth(req);
    await this.checkPermission(auth.tenantId, auth.userId, "report.schedule.read");
    return this.reportsService.listScheduledReports(auth.tenantId);
  }

  @Delete("scheduled/:id")
  @ApiOperation({ summary: "Delete a scheduled report job" })
  @ApiOkResponse({ description: "Scheduled report deleted" })
  public async deleteScheduledReport(@Req() req: Request, @Param("id") id: string) {
    const auth = this.requireAuth(req);
    await this.checkPermission(auth.tenantId, auth.userId, "report.schedule.delete");
    return this.reportsService.deleteScheduledReport(auth.tenantId, auth.userId, id);
  }
}
