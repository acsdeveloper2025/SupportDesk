import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  StreamableFile,
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
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import type { Request } from "express";
import { memoryStorage } from "multer";

import { AuthAccessTokenGuard } from "../../auth/guards/auth-access-token.guard";
import { getAuthenticatedRequestContext } from "../../auth/guards/auth-context";
import { AuthRateLimit } from "../../auth/rate-limit/auth-rate-limit.guard";
import { getCorrelationId } from "../../common/logging/correlation-id";
import {
  AttachmentListResponseDto,
  AttachmentResponseDto,
  DeleteAttachmentRequestDto,
} from "../dto/attachment-response.dto";
import { ATTACHMENT_MAX_FILE_SIZE_BYTES } from "./attachment-validation";
import { AttachmentsService } from "./attachments.service";

@ApiTags("attachments")
@Controller("api/v1")
@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
export class AttachmentsController {
  constructor(
    @Inject(AttachmentsService) private readonly attachmentsService: AttachmentsService,
  ) {}

  @Post("tickets/:ticketId/attachments")
  @AuthRateLimit("attachment-upload")
  @HttpCode(HttpStatus.CREATED)
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
  @ApiOperation({
    description:
      "Upload a ticket attachment to local filesystem storage with metadata persistence.",
    summary: "Upload ticket attachment",
  })
  @ApiCreatedResponse({ description: "Attachment uploaded.", type: AttachmentResponseDto })
  @ApiBadRequestResponse({ description: "Invalid or disallowed upload." })
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  @ApiForbiddenResponse({ description: "Missing ticket.attachment.create permission." })
  @ApiNotFoundResponse({ description: "Ticket not found." })
  @ApiConflictResponse({ description: "Duplicate attachment content." })
  @ApiUnprocessableEntityResponse({ description: "Attachment failed virus scan." })
  async uploadAttachment(
    @Param("ticketId") ticketId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: Request,
  ): Promise<AttachmentResponseDto> {
    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }
    if (!file) {
      throw new BadRequestException("File is required");
    }

    const created = await this.attachmentsService.upload({
      actorUserId: context.userId,
      buffer: file.buffer,
      correlationId: getCorrelationId(request),
      ipAddress: request.ip,
      mimeType: file.mimetype,
      originalFilename: file.originalname,
      size: file.size,
      tenantId: context.tenantId,
      ticketId,
      userAgent: request.header("user-agent") ?? undefined,
    });

    return AttachmentResponseDto.fromDomain(created);
  }

  @Get("tickets/:ticketId/attachments")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description: "List non-deleted attachments for a ticket.",
    summary: "List ticket attachments",
  })
  @ApiOkResponse({ description: "Attachment list.", type: AttachmentListResponseDto })
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  @ApiForbiddenResponse({ description: "Missing ticket.attachment.read permission." })
  @ApiNotFoundResponse({ description: "Ticket not found." })
  async listAttachments(
    @Param("ticketId") ticketId: string,
    @Req() request: Request,
  ): Promise<AttachmentListResponseDto> {
    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }

    const items = await this.attachmentsService.list(context.tenantId, ticketId, context.userId);
    return {
      items: items.map((item) => AttachmentResponseDto.fromDomain(item)),
    };
  }

  @Get("attachments/:attachmentId")
  @HttpCode(HttpStatus.OK)
  @ApiProduces("application/octet-stream")
  @ApiOperation({
    description: "Download an attachment file through an authenticated, authorized API stream.",
    summary: "Download attachment",
  })
  @ApiOkResponse({ description: "Attachment binary stream." })
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  @ApiForbiddenResponse({ description: "Missing ticket.attachment.read permission." })
  @ApiNotFoundResponse({ description: "Attachment not found." })
  @ApiUnprocessableEntityResponse({ description: "Attachment is not clean." })
  async downloadAttachment(
    @Param("attachmentId") attachmentId: string,
    @Req() request: Request,
  ): Promise<StreamableFile> {
    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }

    const { entity, stream } = await this.attachmentsService.getDownload(
      context.tenantId,
      attachmentId,
      context.userId,
    );

    return new StreamableFile(stream, {
      disposition: `attachment; filename="${entity.originalFilename.replaceAll('"', "")}"`,
      length: entity.fileSize,
      type: entity.mimeType,
    });
  }

  @Delete("attachments/:attachmentId")
  @AuthRateLimit("attachment-delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    description: "Soft-delete an attachment and record an audit timeline event.",
    summary: "Delete attachment",
  })
  @ApiOkResponse({ description: "Attachment soft-deleted." })
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  @ApiForbiddenResponse({ description: "Missing ticket.attachment.delete permission." })
  @ApiNotFoundResponse({ description: "Attachment not found." })
  async deleteAttachment(
    @Param("attachmentId") attachmentId: string,
    @Body() body: DeleteAttachmentRequestDto,
    @Req() request: Request,
  ): Promise<void> {
    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }

    await this.attachmentsService.softDelete(
      context.tenantId,
      attachmentId,
      context.userId,
      body?.reason,
    );
  }
}
