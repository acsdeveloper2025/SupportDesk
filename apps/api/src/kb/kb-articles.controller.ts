import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
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
  CreateKbArticleDto,
  KbFeedbackDto,
  LinkKbTicketDto,
  ListKbArticlesQueryDto,
  SearchKbArticlesQueryDto,
  UpdateKbArticleDto,
  validateCreateArticlePayload,
  validateFeedbackPayload,
  validateLinkTicketPayload,
  validateUpdateArticlePayload,
} from "./dto/article-dtos";
import { KbArticlesService } from "./kb-articles.service";
import { KB_SEARCH_QUERY_MAX_LENGTH } from "./kb-search.builder";

@ApiTags("kb-articles")
@Controller("api/v1/kb/articles")
@UseGuards(AuthAccessTokenGuard)
@ApiBearerAuth()
export class KbArticlesController {
  constructor(
    @Inject(KbArticlesService) private readonly articlesService: KbArticlesService,
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
  ): Promise<boolean> {
    return this.rbacService.can({ permissionKey, tenantId, userId });
  }

  private async requirePermission(
    tenantId: string,
    userId: string,
    permissionKey: string,
  ): Promise<void> {
    const allowed = await this.checkPermission(tenantId, userId, permissionKey);
    if (!allowed) {
      throw new ForbiddenException(`Missing required permission: ${permissionKey}`);
    }
  }

