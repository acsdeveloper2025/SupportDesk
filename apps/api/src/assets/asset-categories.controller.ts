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
  CreateAssetCategoryDto,
  UpdateAssetCategoryDto,
  validateCreateAssetCategoryPayload,
  validateUpdateAssetCategoryPayload,
} from "./dto/asset-dtos";

@ApiTags("asset-categories")
@Controller("api/v1/assets/categories")
@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
export class AssetCategoriesController {
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
  @AuthRateLimit("asset-category-create")
  @ApiOperation({ summary: "Create an asset category (unlimited hierarchy)" })
  @ApiCreatedResponse({ description: "Asset category created" })
  @ApiBadRequestResponse({ description: "Invalid payload or slug conflict" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.category.create permission" })
  async create(@Req() request: Request, @Body() body: CreateAssetCategoryDto) {
    validateCreateAssetCategoryPayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.category.create");
    return this.assetsService.createAssetCategory(
      { tenantId, userId },
      body,
      getCorrelationId(request),
    );
  }

  @Get()
  @ApiOperation({ summary: "List asset categories" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiOkResponse({ description: "Paginated asset categories" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.category.read permission" })
  async list(
    @Req() request: Request,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.category.read");
    return this.assetsService.listAssetCategories(
      { tenantId, userId },
      {
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      },
    );
  }

  @Get("all")
  @ApiOperation({ summary: "List all asset categories (unpaginated, for dropdowns)" })
  @ApiOkResponse({ description: "All asset categories" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.category.read permission" })
  async all(@Req() request: Request) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.category.read");
    return this.assetsService.getAllAssetCategories({ tenantId, userId });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an asset category by ID" })
  @ApiOkResponse({ description: "Asset category details" })
  @ApiNotFoundResponse({ description: "Asset category not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.category.read permission" })
  async get(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.category.read");
    return this.assetsService.getAssetCategory({ tenantId, userId }, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update an asset category" })
  @ApiOkResponse({ description: "Asset category updated" })
  @ApiBadRequestResponse({ description: "Invalid payload, parent not found, or self-parent" })
  @ApiNotFoundResponse({ description: "Asset category not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.category.update permission" })
  async update(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: UpdateAssetCategoryDto,
  ) {
    validateUpdateAssetCategoryPayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.category.update");
    return this.assetsService.updateAssetCategory(
      { tenantId, userId },
      id,
      body,
      getCorrelationId(request),
    );
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete an asset category" })
  @ApiOkResponse({ description: "Asset category deleted" })
  @ApiConflictResponse({ description: "Category has children or is used by assets" })
  @ApiNotFoundResponse({ description: "Asset category not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.category.delete permission" })
  async remove(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.category.delete");
    return this.assetsService.deleteAssetCategory(
      { tenantId, userId },
      id,
      getCorrelationId(request),
    );
  }
}
