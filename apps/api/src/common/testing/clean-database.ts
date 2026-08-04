import type { PrismaClient } from "@prisma/client";

/**
 * Delete every row in the database in foreign-key-safe order.
 *
 * Integration tests run against a dedicated test database and must leave
 * it empty between runs. Deleting out of order (for example removing
 * `users` while `service_requests` still reference them) violates
 * `onDelete: Restrict` constraints, so children must be removed before
 * parents. This list mirrors the Prisma schema's relation graph.
 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.serviceRequestAttachment.deleteMany();
  await prisma.serviceRequestApproval.deleteMany();
  await prisma.serviceRequestHistory.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.requestTemplate.deleteMany();
  await prisma.serviceRequestForm.deleteMany();
  await prisma.serviceItem.deleteMany();
  await prisma.serviceCategory.deleteMany();

  await prisma.assetAttachment.deleteMany();
  await prisma.assetTicketLink.deleteMany();
  await prisma.assetRelationship.deleteMany();
  await prisma.assetAssignment.deleteMany();
  await prisma.assetHistory.deleteMany();
  await prisma.assetTypeKbLink.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.assetType.deleteMany({ where: { isSystem: false } });
  await prisma.assetCategory.deleteMany();
  await prisma.assetLocation.deleteMany();

  await prisma.kbArticleTag.deleteMany();
  await prisma.kbArticleVersion.deleteMany();
  await prisma.kbTicketLink.deleteMany();
  await prisma.kbArticle.deleteMany();
  await prisma.kbTag.deleteMany();
  await prisma.kbCategory.deleteMany();

  await prisma.workflowActionAttempt.deleteMany();
  await prisma.workflowExecution.deleteMany();
  await prisma.workflowVersion.deleteMany();
  await prisma.workflow.deleteMany();

  await prisma.notificationIntent.deleteMany();
  await prisma.outboxEvent.deleteMany();

  await prisma.slaEvaluation.deleteMany();
  await prisma.slaTarget.deleteMany();
  await prisma.slaPolicyVersion.deleteMany();
  await prisma.slaPolicy.deleteMany();
  await prisma.businessScheduleVersion.deleteMany();
  await prisma.businessSchedule.deleteMany();

  await prisma.comment.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.ticket.deleteMany();

  await prisma.notificationPreference.deleteMany();
  await prisma.notification.deleteMany();

  await prisma.reportExport.deleteMany();
  await prisma.scheduledReport.deleteMany();
  await prisma.savedReport.deleteMany();

  await prisma.systemMaintenanceWindow.deleteMany();
  await prisma.featureFlag.deleteMany();
  await prisma.globalSetting.deleteMany();

  await prisma.auditEvent.deleteMany();

  await prisma.authToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.session.deleteMany();

  await prisma.rolePermission.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.role.deleteMany();

  await prisma.userPreference.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();

  await prisma.tenantDomain.deleteMany();
  await prisma.tenantSetting.deleteMany();
  await prisma.tenant.deleteMany();
}
