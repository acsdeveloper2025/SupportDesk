import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { AssetLifecycleState } from "@prisma/client";
import type { Request } from "express";

import { AuthAccessTokenGuard } from "../auth/guards/auth-access-token.guard";
import { getAuthenticatedRequestContext } from "../auth/guards/auth-context";
import { AuthRateLimit } from "../auth/rate-limit/auth-rate-limit.guard";
import { getCorrelationId } from "../common/logging/correlation-id";
import { RbacService } from "../rbac/rbac.service";
import { AssetsService } from "./assets.service";
import {
  AssignAssetDto,
  CreateAssetDto,
  CreateAssetRelationshipDto,
  CreateTicketFromAssetDto,
  LinkAssetTicketDto,
  TransitionAssetDto,
  UpdateAssetDto,
  validateAssignAssetPayload,
  validateCreateAssetPayload,
  validateCreateAssetRelationshipPayload,
  validateCreateTicketFromAssetPayload,
  validateLinkAssetTicketPayload,
  validateTransitionAssetPayload,
  validateUpdateAssetPayload,
} from "./dto/asset-dtos";

@ApiTags("assets")
@Controller("api/v1/assets")
@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
export class AssetsController {
  constructor(
    @Inject(AssetsService) private readonly assetsService: AssetsService,
    @Inject(RbacService) private readonly rbacService: RbacService,
  ) {}

