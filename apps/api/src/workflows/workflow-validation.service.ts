import { Inject, Injectable } from "@nestjs/common";
import { UserState } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { WorkflowDefinition } from "./domain/workflow-definition";
import {
  buildPureValidationReport,
  collectWorkflowUserReferences,
  finalizeReport,
  mergeValidationIssues,
  type WorkflowValidationIssue,
  type WorkflowValidationReport,
} from "./domain/workflow-validation";

@Injectable()
export class WorkflowValidationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  validateDraft(definition: WorkflowDefinition): WorkflowValidationReport {
    return buildPureValidationReport(definition, "draft");
  }

  async validateForPublish(
    tenantId: string,
    definition: WorkflowDefinition,
  ): Promise<WorkflowValidationReport> {
    const pure = buildPureValidationReport(definition, "publish");
    const referenceIssues = await this.validateUserReferences(tenantId, definition);
    return mergeValidationIssues(pure, referenceIssues);
  }

  private async validateUserReferences(
    tenantId: string,
    definition: WorkflowDefinition,
  ): Promise<WorkflowValidationIssue[]> {
    const refs = collectWorkflowUserReferences(definition);
    if (refs.length === 0) {
      return [];
    }

    const uniqueIds = [...new Set(refs.map((ref) => ref.userId))];
    const users = await this.prisma.user.findMany({
      select: { id: true },
      where: {
        id: { in: uniqueIds },
        roles: { some: { revokedAt: null, tenantId } },
        state: UserState.ACTIVE,
      },
    });
    const activeIds = new Set(users.map((user) => user.id));

    const issues: WorkflowValidationIssue[] = [];
    for (const ref of refs) {
      if (!activeIds.has(ref.userId)) {
        issues.push({
          code: "WORKFLOW_UNKNOWN_USER",
          message: "Referenced user is missing or inactive in this tenant",
          path: ref.path,
          severity: "error",
        });
      }
    }
    return finalizeReport(issues).errors;
  }
}
