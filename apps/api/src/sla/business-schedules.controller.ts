import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request } from "express";

import { AuthAccessTokenGuard } from "../auth/guards/auth-access-token.guard";
import { getAuthenticatedRequestContext } from "../auth/guards/auth-context";
import { getCorrelationId } from "../common/logging/correlation-id";
import { BusinessSchedulesService } from "./business-schedules.service";
import {
  CreateBusinessScheduleRequestDto,
  optionalString,
  requireString,
  UpdateBusinessScheduleDraftRequestDto,
} from "./dto/sla.dto";

@ApiTags("sla")
@Controller("api/v1/business-schedules")
@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
export class BusinessSchedulesController {
  constructor(
    @Inject(BusinessSchedulesService)
    private readonly schedulesService: BusinessSchedulesService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List business schedules" })
  @ApiOkResponse({ description: "Business schedules for the tenant." })
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  async list(@Req() request: Request) {
    const context = this.requireAuth(request);
    return this.schedulesService.list(context.tenantId, context.userId);
  }

  @Get(":scheduleId")
  @ApiOperation({ summary: "Get a business schedule" })
  @ApiOkResponse({ description: "Business schedule detail." })
  async get(@Param("scheduleId") scheduleId: string, @Req() request: Request) {
    const context = this.requireAuth(request);
    return this.schedulesService.get(context.tenantId, scheduleId, context.userId);
  }

  @Post()
  @ApiOperation({ summary: "Create a business schedule draft" })
  @ApiCreatedResponse({ description: "Created business schedule." })
  async create(@Body() body: CreateBusinessScheduleRequestDto, @Req() request: Request) {
    const context = this.requireAuth(request);
    const raw = body as unknown as Record<string, unknown>;
    return this.schedulesService.create({
      actorUserId: context.userId,
      correlationId: getCorrelationId(request),
      description: optionalString(raw, "description"),
      holidays: raw.holidays,
      key: optionalString(raw, "key"),
      name: requireString(raw, "name"),
      tenantId: context.tenantId,
      timeZone: requireString(raw, "timeZone"),
      weeklyHours: raw.weeklyHours,
    });
  }

  @Patch(":scheduleId")
  @ApiOperation({ summary: "Update the draft business schedule version" })
  @ApiOkResponse({ description: "Updated business schedule." })
  async updateDraft(
    @Param("scheduleId") scheduleId: string,
    @Body() body: UpdateBusinessScheduleDraftRequestDto,
    @Req() request: Request,
  ) {
    const context = this.requireAuth(request);
    const raw = body as unknown as Record<string, unknown>;
    return this.schedulesService.updateDraft({
      actorUserId: context.userId,
      correlationId: getCorrelationId(request),
      description:
        raw.description === null ? null : (optionalString(raw, "description") ?? undefined),
      holidays: raw.holidays,
      name: optionalString(raw, "name"),
      scheduleId,
      tenantId: context.tenantId,
      timeZone: optionalString(raw, "timeZone"),
      weeklyHours: raw.weeklyHours,
    });
  }

  @Post(":scheduleId/publish")
  @ApiOperation({ summary: "Publish the draft business schedule version" })
  @ApiOkResponse({ description: "Published business schedule." })
  async publish(@Param("scheduleId") scheduleId: string, @Req() request: Request) {
    const context = this.requireAuth(request);
    return this.schedulesService.publish(
      context.tenantId,
      scheduleId,
      context.userId,
      getCorrelationId(request),
    );
  }

  private requireAuth(request: Request) {
    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException("Authentication required");
    }
    return context;
  }
}