  private requireAuth(request: Request) {
    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException("Authentication token is invalid or missing");
    }
    return context;
  }

  private async checkPermission(
    tenantId: string,
    userId: string,
    permissionKey: string,
  ): Promise<void> {
    const allowed = await this.rbacService.can({ permissionKey, tenantId, userId });
    if (!allowed) {
      throw new ForbiddenException(`Missing required permission: ${permissionKey}`);
    }
  }

  @Post()
  @AuthRateLimit("asset-create")
  @ApiOperation({ summary: "Create an asset record" })
  @ApiCreatedResponse({ description: "Asset created" })
  @ApiBadRequestResponse({
    description: "Invalid payload, unknown asset type, or invalid lifecycle state",
  })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.create permission" })
  async create(@Req() request: Request, @Body() body: CreateAssetDto) {
    validateCreateAssetPayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.create");
    return this.assetsService.createAsset({ tenantId, userId }, body, getCorrelationId(request));
  }

  @Get()
  @ApiOperation({ summary: "Search and list asset records" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({
    name: "q",
    required: false,
    description: "Full-text-ish search over name, tag, serial, barcode",
  })
  @ApiQuery({
    name: "lifecycleState",
    required: false,
    enum: ["DRAFT", "IN_STOCK", "ASSIGNED", "IN_REPAIR", "RETIRED", "DISPOSED", "LOST", "ARCHIVED"],
  })
  @ApiQuery({ name: "assetTypeId", required: false })
  @ApiQuery({ name: "categoryId", required: false })
  @ApiQuery({ name: "locationId", required: false })
  @ApiQuery({ name: "assignedToUserId", required: false })
  @ApiQuery({ name: "ownerUserId", required: false })
  @ApiOkResponse({ description: "Paginated asset records" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.read permission" })
  async list(
    @Req() request: Request,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("q") q?: string,
    @Query("lifecycleState") lifecycleState?: string,
    @Query("assetTypeId") assetTypeId?: string,
    @Query("categoryId") categoryId?: string,
    @Query("locationId") locationId?: string,
    @Query("assignedToUserId") assignedToUserId?: string,
    @Query("ownerUserId") ownerUserId?: string,
  ) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.read");
    return this.assetsService.listAssets(
      { tenantId, userId },
      {
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
        lifecycleState: lifecycleState ? (lifecycleState as AssetLifecycleState) : undefined,
        categoryId,
        locationId,
        assignedToUserId,
        ownerUserId,
      },
    );
  }

  @Get("summary")
  @ApiOperation({ summary: "Asset lifecycle state summary counts" })
  @ApiOkResponse({ description: "Counts of assets per lifecycle state" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.read permission" })
  async summary(@Req() request: Request) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.read");
    return this.assetsService.getLifecycleSummary({ tenantId, userId });
  }

  @Get("ref/:assetRef")
  @ApiOperation({ summary: "Get an asset by its asset reference (e.g. AST-000001)" })
  @ApiOkResponse({ description: "Asset details" })
  @ApiNotFoundResponse({ description: "Asset not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.read permission" })
  async getByRef(@Req() request: Request, @Param("assetRef") assetRef: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.read");
    return this.assetsService.getAssetByRef({ tenantId, userId }, assetRef);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an asset by ID" })
  @ApiOkResponse({ description: "Asset details with type, category, location, and assignment" })
  @ApiNotFoundResponse({ description: "Asset not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.read permission" })
  async get(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.read");
    return this.assetsService.getAsset({ tenantId, userId }, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update an asset record (bumps version)" })
  @ApiOkResponse({ description: "Asset updated" })
  @ApiBadRequestResponse({ description: "Invalid payload or unknown category/location" })
  @ApiNotFoundResponse({ description: "Asset not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.update permission" })
  async update(@Req() request: Request, @Param("id") id: string, @Body() body: UpdateAssetDto) {
    validateUpdateAssetPayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.update");
    return this.assetsService.updateAsset(
      { tenantId, userId },
      id,
      body,
      getCorrelationId(request),
    );
  }

  @Post(":id/transition")
  @ApiOperation({ summary: "Transition asset lifecycle state (validated state machine)" })
  @ApiOkResponse({ description: "Asset lifecycle state changed" })
  @ApiBadRequestResponse({ description: "Transition not allowed or invalid state" })
  @ApiConflictResponse({ description: "Asset already in target state" })
  @ApiNotFoundResponse({ description: "Asset not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.update permission" })
  async transition(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: TransitionAssetDto,
  ) {
    validateTransitionAssetPayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.update");
    return this.assetsService.transitionAsset(
      { tenantId, userId },
      id,
      body,
      getCorrelationId(request),
    );
  }

  @Delete(":id")
  @ApiOperation({ summary: "Soft-delete an asset record" })
  @ApiOkResponse({ description: "Asset soft-deleted" })
  @ApiNotFoundResponse({ description: "Asset not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.delete permission" })
  async remove(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.delete");
    return this.assetsService.deleteAsset({ tenantId, userId }, id, getCorrelationId(request));
  }

  // -------------------------------------------------------------------------
  // History and assignments
  // -------------------------------------------------------------------------

  @Get(":id/history")
  @ApiOperation({
    summary: "Get full asset history (lifecycle, assignments, relationships, links)",
  })
  @ApiOkResponse({ description: "Asset history entries" })
  @ApiNotFoundResponse({ description: "Asset not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.history.read permission" })
  async history(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.history.read");
    return this.assetsService.getAssetHistory({ tenantId, userId }, id);
  }

  @Get(":id/assignments")
  @ApiOperation({ summary: "List all assignment records for an asset" })
  @ApiOkResponse({ description: "Assignment history" })
  @ApiNotFoundResponse({ description: "Asset not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.read permission" })
  async assignments(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.read");
    return this.assetsService.getAssetAssignments({ tenantId, userId }, id);
  }

  @Post(":id/assignments")
  @AuthRateLimit("asset-assign")
  @ApiOperation({ summary: "Assign an asset to a user, department, or location" })
  @ApiCreatedResponse({ description: "Asset assigned" })
  @ApiBadRequestResponse({ description: "Invalid assignment payload or unknown location" })
  @ApiNotFoundResponse({ description: "Asset not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.assign permission" })
  async assign(@Req() request: Request, @Param("id") id: string, @Body() body: AssignAssetDto) {
    validateAssignAssetPayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.assign");
    return this.assetsService.assignAsset(
      { tenantId, userId },
      id,
      body,
      getCorrelationId(request),
    );
  }

  @Delete(":id/assignments")
  @ApiOperation({ summary: "Remove the current assignment from an asset" })
  @ApiOkResponse({ description: "Asset unassigned" })
  @ApiNotFoundResponse({ description: "Asset not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.assign permission" })
  async unassign(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.assign");
    return this.assetsService.unassignAsset({ tenantId, userId }, id, getCorrelationId(request));
  }

  // -------------------------------------------------------------------------
  // Relationships
  // -------------------------------------------------------------------------

  @Get(":id/relationships")
  @ApiOperation({ summary: "List relationships for an asset (outgoing and incoming)" })
  @ApiOkResponse({ description: "Outgoing and incoming relationships" })
  @ApiNotFoundResponse({ description: "Asset not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.read permission" })
  async relationships(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.read");
    return this.assetsService.listRelationships({ tenantId, userId }, id);
  }

  @Post(":id/relationships")
  @ApiOperation({ summary: "Create a relationship from this asset to another" })
  @ApiCreatedResponse({ description: "Relationship created" })
  @ApiBadRequestResponse({ description: "Invalid payload, self-reference, or parent-child cycle" })
  @ApiNotFoundResponse({ description: "Asset or target asset not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.relationship.create permission" })
  async createRelationship(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: CreateAssetRelationshipDto,
  ) {
    validateCreateAssetRelationshipPayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.relationship.create");
    return this.assetsService.createRelationship(
      { tenantId, userId },
      id,
      body,
      getCorrelationId(request),
    );
  }

  @Delete(":id/relationships/:relationshipId")
  @ApiOperation({ summary: "Delete a relationship" })
  @ApiOkResponse({ description: "Relationship deleted" })
  @ApiNotFoundResponse({ description: "Relationship not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.relationship.delete permission" })
  async removeRelationship(
    @Req() request: Request,
    @Param("id") id: string,
    @Param("relationshipId") relationshipId: string,
  ) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.relationship.delete");
    return this.assetsService.deleteRelationship(
      { tenantId, userId },
      id,
      relationshipId,
      getCorrelationId(request),
    );
  }

  // -------------------------------------------------------------------------
  // Ticket integration
  // -------------------------------------------------------------------------

  @Get(":id/tickets")
  @ApiOperation({ summary: "List tickets linked to an asset" })
  @ApiOkResponse({ description: "Linked tickets" })
  @ApiNotFoundResponse({ description: "Asset not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.read permission" })
  async tickets(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.read");
    return this.assetsService.listTicketsForAsset({ tenantId, userId }, id);
  }

  @Post(":id/tickets")
  @ApiOperation({ summary: "Link an existing ticket to an asset" })
  @ApiCreatedResponse({ description: "Asset-ticket link created" })
  @ApiNotFoundResponse({ description: "Asset or ticket not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.ticket.link permission" })
  async linkTicket(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: LinkAssetTicketDto,
  ) {
    validateLinkAssetTicketPayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.ticket.link");
    return this.assetsService.linkTicket(
      { tenantId, userId },
      id,
      body.ticketId,
      getCorrelationId(request),
    );
  }

  @Post(":id/tickets/create")
  @ApiOperation({ summary: "Create a new ticket from an asset and link it" })
  @ApiCreatedResponse({ description: "Ticket created and linked to the asset" })
  @ApiBadRequestResponse({ description: "Invalid ticket payload" })
  @ApiNotFoundResponse({ description: "Asset not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.ticket.link permission" })
  async createTicket(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: CreateTicketFromAssetDto,
  ) {
    validateCreateTicketFromAssetPayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.ticket.link");
    return this.assetsService.createTicketFromAsset(
      { tenantId, userId },
      id,
      body,
      getCorrelationId(request),
    );
  }

  @Delete(":id/tickets/:ticketId")
  @ApiOperation({ summary: "Unlink a ticket from an asset" })
  @ApiOkResponse({ description: "Asset-ticket link removed" })
  @ApiNotFoundResponse({ description: "Asset-ticket link not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.ticket.unlink permission" })
  async unlinkTicket(
    @Req() request: Request,
    @Param("id") id: string,
    @Param("ticketId") ticketId: string,
  ) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.ticket.unlink");
    return this.assetsService.unlinkTicket(
      { tenantId, userId },
      id,
      ticketId,
      getCorrelationId(request),
    );
  }
}
