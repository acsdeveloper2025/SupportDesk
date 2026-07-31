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
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request } from "express";

import { AuthAccessTokenGuard } from "../auth/guards/auth-access-token.guard";
import { getAuthenticatedRequestContext } from "../auth/guards/auth-context";
import { AuthRateLimit } from "../auth/rate-limit/auth-rate-limit.guard";
import { CommentsService } from "./comments.service";
import { CommentResponseDto } from "./dto/comment-response.dto";
import { CreateCommentRequestDto, validateCreateCommentPayload } from "./dto/create-comment.dto";
import { CommentListResponseDto, validateListCommentsQuery } from "./dto/list-comments.dto";
import { UpdateCommentRequestDto, validateUpdateCommentPayload } from "./dto/update-comment.dto";

@ApiTags("comments")
@Controller("api/v1")
@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
export class CommentsController {
  constructor(@Inject(CommentsService) private readonly commentsService: CommentsService) {}

  @Post("tickets/:ticketId/comments")
  @AuthRateLimit("comment-create")
  @ApiOperation({ summary: "Create a new comment on a ticket" })
  @ApiCreatedResponse({
    description: "The comment was successfully created",
    type: CommentResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid request body" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid authentication token" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  @ApiNotFoundResponse({ description: "Ticket not found" })
  async createComment(
    @Req() request: Request,
    @Param("ticketId") ticketId: string,
    @Body() body: CreateCommentRequestDto,
  ): Promise<CommentResponseDto> {
    validateCreateCommentPayload(body);
    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }
    const { tenantId, userId } = context;

    const created = await this.commentsService.createComment(tenantId, ticketId, body, userId);
    return CommentResponseDto.fromDomain(created);
  }

  @Get("tickets/:ticketId/comments")
  @ApiOperation({ summary: "List comments for a ticket" })
  @ApiOkResponse({
    description: "Successfully retrieved comments",
    type: CommentListResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid query parameters" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid authentication token" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  @ApiNotFoundResponse({ description: "Ticket not found" })
  async listComments(
    @Req() request: Request,
    @Param("ticketId") ticketId: string,
    @Query() query: unknown,
  ): Promise<CommentListResponseDto> {
    const parsedQuery = validateListCommentsQuery(query);
    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }
    const { tenantId, userId } = context;

    const result = await this.commentsService.listComments(tenantId, ticketId, userId, {
      filters: {
        visibility: parsedQuery.visibility,
        authorUserId: parsedQuery.authorUserId,
        createdAfter: parsedQuery.createdAfter,
        createdBefore: parsedQuery.createdBefore,
      },
      page: parsedQuery.page,
      pageSize: parsedQuery.pageSize,
      sort: {
        direction: parsedQuery.sortDir,
        field: parsedQuery.sortBy,
      },
    });

    const response = new CommentListResponseDto();
    response.items = result.items.map((item) => CommentResponseDto.fromDomain(item));
    response.meta = result.meta;
    response.appliedFilters = {
      authorUserId: parsedQuery.authorUserId,
      createdAfter: parsedQuery.createdAfter,
      createdBefore: parsedQuery.createdBefore,
      visibility: parsedQuery.visibility,
    };
    response.sort = {
      direction: parsedQuery.sortDir,
      field: parsedQuery.sortBy,
    };

    return response;
  }

  @Get("comments/:commentId")
  @ApiOperation({ summary: "Get a specific comment by ID" })
  @ApiOkResponse({
    description: "Successfully retrieved the comment",
    type: CommentResponseDto,
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid authentication token" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  @ApiNotFoundResponse({ description: "Comment not found" })
  async getComment(
    @Req() request: Request,
    @Param("commentId") commentId: string,
  ): Promise<CommentResponseDto> {
    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }
    const { tenantId, userId } = context;
    const comment = await this.commentsService.getComment(tenantId, commentId, userId);
    return CommentResponseDto.fromDomain(comment);
  }

  @Patch("comments/:commentId")
  @ApiOperation({ summary: "Update an existing comment" })
  @ApiOkResponse({
    description: "The comment was successfully updated",
    type: CommentResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid request body or edit window expired" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid authentication token" })
  @ApiForbiddenResponse({ description: "Insufficient permissions or not the author" })
  @ApiNotFoundResponse({ description: "Comment not found" })
  @ApiConflictResponse({ description: "Optimistic concurrency conflict" })
  async updateComment(
    @Req() request: Request,
    @Param("commentId") commentId: string,
    @Body() body: UpdateCommentRequestDto,
  ): Promise<CommentResponseDto> {
    validateUpdateCommentPayload(body);
    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }
    const { tenantId, userId } = context;

    const updated = await this.commentsService.updateComment(tenantId, commentId, body, userId);
    return CommentResponseDto.fromDomain(updated);
  }

  @Delete("comments/:commentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft delete a comment" })
  @ApiOkResponse({ description: "The comment was successfully deleted" })
  @ApiBadRequestResponse({ description: "Invalid request or edit window expired" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid authentication token" })
  @ApiForbiddenResponse({ description: "Insufficient permissions or not the author" })
  @ApiNotFoundResponse({ description: "Comment not found" })
  @ApiConflictResponse({ description: "Optimistic concurrency conflict" })
  async deleteComment(
    @Req() request: Request,
    @Param("commentId") commentId: string,
    @Body("expectedVersion") expectedVersion: number,
    @Body("reason") reason: string,
  ): Promise<void> {
    if (typeof expectedVersion !== "number" || expectedVersion < 1) {
      throw new BadRequestException("expectedVersion is required and must be a positive integer");
    }
    const context = getAuthenticatedRequestContext(request);
    if (!context) {
      throw new UnauthorizedException();
    }
    const { tenantId, userId } = context;
    await this.commentsService.softDeleteComment(
      tenantId,
      commentId,
      expectedVersion,
      reason || "Deleted by user",
      userId,
    );
  }
}
