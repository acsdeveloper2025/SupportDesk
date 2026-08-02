import { z } from "zod";

export const ReportQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d", "1y", "custom"]).optional().default("30d"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  userId: z.string().uuid().optional(),
  department: z.string().optional(),
  teamId: z.string().uuid().optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
  assetTypeId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  workflowId: z.string().uuid().optional(),
});

export type ReportQueryDto = z.infer<typeof ReportQuerySchema>;

export const CreateSavedReportSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  reportType: z.string().min(1).max(100),
  config: z.record(z.unknown()).optional().default({}),
  isPublic: z.boolean().optional().default(false),
});

export type CreateSavedReportDto = z.input<typeof CreateSavedReportSchema>;

export const UpdateSavedReportSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  config: z.record(z.unknown()).optional(),
  isPublic: z.boolean().optional(),
});

export type UpdateSavedReportDto = z.infer<typeof UpdateSavedReportSchema>;

export const CreateScheduledReportSchema = z.object({
  name: z.string().min(1).max(200),
  reportType: z.string().min(1).max(100),
  savedReportId: z.string().uuid().optional(),
  config: z.record(z.unknown()).optional().default({}),
  frequency: z.enum(["daily", "weekly", "monthly", "custom"]),
  cronExpression: z.string().optional(),
  exportFormat: z.enum(["csv", "pdf", "xlsx"]).default("csv"),
  recipientUserIds: z.array(z.string().uuid()).optional().default([]),
  enabled: z.boolean().optional().default(true),
});

export type CreateScheduledReportDto = z.input<typeof CreateScheduledReportSchema>;

export const UpdateScheduledReportSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  config: z.record(z.unknown()).optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "custom"]).optional(),
  cronExpression: z.string().optional(),
  exportFormat: z.enum(["csv", "pdf", "xlsx"]).optional(),
  recipientUserIds: z.array(z.string().uuid()).optional(),
  enabled: z.boolean().optional(),
});

export type UpdateScheduledReportDto = z.infer<typeof UpdateScheduledReportSchema>;

export const CreateReportExportSchema = z.object({
  reportType: z.string().min(1).max(100),
  exportFormat: z.enum(["csv", "pdf", "xlsx"]).default("csv"),
  filters: z.record(z.unknown()).optional().default({}),
});

export type CreateReportExportDto = z.input<typeof CreateReportExportSchema>;
