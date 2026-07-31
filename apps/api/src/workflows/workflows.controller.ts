import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request } from "express";

import { AuthAccessTokenGuard } from "../auth/guards/auth-access-token.guard";
import { getAuthenticatedRequestContext } from "../auth/guards/auth-context";
import { getCorrelationId } from "../common/logging/correlation-id";
import type {
  WorkflowAction,
  WorkflowCondition,
  WorkflowTrigger,
} from "./domain/workflow-definition";
import {
  CreateWorkflowRequestDto,
  optionalArray,
  optionalPositiveInt,
  optionalString,
  PauseWorkflowRequestDto,
  requireArray,
  requirePositiveInt,
  requireString,
  UpdateWorkflowDraftRequestDto,
} from "./dto/workflows.dto";
import { WorkflowsService } from "./workflows.service";

@ApiTags("workflows")
@Controller("api/v1/workflows")
@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
export class WorkflowsController {
  constructor(@Inject(WorkflowsService) private readonly workflowsService: WorkflowsService) {}

  @Get()
  @ApiOperation({ summary: "List workflows" })
  @ApiOkResponse({ description: "Workflows for the tenant." })
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  async list(@Req() request: Request) {
    const context = this.requireAuth(request);
    return this.workflowsService.list(context.tenantId, context.userId);
  }

  @Get(":workflowId")
  @ApiOperation({ summary: "Get a workflow" })
  @ApiOkResponse({ description: "Workflow detail with versions." })
  async get(@Param("workflowId") workflowId: string, @Req() request: Request) {
    const context = this.requireAuth(request);
    return this.workflowsService.get(context.tenantId, workflowId, context.userId);
  }

  @Post()
  @ApiOperation({ summary: "Create a workflow draft" })
  @ApiCreatedResponse({ description: "Created workflow." })
  async create(@Body() body: CreateWorkflowRequestDto, @Req() request: Request) {
    const context = this.requireAuth(request);
    const raw = body as unknown as Record<string, unknown>;
    return this.workflowsService.create({
      actions: requireArray(raw, "actions") as WorkflowAction[],
      actorUserId: context.userId,
      conditions: (optionalArray(raw, "conditions") ?? []) as WorkflowCondition[],
      correlationId: getCorrelationId(request),
      description: optionalString(raw, "description"),
      key: requireString(raw, "key"),
      name: requireString(raw, "name"),
      priority: requirePositiveInt(raw, "priority"),
      tenantId: context.tenantId,
      triggers: requireArray(raw, "triggers") as WorkflowTrigger[],
    });
  }

  @Patch(":workflowId")
  @ApiOperation({ summary: "Update the draft workflow version" })
  @ApiOkResponse({ description: "Updated workflow." })
  async updateDraft(
    @Param("workflowId") workflowId: string,
    @Body() body: UpdateWorkflowDraftRequestDto,
    @Req() request: Request,
  ) {
    const context = this.requireAuth(request);
    const raw = body as unknown as Record<string, unknown>;
    return this.workflowsService.updateDraft({
      actions: optionalArray(raw, "actions") as WorkflowAction[] | undefined,
      actorUserId: context.userId,
      conditions: optionalArray(raw, "conditions") as WorkflowCondition[] | undefined,
      correlationId: getCorrelationId(request),
      description:
        raw.description === null ? null : (optionalString(raw, "description") ?? undefined),
      name: optionalString(raw, "name"),
      priority: optionalPositiveInt(raw, "priority"),
      tenantId: context.tenantId,
      triggers: optionalArray(raw, "triggers") as WorkflowTrigger[] | undefined,
      workflowId,
    });
  }

  @Post(":workflowId/publish")
  @ApiOperation({ summary: "Publish the draft workflow version" })
  @ApiOkResponse({ description: "Published workflow." })
  async publish(@Param("workflowId") workflowId: string, @Req() request: Request) {
    const context = this.requireAuth(request);
    return this.workflowsService.publish(
      context.tenantId,
      workflowId,
      context.userId,
      getCorrelationId(request),
    );
  }

  @Post(":workflowId/pause")
  @ApiOperation({ summary: "Pause a workflow" })
  @ApiOkResponse({ description: "Paused workflow." })
  async pause(
    @Param("workflowId") workflowId: string,
    @Body() body: PauseWorkflowRequestDto,
    @Req() request: Request,
  ) {
    const context = this.requireAuth(request);
    const raw = body as unknown as Record<string, unknown>;
    return this.workflowsService.pause(
      context.tenantId,
      workflowId,
      context.userId,
      optionalString(raw, "reason"),
      getCorrelationId(request),
    );
  }

  @Post(":workflowId/resume")
  @ApiOperation({ summary: "Resume a paused workflow" })
  @ApiOkResponse({ description: "Resumed workflow." })
  async resume(@Param("workflowId") workflowId: string, @Req() request: Request) {
    const context = this.requireAuth(request);
    return this.workflowsService.resume(
      context.tenantId,
      workflowId,
      context.userId,
      getCorrelationId(request),
    );
  }

  @Delete(":workflowId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft-delete a workflow" })
  @ApiNoContentResponse({ description: "Workflow soft-deleted." })
  async softDelete(@Param("workflowId") workflowId: string, @Req() request: Request) {
    const context = this.requireAuth(request);
    await this.workflowsService.softDelete(
      context.tenantId,
      workflowId,
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
