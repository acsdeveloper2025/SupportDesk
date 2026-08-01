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
  Put,
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
import { CatalogServicesService } from "./catalog-services.service";
import {
  CreateServiceItemDto,
  UpdateServiceItemDto,
  validateCreateServicePayload,
  validateUpdateServicePayload,
} from "./dto/service-dtos";

@ApiTags("catalog-services")
@Controller("api/v1/catalog/services")
@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
export class CatalogServicesController {
  constructor(
    @Inject(CatalogServicesService) private readonly servicesService: CatalogServicesService,
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
  @AuthRateLimit("catalog-service-create")
  @ApiOperation({ summary: "Create a new Service Catalog service" })
  @ApiCreatedResponse({ description: "Service successfully created with its request form" })
  @ApiBadRequestResponse({
    description: "Invalid payload, duplicate slug, or unknown category/SLA policy",
  })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.service.create permission" })
  async createService(@Req() request: Request, @Body() body: CreateServiceItemDto) {
    validateCreateServicePayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "catalog.service.create");
    const correlationId = getCorrelationId(request);

    return this.servicesService.createService(tenantId, body, userId, correlationId);
  }

  @Get()
  @ApiOperation({ summary: "List Service Catalog services" })
  @ApiQuery({ name: "page", required: false, type: Number, description: "Page number (1-based)" })
  @ApiQuery({ name: "pageSize", required: false, type: Number, description: "Page size" })
  @ApiQuery({ name: "kind", required: false, enum: ["BUSINESS", "TECHNICAL"] })
  @ApiQuery({ name: "categoryId", required: false })
  @ApiQuery({ name: "state", required: false, enum: ["DRAFT", "PUBLISHED", "RETIRED"] })
  @ApiOkResponse({ description: "Paginated list of services" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.service.read permission" })
  async listServices(
    @Req() request: Request,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("kind") kind?: "BUSINESS" | "TECHNICAL",
    @Query("categoryId") categoryId?: string,
    @Query("state") state?: "DRAFT" | "PUBLISHED" | "RETIRED",
  ) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "catalog.service.read");
    const pageNumber = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
    const pageSizeNumber = Math.min(100, Math.max(1, Number.parseInt(pageSize ?? "20", 10) || 20));

    return this.servicesService.listServices(tenantId, {
      page: pageNumber,
      pageSize: pageSizeNumber,
      kind,
      categoryId,
      state,
    });
  }

  @Get("published")
  @ApiOperation({ summary: "List published services for the request catalog" })
  @ApiOkResponse({ description: "Published services with forms" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.service.read permission" })
  async listPublished(@Req() request: Request) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "catalog.service.read");

    return this.servicesService.listPublishedServices(tenantId);
  }

  @Get(":idOrSlug")
  @ApiOperation({ summary: "Get Service Catalog service details by ID or slug" })
  @ApiOkResponse({ description: "Service details including form and approval steps" })
  @ApiNotFoundResponse({ description: "Service not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.service.read permission" })
  async getService(@Req() request: Request, @Param("idOrSlug") idOrSlug: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "catalog.service.read");

    return this.servicesService.getService(tenantId, idOrSlug);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update Service Catalog service" })
  @ApiOkResponse({ description: "Service successfully updated" })
  @ApiBadRequestResponse({ description: "Invalid payload or name/slug conflict" })
  @ApiNotFoundResponse({ description: "Service not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.service.update permission" })
  async updateService(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: UpdateServiceItemDto,
  ) {
    validateUpdateServicePayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "catalog.service.update");
    const correlationId = getCorrelationId(request);

    return this.servicesService.updateService(tenantId, id, body, userId, correlationId);
  }

  @Post(":id/publish")
  @ApiOperation({ summary: "Publish a service to the request catalog" })
  @ApiOkResponse({ description: "Service successfully published" })
  @ApiBadRequestResponse({ description: "Service already published or missing a request form" })
  @ApiNotFoundResponse({ description: "Service not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.service.publish permission" })
  async publishService(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "catalog.service.publish");
    const correlationId = getCorrelationId(request);

    return this.servicesService.publishService(tenantId, id, userId, correlationId, "PUBLISHED");
  }

  @Post(":id/retire")
  @ApiOperation({ summary: "Retire a published service" })
  @ApiOkResponse({ description: "Service successfully retired" })
  @ApiBadRequestResponse({ description: "Service already retired" })
  @ApiNotFoundResponse({ description: "Service not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.service.retire permission" })
  async retireService(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "catalog.service.retire");
    const correlationId = getCorrelationId(request);

    return this.servicesService.publishService(tenantId, id, userId, correlationId, "RETIRED");
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a Service Catalog service" })
  @ApiOkResponse({ description: "Service successfully deleted" })
  @ApiBadRequestResponse({ description: "Cannot delete a service with submitted requests" })
  @ApiNotFoundResponse({ description: "Service not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.service.delete permission" })
  async deleteService(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "catalog.service.delete");
    const correlationId = getCorrelationId(request);

    return this.servicesService.deleteService(tenantId, id, userId, correlationId);
  }

  @Get(":id/form")
  @ApiOperation({ summary: "Get the request form schema of a service" })
  @ApiOkResponse({ description: "Request form with schema and version" })
  @ApiNotFoundResponse({ description: "Service or form not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.form.read permission" })
  async getForm(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "catalog.form.read");

    return this.servicesService.getForm(tenantId, id);
  }

  @Put(":id/form")
  @ApiOperation({ summary: "Replace the request form schema of a service (bumps form version)" })
  @ApiOkResponse({ description: "Updated request form" })
  @ApiBadRequestResponse({ description: "Invalid form schema or retired service" })
  @ApiNotFoundResponse({ description: "Service not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.form.update permission" })
  async replaceForm(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: { fields: Array<Record<string, unknown>> },
  ) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "catalog.form.update");
    const correlationId = getCorrelationId(request);

    return this.servicesService.replaceForm(tenantId, id, body, userId, correlationId);
  }

  @Get(":id/suggestions")
  @ApiOperation({ summary: "Get Knowledge Base article suggestions for a service" })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Max suggestions (default 5)",
  })
  @ApiOkResponse({ description: "Suggested Knowledge Base articles" })
  @ApiNotFoundResponse({ description: "Service not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.service.read permission" })
  async suggestions(
    @Req() request: Request,
    @Param("id") id: string,
    @Query("limit") limit?: string,
  ) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "catalog.service.read");
    const limitNumber = Math.min(10, Math.max(1, Number.parseInt(limit ?? "5", 10) || 5));

    return this.servicesService.suggestions(tenantId, id, true, limitNumber);
  }
}
