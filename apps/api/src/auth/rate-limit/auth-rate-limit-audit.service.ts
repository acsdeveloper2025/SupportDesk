import { Inject, Injectable } from "@nestjs/common";
import { AuditOutcome } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";

export interface AuthRateLimitExceededInput {
  correlationId?: string;
  retryAfterSeconds: number;
  scope: string;
  tenantId: string | null;
}

@Injectable()
export class AuthRateLimitAuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async recordExceeded(input: AuthRateLimitExceededInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        action: "auth.rate_limit.exceeded",
        correlationId: input.correlationId,
        metadata: {
          retryAfterSeconds: input.retryAfterSeconds,
          scope: input.scope,
        },
        outcome: AuditOutcome.DENIED,
        tenantId: input.tenantId,
      },
    });
  }
}
