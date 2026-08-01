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
import {
  CreateSlaPolicyRequestDto,
  optionalBoolean,
  optionalPositiveInt,
  optionalString,
  optionalStringArray,
  requirePositiveInt,
  requireString,
  UpdateSlaPolicyDraftRequestDto,
} from "./dto/sla.dto";
import { SlaPoliciesService } from "./sla-policies.service";

@ApiTags("sla")
@Controller("api/v1/sla-policies")
@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
export class SlaPoliciesController {
  constructor(@Inject(SlaPoliciesService) private readonly policiesService: SlaPoliciesService) {}

  @Get()
  @ApiOperation({ summary: "List SLA policies" })
  @ApiOkResponse({ description: "SLA policies for the tenant." })
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  async list(@Req() request: Request) {
    const context = this.requireAuth(request);
    return this.policiesService.list(context.tenantId, context.userId);
  }

  @Get(":policyId")
  @ApiOperation({ summary: "Get an SLA policy" })
  @ApiOkResponse({ description: "SLA policy detail." })
  async get(@Param("policyId") policyId: string, @Req() request: Request) {
    const context = this.requireAuth(request);
    return this.policiesService.get(context.tenantId, policyId, context.userId);
  }

  @Post()
  @ApiOperation({ summary: "Create an SLA policy draft" })
  @ApiCreatedResponse({ description: "Created SLA policy." })
  async create(@Body() body: CreateSlaPolicyRequestDto, @Req() request: Request) {
    const context = this.requireAuth(request);
    const raw = body as unknown as Record<string, unknown>;
    return this.policiesService.create({
      actorUserId: context.userId,
      correlationId: getCorrelationId(request),
      description: optionalString(raw, "description"),
      key: requireString(raw, "key"),
      matchChannels: optionalStringArray(raw, "matchChannels"),
      matchPriorities: optionalStringArray(raw, "matchPriorities"),
      matchTypes: optionalStringArray(raw, "matchTypes"),
      name: requireString(raw, "name"),
      pauseOnHold: optionalBoolean(raw, "pauseOnHold"),
      pauseOnPending: optionalBoolean(raw, "pauseOnPending"),
      priority: requirePositiveInt(raw, "priority"),
      resolutionMinutes: requirePositiveInt(raw, "resolutionMinutes"),
      responseMinutes: requirePositiveInt(raw, "responseMinutes"),
      restartResolutionOnReopen: optionalBoolean(raw, "restartResolutionOnReopen"),
      scheduleKey: optionalString(raw, "scheduleKey"),
      tenantId: context.tenantId,
      warningThresholdPercent: optionalPositiveInt(raw, "warningThresholdPercent"),
    });
  }

  @Patch(":policyId")
  @ApiOperation({ summary: "Update the draft SLA policy version" })
  @ApiOkResponse({ description: "Updated SLA policy." })
  async updateDraft(
    @Param("policyId") policyId: string,
    @Body() body: UpdateSlaPolicyDraftRequestDto,
    @Req() request: Request,
  ) {
    const context = this.requireAuth(request);
    const raw = body as unknown as Record<string, unknown>;
    return this.policiesService.updateDraft({
      actorUserId: context.userId,
      correlationId: getCorrelationId(request),
      description:
        raw.description === null ? null : (optionalString(raw, "description") ?? undefined),
      matchChannels: optionalStringArray(raw, "matchChannels"),
      matchPriorities: optionalStringArray(raw, "matchPriorities"),
      matchTypes: optionalStringArray(raw, "matchTypes"),
      name: optionalString(raw, "name"),
      pauseOnHold: optionalBoolean(raw, "pauseOnHold"),
      pauseOnPending: optionalBoolean(raw, "pauseOnPending"),
      policyId,
      priority: optionalPositiveInt(raw, "priority"),
      resolutionMinutes: optionalPositiveInt(raw, "resolutionMinutes"),
      responseMinutes: optionalPositiveInt(raw, "responseMinutes"),
      restartResolutionOnReopen: optionalBoolean(raw, "restartResolutionOnReopen"),
      scheduleKey: optionalString(raw, "scheduleKey"),
      tenantId: context.tenantId,
      warningThresholdPercent: optionalPositiveInt(raw, "warningThresholdPercent"),
    });
  }

  @Post(":policyId/publish")
  @ApiOperation({ summary: "Publish the draft SLA policy version" })
  @ApiOkResponse({ description: "Published SLA policy." })
  async publish(@Param("policyId") policyId: string, @Req() request: Request) {
    const context = this.requireAuth(request);
    return this.policiesService.publish(
      context.tenantId,
      policyId,
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
