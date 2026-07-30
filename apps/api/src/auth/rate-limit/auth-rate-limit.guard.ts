import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";

import { getCorrelationId } from "../../common/logging/correlation-id";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import { AuthRateLimitAuditService } from "./auth-rate-limit-audit.service";

const authRateLimitMetadataKey = "authRateLimit";

export interface AuthRateLimitMetadata {
  limit?: number;
  scope: string;
}

export const AuthRateLimit = (scope: string, limit?: number) =>
  SetMetadata(authRateLimitMetadataKey, {
    limit,
    scope,
  } satisfies AuthRateLimitMetadata);

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(
    @Inject(AuthRateLimitService)
    private readonly rateLimits: Pick<AuthRateLimitService, "consume">,
    @Inject(AuthRateLimitAuditService)
    private readonly audit: Pick<AuthRateLimitAuditService, "recordExceeded">,
    @Inject(Reflector)
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.get<AuthRateLimitMetadata>(
      authRateLimitMetadataKey,
      context.getHandler(),
    );

    if (!metadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const decision = await this.rateLimits.consume({
      dimensions: buildDimensions(request),
      limit: metadata.limit,
      scope: metadata.scope,
    });

    if (decision.allowed) {
      return true;
    }

    response.setHeader("Retry-After", String(decision.retryAfterSeconds));
    await this.audit.recordExceeded({
      correlationId: getCorrelationId(request),
      retryAfterSeconds: decision.retryAfterSeconds,
      scope: metadata.scope,
      tenantId: readTenantId(request.body),
    });

    throw new HttpException(
      {
        code: "AUTH_RATE_LIMITED",
        message: "Too many authentication attempts.",
        retryAfterSeconds: decision.retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

function buildDimensions(request: Request): string[] {
  const body = asRecord(request.body);
  const tenant = asRecord(body["tenant"]);

  return [
    `tenant:${readString(body["tenantId"]) ?? readString(tenant["slug"]) ?? "unknown"}`,
    `identifier:${readString(body["email"]) ?? readString(body["identifier"]) ?? "unknown"}`,
    `token:${readString(body["token"]) ?? readString(body["refreshToken"]) ?? "none"}`,
    `session:${request.header("x-session-id") ?? "none"}`,
    `device:${request.header("user-agent") ?? "unknown"}`,
    `ip:${request.ip || "unknown"}`,
  ];
}

function readTenantId(value: unknown): string | null {
  const tenantId = readString(asRecord(value)["tenantId"]);

  return tenantId && uuidPattern.test(tenantId) ? tenantId : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
