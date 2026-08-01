import {
  BadRequestException,
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
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
import { memoryStorage } from "multer";

import { AuthAccessTokenGuard } from "../auth/guards/auth-access-token.guard";
import { getAuthenticatedRequestContext } from "../auth/guards/auth-context";
import { AuthRateLimit } from "../auth/rate-limit/auth-rate-limit.guard";
import { getCorrelationId } from "../common/logging/correlation-id";
import { RbacService } from "../rbac/rbac.service";
import { ATTACHMENT_MAX_FILE_SIZE_BYTES } from "../ticketing/attachments/attachment-validation";
import { CatalogRequestsService } from "./catalog-requests.service";
import {
  CancelServiceRequestDto,
  CompleteServiceRequestDto,
  CreateServiceRequestDto,
  DecideApprovalDto,
  UpdateServiceRequestAnswersDto,
  validateCancelPayload,
  validateCompletePayload,
  validateCreateRequestPayload,
  validateDecideApprovalPayload,
  validateUpdateAnswersPayload,
} from "./dto/request-dtos";

@ApiTags("catalog-requests")
@Controller("api/v1/catalog/requests")
@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
export class CatalogRequestsController {
  constructor(
    @Inject(CatalogRequestsService) private readonly requestsService: CatalogRequestsService,
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
  @AuthRateLimit("catalog-request-create")
  @ApiOperation({ summary: "Submit a new service request" })
  @ApiCreatedResponse({ description: "Service request successfully submitted" })
  @ApiBadRequestResponse({
    description: "Invalid payload, form validation failure, or service not published",
  })
  @ApiNotFoundResponse({ description: "Service or template not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.request.create permission" })
  async submit(@Req() request: Request, @Body() body: CreateServiceRequestDto) {
    validateCreateRequestPayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "catalog.request.create");
    const correlationId = getCorrelationId(request);

    return this.requestsService.submit({ tenantId, userId }, body, correlationId);
  }

  @Get()
  @ApiOperation({ summary: "List service requests" })
  @ApiQuery({
    name: "scope",
    required: false,
    enum: ["own", "all"],
    description: "own (default) or all requests",
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({
    name: "status",
    required: false,
    enum: [
      "SUBMITTED",
      "AWAITING_APPROVAL",
      "APPROVED",
      "CHANGES_REQUESTED",
      "REJECTED",
      "IN_FULFILLMENT",
      "COMPLETED",
      "CANCELLED",
    ],
  })
  @ApiOkResponse({ description: "Paginated list of service requests" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({
    description: "Requires catalog.request.read or catalog.request.read_all permission",
  })
  async listRequests(
    @Req() request: Request,
    @Query("scope") scope?: "own" | "all",
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("status") status?: string,
  ) {
    const { tenantId, userId } = this.requireAuth(request);
    const pageNumber = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
    const pageSizeNumber = Math.min(100, Math.max(1, Number.parseInt(pageSize ?? "20", 10) || 20));

    return this.requestsService.listRequests(
      { tenantId, userId },
      scope === "all" ? "all" : "own",
      { page: pageNumber, pageSize: pageSizeNumber, status: status as never },
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get service request details" })
  @ApiOkResponse({
    description: "Service request with service, ticket, approvals, and attachments",
  })
  @ApiNotFoundResponse({ description: "Service request not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({
    description: "Requires catalog.request.read or catalog.request.read_all permission",
  })
  async getRequest(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "catalog.request.read");

    return this.requestsService.getRequest({ tenantId, userId }, id);
  }

  @Get(":id/history")
  @ApiOperation({ summary: "Get service request history" })
  @ApiOkResponse({ description: "Ordered list of history events" })
  @ApiNotFoundResponse({ description: "Service request not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({
    description: "Requires catalog.request.read or catalog.request.read_all permission",
  })
  async getHistory(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);

    return this.requestsService.listHistory({ tenantId, userId }, id);
  }

  @Get(":id/approvals")
  @ApiOperation({ summary: "List approval steps of a service request" })
  @ApiOkResponse({ description: "Approval steps with decisions" })
  @ApiNotFoundResponse({ description: "Service request not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({
    description: "Requires catalog.request.read or catalog.request.read_all permission",
  })
  async getApprovals(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);

    return this.requestsService.listApprovals({ tenantId, userId }, id);
  }

  @Patch(":id/answers")
  @ApiOperation({ summary: "Update answers of a SUBMITTED or CHANGES_REQUESTED request" })
  @ApiOkResponse({ description: "Updated service request" })
  @ApiBadRequestResponse({ description: "Invalid answers or form validation failure" })
  @ApiConflictResponse({ description: "Request is not in an editable status" })
  @ApiNotFoundResponse({ description: "Service request not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.request.update permission" })
  async updateAnswers(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: UpdateServiceRequestAnswersDto,
  ) {
    validateUpdateAnswersPayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    const correlationId = getCorrelationId(request);

    return this.requestsService.updateAnswers({ tenantId, userId }, id, body, correlationId);
  }

  @Patch(":id/cancel")
  @ApiOperation({ summary: "Cancel a service request" })
  @ApiOkResponse({ description: "Cancelled service request" })
  @ApiConflictResponse({ description: "Request is in a terminal or fulfilled status" })
  @ApiNotFoundResponse({ description: "Service request not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.request.cancel permission" })
  async cancelRequest(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: CancelServiceRequestDto,
  ) {
    validateCancelPayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    const correlationId = getCorrelationId(request);

    return this.requestsService.cancel({ tenantId, userId }, id, body, correlationId);
  }

  @Post(":id/approvals/:approvalId/decide")
  @ApiOperation({ summary: "Decide an approval step" })
  @ApiOkResponse({ description: "Updated service request after the decision" })
  @ApiBadRequestResponse({ description: "Invalid decision payload" })
  @ApiConflictResponse({ description: "Step already decided or request not awaiting approval" })
  @ApiNotFoundResponse({ description: "Request or approval step not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.approval.decide permission" })
  async decideApproval(
    @Req() request: Request,
    @Param("id") id: string,
    @Param("approvalId") approvalId: string,
    @Body() body: DecideApprovalDto,
  ) {
    validateDecideApprovalPayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "catalog.approval.decide");
    const correlationId = getCorrelationId(request);

    return this.requestsService.decideApproval(
      { tenantId, userId },
      id,
      approvalId,
      body,
      correlationId,
    );
  }

  @Post(":id/fulfillment")
  @ApiOperation({
    summary: "Start fulfillment of an approved request (auto-generates a ticket if configured)",
  })
  @ApiOkResponse({ description: "Service request moved to IN_FULFILLMENT" })
  @ApiConflictResponse({
    description: "Request is not in an approvable state or approval gate not satisfied",
  })
  @ApiNotFoundResponse({ description: "Service request not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.request.fulfill permission" })
  async startFulfillment(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "catalog.request.fulfill");
    const correlationId = getCorrelationId(request);

    return this.requestsService.startFulfillment({ tenantId, userId }, id, correlationId);
  }

  @Post(":id/ticket")
  @ApiOperation({ summary: "Generate the support ticket for a request" })
  @ApiOkResponse({ description: "Service request with the generated ticket" })
  @ApiConflictResponse({ description: "Approval gate not satisfied or request in terminal status" })
  @ApiNotFoundResponse({ description: "Service request not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.request.generate_ticket permission" })
  async generateTicket(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "catalog.request.generate_ticket");
    const correlationId = getCorrelationId(request);

    return this.requestsService.generateTicket({ tenantId, userId }, id, correlationId);
  }

  @Post(":id/complete")
  @ApiOperation({ summary: "Complete a request in fulfillment" })
  @ApiOkResponse({ description: "Completed service request" })
  @ApiConflictResponse({ description: "Request is not in fulfillment" })
  @ApiNotFoundResponse({ description: "Service request not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.request.complete permission" })
  async complete(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: CompleteServiceRequestDto | undefined,
  ) {
    validateCompletePayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    const correlationId = getCorrelationId(request);

    return this.requestsService.complete({ tenantId, userId }, id, body?.note, correlationId);
  }

  @Get(":id/attachments")
  @ApiOperation({ summary: "List attachments of a service request" })
  @ApiOkResponse({ description: "Attachments" })
  @ApiNotFoundResponse({ description: "Service request not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({
    description: "Requires catalog.request.read or catalog.request.read_all permission",
  })
  async listAttachments(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);

    return this.requestsService.listAttachments({ tenantId, userId }, id);
  }

  @Put(":id/attachments")
  @AuthRateLimit("catalog-request-attachment-upload")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: ATTACHMENT_MAX_FILE_SIZE_BYTES },
      storage: memoryStorage(),
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      properties: {
        file: {
          format: "binary",
          type: "string",
        },
      },
      required: ["file"],
      type: "object",
    },
  })
  @ApiOperation({ summary: "Upload an attachment to a service request" })
  @ApiOkResponse({ description: "Created attachment" })
  @ApiBadRequestResponse({ description: "Invalid file type, size, or too many attachments" })
  @ApiNotFoundResponse({ description: "Service request not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.request.attachment.create permission" })
  async uploadAttachment(
    @Req() request: Request,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException("File is required");
    }
    const { tenantId, userId } = this.requireAuth(request);
    const correlationId = getCorrelationId(request);

    return this.requestsService.uploadAttachment(
      { tenantId, userId },
      id,
      {
        buffer: file.buffer,
        mimeType: file.mimetype,
        originalFilename: file.originalname,
        size: file.size,
      },
      correlationId,
    );
  }

  @Delete(":id/attachments/:attachmentId")
  @ApiOperation({ summary: "Delete an attachment of a service request" })
  @ApiOkResponse({ description: "Attachment removed" })
  @ApiNotFoundResponse({ description: "Attachment not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires catalog.request.attachment.delete permission" })
  async deleteAttachment(
    @Req() request: Request,
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string,
  ) {
    const { tenantId, userId } = this.requireAuth(request);
    const correlationId = getCorrelationId(request);

    return this.requestsService.deleteAttachment(
      { tenantId, userId },
      id,
      attachmentId,
      correlationId,
    );
  }
}
