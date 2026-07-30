import { Controller, Get, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { getCorrelationId } from "../common/logging/correlation-id";
import { DatabaseHealthService } from "../database/database-health.service";

@ApiTags("health")
@Controller()
export class HealthController {
  constructor(private readonly databaseHealth: DatabaseHealthService) {}

  @Get("health")
  @ApiOkResponse({
    description: "Basic application health.",
  })
  getHealth(@Req() request: Request) {
    return this.createResponse("health", "ok", request);
  }

  @Get("live")
  @ApiOkResponse({
    description: "Liveness probe.",
  })
  getLive(@Req() request: Request) {
    return this.createResponse("live", "ok", request);
  }

  @Get("ready")
  @ApiOkResponse({
    description: "Readiness probe.",
  })
  async getReady(@Req() request: Request) {
    const database = await this.databaseHealth.check();

    return this.createResponse("ready", database.status === "ok" ? "ok" : "degraded", request, {
      database,
    });
  }

  private createResponse(
    check: string,
    status: "ok" | "degraded",
    request: Request,
    details: Record<string, unknown> = {},
  ) {
    return {
      check,
      details,
      service: "supportdesk-api",
      status,
      timestamp: new Date().toISOString(),
      correlationId: getCorrelationId(request),
    };
  }
}