  @Post()
  @AuthRateLimit("kb-article-create")
  @ApiOperation({ summary: "Create a new Knowledge Base article draft" })
  @ApiCreatedResponse({ description: "Article draft successfully created" })
  @ApiBadRequestResponse({ description: "Invalid request payload or duplicate slug" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires kb.article.create permission" })
  async createArticle(@Req() request: Request, @Body() body: CreateKbArticleDto) {
    validateCreateArticlePayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.requirePermission(tenantId, userId, "kb.article.create");
    const correlationId = getCorrelationId(request);

    return this.articlesService.createArticle(tenantId, userId, body, correlationId);
  }

  @Get()
  @ApiOperation({ summary: "List Knowledge Base articles with filtering" })
  @ApiOkResponse({ description: "List of articles and total count" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires kb.article.read permission" })
  async listArticles(@Req() request: Request, @Query() query: ListKbArticlesQueryDto) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.requirePermission(tenantId, userId, "kb.article.read");
    const canReadInternal = await this.checkPermission(
      tenantId,
      userId,
      "kb.article.read_internal",
    );

    return this.articlesService.listArticles(tenantId, query, canReadInternal);
  }

  @Get("search")
  @ApiOperation({ summary: "Search Knowledge Base articles" })
  @ApiOkResponse({ description: "Search results matching query" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires kb.article.read permission" })
  async searchArticles(@Req() request: Request, @Query() query: SearchKbArticlesQueryDto) {
    const { tenantId, userId } = this.requireAuth(request);
    if (query.q && query.q.length > KB_SEARCH_QUERY_MAX_LENGTH) {
      throw new BadRequestException(
        `Search query cannot exceed ${KB_SEARCH_QUERY_MAX_LENGTH} characters`,
      );
    }
    await this.requirePermission(tenantId, userId, "kb.article.read");
    const canReadInternal = await this.checkPermission(
      tenantId,
      userId,
      "kb.article.read_internal",
    );

    return this.articlesService.searchArticles(tenantId, query, canReadInternal);
  }

  @Get(":idOrSlug")
  @ApiOperation({ summary: "Get Knowledge Base article details by ID or slug" })
  @ApiOkResponse({ description: "Article details" })
  @ApiNotFoundResponse({ description: "Article not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires kb.article.read permission" })
  async getArticle(@Req() request: Request, @Param("idOrSlug") idOrSlug: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.requirePermission(tenantId, userId, "kb.article.read");
    const canReadInternal = await this.checkPermission(
      tenantId,
      userId,
      "kb.article.read_internal",
    );

    return this.articlesService.getArticle(tenantId, idOrSlug, canReadInternal);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update Knowledge Base article" })
  @ApiOkResponse({ description: "Article successfully updated" })
  @ApiBadRequestResponse({ description: "Invalid payload or slug conflict" })
  @ApiNotFoundResponse({ description: "Article not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires kb.article.update permission" })
  async updateArticle(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: UpdateKbArticleDto,
  ) {
    validateUpdateArticlePayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.requirePermission(tenantId, userId, "kb.article.update");
    const correlationId = getCorrelationId(request);

    return this.articlesService.updateArticle(tenantId, id, body, userId, correlationId);
  }

  @Post(":id/publish")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Publish Knowledge Base article and create new version" })
  @ApiOkResponse({ description: "Article published and version incremented" })
  @ApiNotFoundResponse({ description: "Article not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires kb.article.publish permission" })
  async publishArticle(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.requirePermission(tenantId, userId, "kb.article.publish");
    const correlationId = getCorrelationId(request);

    return this.articlesService.publishArticle(tenantId, id, userId, correlationId);
  }

  @Post(":id/archive")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Archive Knowledge Base article" })
  @ApiOkResponse({ description: "Article archived" })
  @ApiNotFoundResponse({ description: "Article not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires kb.article.archive permission" })
  async archiveArticle(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.requirePermission(tenantId, userId, "kb.article.archive");
    const correlationId = getCorrelationId(request);

    return this.articlesService.archiveArticle(tenantId, id, userId, correlationId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Knowledge Base article" })
  @ApiOkResponse({ description: "Article deleted" })
  @ApiNotFoundResponse({ description: "Article not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Requires kb.article.delete permission" })
  async deleteArticle(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.requirePermission(tenantId, userId, "kb.article.delete");
    const correlationId = getCorrelationId(request);

    return this.articlesService.deleteArticle(tenantId, id, userId, correlationId);
  }

  @Post(":id/feedback")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Record helpful/unhelpful feedback for an article" })
  @ApiNoContentResponse({ description: "Feedback recorded" })
  @ApiNotFoundResponse({ description: "Article not found" })
  async recordFeedback(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: KbFeedbackDto,
  ) {
    validateFeedbackPayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.requirePermission(tenantId, userId, "kb.article.read");

    await this.articlesService.recordFeedback(tenantId, id, body);
  }

  @Get(":id/versions")
  @ApiOperation({ summary: "List historical versions of an article" })
  @ApiOkResponse({ description: "List of historical article versions" })
  @ApiNotFoundResponse({ description: "Article not found" })
  async getVersions(@Req() request: Request, @Param("id") id: string) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.requirePermission(tenantId, userId, "kb.article.read");

    return this.articlesService.getVersions(tenantId, id);
  }

  @Get(":id/versions/:versionNumber")
  @ApiOperation({ summary: "Get specific historical version snapshot" })
  @ApiOkResponse({ description: "Historical version snapshot" })
  @ApiNotFoundResponse({ description: "Version not found" })
  async getVersion(
    @Req() request: Request,
    @Param("id") id: string,
    @Param("versionNumber") versionNumberStr: string,
  ) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.requirePermission(tenantId, userId, "kb.article.read");
    const versionNumber = Number.parseInt(versionNumberStr, 10);
    if (Number.isNaN(versionNumber)) {
      throw new BadRequestException("versionNumber must be an integer");
    }

    return this.articlesService.getVersion(tenantId, id, versionNumber);
  }

  @Post(":id/links/tickets")
  @ApiOperation({ summary: "Link Knowledge Base article to a ticket" })
  @ApiCreatedResponse({ description: "Ticket link created" })
  @ApiNotFoundResponse({ description: "Article or Ticket not found" })
  @ApiForbiddenResponse({ description: "Requires kb.article.link_ticket permission" })
  async linkTicket(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: LinkKbTicketDto,
  ) {
    validateLinkTicketPayload(body);
    const { tenantId, userId } = this.requireAuth(request);
    await this.requirePermission(tenantId, userId, "kb.article.link_ticket");
    const correlationId = getCorrelationId(request);

    return this.articlesService.linkTicket(tenantId, id, body, userId, correlationId);
  }

  @Delete(":id/links/tickets/:ticketId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Unlink Knowledge Base article from a ticket" })
  @ApiNoContentResponse({ description: "Ticket link removed" })
  @ApiForbiddenResponse({ description: "Requires kb.article.link_ticket permission" })
  async unlinkTicket(
    @Req() request: Request,
    @Param("id") id: string,
    @Param("ticketId") ticketId: string,
  ) {
    const { tenantId, userId } = this.requireAuth(request);
    await this.requirePermission(tenantId, userId, "kb.article.link_ticket");
    const correlationId = getCorrelationId(request);

    await this.articlesService.unlinkTicket(tenantId, id, ticketId, userId, correlationId);
  }
}
