import { Injectable } from "@nestjs/common";

import { type AuditEventInput, buildAuditEventData } from "../audit/audit-event";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class WorkflowsRepository {
  constructor(private readonly prisma: PrismaService) {}

  get client() {
    return this.prisma;
  }

  async createAudit(audit: AuditEventInput) {
    return this.prisma.auditEvent.create({ data: buildAuditEventData(audit) });
  }

  async findById(tenantId: string, id: string) {
    return this.prisma.workflow.findFirst({
      include: { versions: { orderBy: { versionNumber: "desc" } } },
      where: { deletedAt: null, id, tenantId },
    });
  }

  async findByKey(tenantId: string, key: string) {
    return this.prisma.workflow.findFirst({
      where: { deletedAt: null, key, tenantId },
    });
  }

  async findByPriority(tenantId: string, priority: number, excludeId?: string) {
    return this.prisma.workflow.findFirst({
      where: {
        deletedAt: null,
        priority,
        tenantId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async list(tenantId: string) {
    return this.prisma.workflow.findMany({
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 5,
        },
      },
      orderBy: [{ priority: "asc" }, { key: "asc" }],
      where: { deletedAt: null, tenantId },
    });
  }

  mapDefinitionJson(version: { actions: unknown; conditions: unknown; triggers: unknown }) {
    return {
      actions: version.actions,
      conditions: version.conditions,
      triggers: version.triggers,
    };
  }
}
