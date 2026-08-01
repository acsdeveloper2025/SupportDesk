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
  CreateAssetLocationDto,
  UpdateAssetLocationDto,
  validateCreateAssetLocationPayload,
  validateUpdateAssetLocationPayload,
} from "./dto/asset-dtos";

@ApiTags("asset-locations")
@Controller("api/v1/assets/locations")
@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
export class AssetLocationsController {
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
  @AuthRateLimit("asset-location-create")
  @ApiOperation({ summary: "Create an asset location" })
  @ApiCreatedResponse({ description: "Asset location created" })
  @ApiBadRequestResponse({ description: "Invalid payload" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.location.create permission" })
  async create(@Req() request: Request, @Body() body: CreateAssetLocationDto) {
    validateCreateAssetLocationPayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.location.create");
    return this.assetsService.createAssetLocation(
      { tenantId, userId },
      body,
      getCorrelationId(request),
    );
  }

  @Get()
  @ApiOperation({ summary: "List asset locations" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiOkResponse({ description: "Paginated asset locations" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.location.read permission" })
  async list(
    @Req() request: Request,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.location.read");
    return this.assetsService.listAssetLocations(
      { tenantId, userId },
      {
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      },
    );
  }

  @Get("all")
  @ApiOperation({ summary: "List all asset locations (unpaginated, for dropdowns)" })
  @ApiOkResponse({ description: "All asset locations" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.location.read permission" })
  async all(@Req() request: Request) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.location.read");
    return this.assetsService.getAllAssetLocations({ tenantId, userId });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an asset location by ID" })
  @ApiOkResponse({ description: "Asset location details" })
  @ApiNotFoundResponse({ description: "Asset location not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.location.read permission" })
  async get(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.location.read");
    return this.assetsService.getAssetLocation({ tenantId, userId }, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update an asset location" })
  @ApiOkResponse({ description: "Asset location updated" })
  @ApiBadRequestResponse({ description: "Invalid payload" })
  @ApiNotFoundResponse({ description: "Asset location not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.location.update permission" })
  async update(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: UpdateAssetLocationDto,
  ) {
    validateUpdateAssetLocationPayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.location.update");
    return this.assetsService.updateAssetLocation(
      { tenantId, userId },
      id,
      body,
      getCorrelationId(request),
    );
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete an asset location" })
  @ApiOkResponse({ description: "Asset location deleted" })
  @ApiConflictResponse({ description: "Location is used by assets" })
  @ApiNotFoundResponse({ description: "Asset location not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.location.delete permission" })
  async remove(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.location.delete");
    return this.assetsService.deleteAssetLocation(
      { tenantId, userId },
      id,
      getCorrelationId(request),
    );
  }
}
