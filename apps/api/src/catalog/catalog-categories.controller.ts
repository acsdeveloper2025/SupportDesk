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
import { CatalogCategoriesService } from "./catalog-categories.service";
import {
  CreateServiceCategoryDto,
  UpdateServiceCategoryDto,
  validateCreateCategoryPayload,
  validateUpdateCategoryPayload,
} from "./dto/category-dtos";

@ApiTags("catalog-categories")
@Controller("api/v1/catalog/categories")
@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
export class CatalogCategoriesController {
  constructor(
    @Inject(CatalogCategoriesService) private readonly categoriesService: CatalogCategoriesService,
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
  @AuthRateLimit("catalog-category-create")
  @ApiOperation({ summary: "Create a new Service Catalog category" })
  @ApiCreatedResponse({ description: "Category successfully created" })
  @ApiBadRequestResponse({ description: "Invalid payload or duplicate slug" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.category.create permission" })
  async createCategory(@Req() request: Request, @Body() body: CreateServiceCategoryDto) {
    validateCreateCategoryPayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "catalog.category.create");
    const correlationId = getCorrelationId(request);

    return this.categoriesService.createCategory(tenantId, body, userId, correlationId);
  }

  @Get()
  @ApiOperation({ summary: "List Service Catalog categories in hierarchy" })
  @ApiQuery({
    name: "parentId",
    required: false,
    description: "Parent category ID (omit for roots)",
  })
  @ApiOkResponse({ description: "Hierarchy of categories with children and service counts" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.category.read permission" })
  async listCategories(@Req() request: Request, @Query("parentId") parentId?: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "catalog.category.read");

    return this.categoriesService.listCategories(tenantId, parentId);
  }

  @Get(":idOrSlug")
  @ApiOperation({ summary: "Get Service Catalog category details by ID or slug" })
  @ApiOkResponse({ description: "Category details" })
  @ApiNotFoundResponse({ description: "Category not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.category.read permission" })
  async getCategory(@Req() request: Request, @Param("idOrSlug") idOrSlug: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "catalog.category.read");

    return this.categoriesService.getCategory(tenantId, idOrSlug);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update Service Catalog category" })
  @ApiOkResponse({ description: "Category successfully updated" })
  @ApiBadRequestResponse({ description: "Invalid payload or name/slug conflict" })
  @ApiNotFoundResponse({ description: "Category not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.category.update permission" })
  async updateCategory(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: UpdateServiceCategoryDto,
  ) {
    validateUpdateCategoryPayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "catalog.category.update");
    const correlationId = getCorrelationId(request);

    return this.categoriesService.updateCategory(tenantId, id, body, userId, correlationId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Service Catalog category" })
  @ApiOkResponse({ description: "Category successfully deleted" })
  @ApiBadRequestResponse({
    description: "Cannot delete category containing subcategories or services",
  })
  @ApiNotFoundResponse({ description: "Category not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.category.delete permission" })
  async deleteCategory(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "catalog.category.delete");
    const correlationId = getCorrelationId(request);

    return this.categoriesService.deleteCategory(tenantId, id, userId, correlationId);
  }
}
