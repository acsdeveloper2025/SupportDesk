import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request, Response } from "express";

import { AuthAccessTokenGuard } from "../auth/guards/auth-access-token.guard";
import { getAuthenticatedRequestContext } from "../auth/guards/auth-context";
import { AuthRateLimit } from "../auth/rate-limit/auth-rate-limit.guard";
import { getCorrelationId } from "../common/logging/correlation-id";
import { RbacService } from "../rbac/rbac.service";
import { AssetAttachmentsService } from "./asset-attachments.service";
import { ASSET_ATTACHMENT_KIND_VALUES } from "./dto/asset-dtos";

interface UploadedFileShape {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags("asset-attachments")
@Controller("api/v1/assets/:assetId/attachments")
@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
export class AssetAttachmentsController {
  constructor(
    @Inject(AssetAttachmentsService)
    private readonly attachmentsService: AssetAttachmentsService,
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
  @AuthRateLimit("asset-attachment-upload")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload an attachment (photo, invoice, manual, warranty, other)" })
  @ApiCreatedResponse({ description: "Attachment uploaded and virus-scanned" })
  @ApiBadRequestResponse({ description: "Invalid file, oversized upload, or too many attachments" })
  @ApiNotFoundResponse({ description: "Asset not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.attachment.create permission" })
  async upload(
    @Req() request: Request,
    @Param("assetId") assetId: string,
    @UploadedFile() file: UploadedFileShape | undefined,
    @Body("kind") kind?: string,
  ) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.attachment.create");
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    const attachmentKind: (typeof ASSET_ATTACHMENT_KIND_VALUES)[number] =
      kind &&
      ASSET_ATTACHMENT_KIND_VALUES.includes(kind as (typeof ASSET_ATTACHMENT_KIND_VALUES)[number])
        ? (kind as (typeof ASSET_ATTACHMENT_KIND_VALUES)[number])
        : "OTHER";
    return this.attachmentsService.upload({
      tenantId,
      assetId,
      actorUserId: userId,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      buffer: file.buffer,
      kind: attachmentKind,
      correlationId: getCorrelationId(request),
    });
  }

  @Get()
  @ApiOperation({ summary: "List attachments for an asset" })
  @ApiOkResponse({ description: "Asset attachments" })
  @ApiNotFoundResponse({ description: "Asset not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.attachment.read permission" })
  async list(@Req() request: Request, @Param("assetId") assetId: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.attachment.read");
    return this.attachmentsService.list(tenantId, assetId);
  }

  @Get(":attachmentId/download")
  @ApiOperation({ summary: "Download an asset attachment" })
  @ApiOkResponse({ description: "Attachment binary stream" })
  @ApiNotFoundResponse({ description: "Attachment not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.attachment.read permission" })
  async download(
    @Req() request: Request,
    @Res() response: Response,
    @Param("assetId") assetId: string,
    @Param("attachmentId") attachmentId: string,
  ) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.attachment.read");
    const { attachment, stream } = await this.attachmentsService.getDownload(
      tenantId,
      attachmentId,
    );
    response.setHeader("Content-Type", attachment.mimeType);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${attachment.originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
    );
    response.setHeader("Content-Length", Number(attachment.sizeBytes).toString());
    return new Promise<void>((resolve, reject) => {
      stream.on("error", reject);
      stream.on("end", () => resolve());
      stream.pipe(response);
    });
  }

  @Delete(":attachmentId")
  @ApiOperation({ summary: "Delete an asset attachment" })
  @ApiOkResponse({ description: "Attachment deleted" })
  @ApiNotFoundResponse({ description: "Attachment not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires asset.attachment.delete permission" })
  async remove(
    @Req() request: Request,
    @Param("assetId") assetId: string,
    @Param("attachmentId") attachmentId: string,
  ) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.checkPermission(tenantId, userId, "asset.attachment.delete");
    await this.attachmentsService.softDelete(tenantId, attachmentId, userId);
  }
}
