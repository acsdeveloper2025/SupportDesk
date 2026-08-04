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
import type { Request } from "express";

import { AuthAccessTokenGuard } from "../auth/guards/auth-access-token.guard";
import { getAuthenticatedRequestContext } from "../auth/guards/auth-context";
import { AuthRateLimit } from "../auth/rate-limit/auth-rate-limit.guard";
import { getCorrelationId } from "../common/logging/correlation-id";
import { RbacService } from "../rbac/rbac.service";
import { AssetsService } from "./assets.service";
import {
  CreateAssetTypeDto,
  UpdateAssetTypeDto,
  validateCreateAssetTypePayload,
  validateUpdateAssetTypePayload,
} from "./dto/asset-dtos";

@ApiTags("asset-types")
@Controller("api/v1/assets/types")
@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
export class AssetTypesController {
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
  @AuthRateLimit("asset-type-create")
  @ApiOperation({ summary: "Create a custom asset type" })
  @ApiCreatedResponse({ description: "Asset type created" })
  @ApiBadRequestResponse({ description: "Invalid payload or missing key/name" })
  @ApiConflictResponse({ description: "Asset type key already exists" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.type.create permission" })
  async create(@Req() request: Request, @Body() body: CreateAssetTypeDto) {
    validateCreateAssetTypePayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.type.create");
    return this.assetsService.createAssetType(
      { tenantId, userId },
      body,
      getCorrelationId(request),
    );
  }

  @Get()
  @ApiOperation({ summary: "List asset types" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({
    name: "includeSystem",
    required: false,
    type: Boolean,
    description: "Include seeded system types (default true)",
  })
  @ApiQuery({
    name: "customOnly",
    required: false,
    type: Boolean,
    description: "Only tenant custom types",
  })
  @ApiOkResponse({ description: "Paginated asset types" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.type.read permission" })
  async list(
    @Req() request: Request,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("includeSystem") includeSystem?: string,
    @Query("customOnly") customOnly?: string,
  ) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.type.read");
    return this.assetsService.listAssetTypes(
      { tenantId, userId },
      {
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
        includeSystem: includeSystem !== undefined ? includeSystem === "true" : undefined,
        customOnly: customOnly !== undefined ? customOnly === "true" : undefined,
      },
    );
  }

  @Get("all")
  @ApiOperation({ summary: "List all asset types (unpaginated, for dropdowns)" })
  @ApiOkResponse({ description: "All asset types" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.type.read permission" })
  async all(@Req() request: Request) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.type.read");
    return this.assetsService.getAllAssetTypes({ tenantId, userId });
  }

  @Get(":id/kb")
  @ApiOperation({ summary: "List Knowledge Base articles linked to an asset type" })
  @ApiOkResponse({ description: "Linked KB articles" })
  @ApiNotFoundResponse({ description: "Asset type not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.type.read permission" })
  async kbLinks(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.type.read");
    return this.assetsService.listKbForAssetType({ tenantId, userId }, id);
  }

  @Post(":id/kb")
  @ApiOperation({ summary: "Link a Knowledge Base article to an asset type" })
  @ApiCreatedResponse({ description: "KB link created" })
  @ApiNotFoundResponse({ description: "Asset type not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.kb.link permission" })
  async linkKb(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: { articleId: string },
  ) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.kb.link");
    return this.assetsService.linkAssetTypeKb(
      { tenantId, userId },
      id,
      body.articleId,
      getCorrelationId(request),
    );
  }

  @Delete(":id/kb/:articleId")
  @ApiOperation({ summary: "Unlink a Knowledge Base article from an asset type" })
  @ApiOkResponse({ description: "KB link removed" })
  @ApiNotFoundResponse({ description: "KB link not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.kb.link permission" })
  async unlinkKb(
    @Req() request: Request,
    @Param("id") id: string,
    @Param("articleId") articleId: string,
  ) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.kb.link");
    return this.assetsService.unlinkAssetTypeKb(
      { tenantId, userId },
      id,
      articleId,
      getCorrelationId(request),
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an asset type by ID" })
  @ApiOkResponse({ description: "Asset type details" })
  @ApiNotFoundResponse({ description: "Asset type not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.type.read permission" })
  async get(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.type.read");
    return this.assetsService.getAssetType({ tenantId, userId }, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a custom asset type" })
  @ApiOkResponse({ description: "Asset type updated" })
  @ApiBadRequestResponse({ description: "Invalid payload" })
  @ApiNotFoundResponse({ description: "Asset type not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.type.update permission" })
  async update(@Req() request: Request, @Param("id") id: string, @Body() body: UpdateAssetTypeDto) {
    validateUpdateAssetTypePayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.type.update");
    return this.assetsService.updateAssetType(
      { tenantId, userId },
      id,
      body,
      getCorrelationId(request),
    );
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a custom asset type" })
  @ApiOkResponse({ description: "Asset type deleted" })
  @ApiBadRequestResponse({ description: "Cannot delete a system asset type" })
  @ApiConflictResponse({ description: "Asset type is referenced by assets" })
  @ApiNotFoundResponse({ description: "Asset type not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.type.delete permission" })
  async remove(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.type.delete");
    return this.assetsService.deleteAssetType({ tenantId, userId }, id, getCorrelationId(request));
  }
}
