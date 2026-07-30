import { Inject, Injectable } from "@nestjs/common";

import { buildAuditEventData } from "../../audit/audit-event";
import { PrismaService } from "../../database/prisma.service";

export interface AuthRateLimitExceededInput {
  correlationId?: string;
  ipAddress?: string;
  retryAfterSeconds: number;
  scope: string;
  tenantId: string | null;
  userAgent?: string;
}

@Injectable()
export class AuthRateLimitAuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async recordExceeded(input: AuthRateLimitExceededInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: buildAuditEventData({
        action: "auth.rate_limit.exceeded",
        correlationId: input.correlationId,
        ipAddress: input.ipAddress,
        metadata: {
          retryAfterSeconds: input.retryAfterSeconds,
          scope: input.scope,
        },
        outcome: "DENIED",
        targetType: "request_bucket",
        tenantId: input.tenantId,
        userAgent: input.userAgent,
      }),
    });
  }
}
