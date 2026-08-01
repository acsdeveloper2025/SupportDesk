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
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request } from "express";

import { AuthAccessTokenGuard } from "../auth/guards/auth-access-token.guard";
import { getAuthenticatedRequestContext } from "../auth/guards/auth-context";
import { AuthRateLimit } from "../auth/rate-limit/auth-rate-limit.guard";
import { getCorrelationId } from "../common/logging/correlation-id";
import { RbacService } from "../rbac/rbac.service";
import {
  CreateKbCategoryDto,
  UpdateKbCategoryDto,
  validateCreateCategoryPayload,
  validateUpdateCategoryPayload,
} from "./dto/category-dtos";
import { KbCategoriesService } from "./kb-categories.service";

@ApiTags("kb-categories")
@Controller("api/v1/kb/categories")
@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
export class KbCategoriesController {
  constructor(
    @Inject(KbCategoriesService) private readonly categoriesService: KbCategoriesService,
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
  @AuthRateLimit("kb-category-create")
  @ApiOperation({ summary: "Create a new Knowledge Base category" })
  @ApiCreatedResponse({ description: "Category successfully created" })
  @ApiBadRequestResponse({ description: "Invalid payload or duplicate slug" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires kb.category.create permission" })
  async createCategory(@Req() request: Request, @Body() body: CreateKbCategoryDto) {
    validateCreateCategoryPayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "kb.category.create");
    const correlationId = getCorrelationId(request);

    return this.categoriesService.createCategory(tenantId, body, userId, correlationId);
  }

  @Get()
  @ApiOperation({ summary: "List Knowledge Base categories in hierarchy" })
  @ApiOkResponse({ description: "Hierarchy of categories with children and article counts" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires kb.category.read permission" })
  async listCategories(@Req() request: Request) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "kb.category.read");

    return this.categoriesService.listCategories(tenantId);
  }

  @Get(":idOrSlug")
  @ApiOperation({ summary: "Get Knowledge Base category details by ID or slug" })
  @ApiOkResponse({ description: "Category details" })
  @ApiNotFoundResponse({ description: "Category not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires kb.category.read permission" })
  async getCategory(@Req() request: Request, @Param("idOrSlug") idOrSlug: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "kb.category.read");

    return this.categoriesService.getCategory(tenantId, idOrSlug);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update Knowledge Base category" })
  @ApiOkResponse({ description: "Category successfully updated" })
  @ApiBadRequestResponse({ description: "Invalid payload or name/slug conflict" })
  @ApiNotFoundResponse({ description: "Category not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires kb.category.update permission" })
  async updateCategory(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: UpdateKbCategoryDto,
  ) {
    validateUpdateCategoryPayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "kb.category.update");
    const correlationId = getCorrelationId(request);

    return this.categoriesService.updateCategory(tenantId, id, body, userId, correlationId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Knowledge Base category" })
  @ApiOkResponse({ description: "Category successfully deleted" })
  @ApiBadRequestResponse({
    description: "Cannot delete category containing subcategories or articles",
  })
  @ApiNotFoundResponse({ description: "Category not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires kb.category.delete permission" })
  async deleteCategory(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "kb.category.delete");
    const correlationId = getCorrelationId(request);

    return this.categoriesService.deleteCategory(tenantId, id, userId, correlationId);
  }
}
