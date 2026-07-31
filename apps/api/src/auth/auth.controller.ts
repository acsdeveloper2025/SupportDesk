import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request } from "express";

import { getCorrelationId } from "../common/logging/correlation-id";
import { AuthAccessTokenGuard } from "./guards/auth-access-token.guard";
import { AuthAccessTokenService } from "./guards/auth-access-token.service";
import { getAuthenticatedRequestContext } from "./guards/auth-context";
import { AuthPasswordService } from "./password/auth-password.service";
import { AuthPasswordResetService } from "./password-reset/auth-password-reset.service";
import type {
  ConfirmPasswordResetRequest,
  PasswordResetRequest,
} from "./password-reset/auth-password-reset.types";
import { AuthRateLimit } from "./rate-limit/auth-rate-limit.guard";
import { AuthRegistrationService } from "./registration/auth-registration.service";
import type {
  ConfirmEmailVerificationRequest,
  RegisterRequest,
} from "./registration/auth-registration.types";
import { AuthSessionService } from "./session/auth-session.service";
import type { LoginRequest } from "./session/auth-session.types";
import { AuthTokenService } from "./tokens/auth-token.service";

@ApiTags("authentication")
@Controller("api/v1/auth")
export class AuthController {
  constructor(
    @Inject(AuthAccessTokenService) private readonly accessTokens: AuthAccessTokenService,
    @Inject(AuthPasswordService) private readonly password: AuthPasswordService,
    @Inject(AuthPasswordResetService) private readonly passwordReset: AuthPasswordResetService,
    @Inject(AuthRegistrationService) private readonly registration: AuthRegistrationService,
    @Inject(AuthSessionService) private readonly sessions: AuthSessionService,
    @Inject(AuthTokenService) private readonly tokens: AuthTokenService,
  ) {}

  @Post("register")
  @AuthRateLimit("register")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({
    description: "Registration request accepted without account enumeration.",
  })
  async register(@Body() body: RegisterRequest, @Req() request: Request) {
    const result = await this.registration.register({
      ...body,
      correlationId: getCorrelationId(request),
      ipAddress: request.ip,
      userAgent: request.header("user-agent"),
    });

    return result.status === "accepted" ? result : { status: "accepted" };
  }

  @Post("email-verification/confirm")
  @AuthRateLimit("email-verification")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({
    description: "Email verification confirmation accepted without token enumeration.",
  })
  async confirmEmailVerification(
    @Body() body: ConfirmEmailVerificationRequest,
    @Req() request: Request,
  ) {
    await this.registration.confirmEmailVerification({
      ...body,
      correlationId: getCorrelationId(request),
      ipAddress: request.ip,
      userAgent: request.header("user-agent"),
    });

    return {
      status: "accepted",
    };
  }

  @Post("password-reset/request")
  @AuthRateLimit("password-reset-request")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({
    description: "Password reset request accepted without account enumeration.",
  })
  async requestPasswordReset(@Body() body: PasswordResetRequest, @Req() request: Request) {
    return this.passwordReset.requestPasswordReset({
      ...body,
      correlationId: getCorrelationId(request),
      ipAddress: request.ip,
      userAgent: request.header("user-agent"),
    });
  }

  @Post("password-reset/confirm")
  @AuthRateLimit("password-reset-confirm")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({
    description: "Password reset confirmation accepted without token enumeration.",
  })
  async confirmPasswordReset(@Body() body: ConfirmPasswordResetRequest, @Req() request: Request) {
    return this.passwordReset.confirmPasswordReset({
      ...body,
      correlationId: getCorrelationId(request),
      ipAddress: request.ip,
      userAgent: request.header("user-agent"),
    });
  }

  @Post("password/change")
  @AuthRateLimit("password-change")
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    schema: {
      properties: {
        currentPassword: { format: "password", type: "string" },
        newPassword: { format: "password", type: "string" },
      },
      required: ["currentPassword", "newPassword"],
      type: "object",
    },
  })
  @ApiOkResponse({
    description: "Password changed; existing sessions and refresh tokens were revoked.",
    schema: {
      properties: {
        status: { enum: ["changed"], type: "string" },
      },
      required: ["status"],
      type: "object",
    },
  })
  @ApiBadRequestResponse({
    description: "The new password does not satisfy the password policy.",
  })
  @ApiUnauthorizedResponse({
    description: "Password change denied without credential detail disclosure.",
  })
  async changePassword(
    @Body() body: { currentPassword?: string; newPassword?: string },
    @Headers("x-session-id") sessionHeader: string | undefined,
    @Req() request: Request,
  ) {
    const result = await this.password.changePassword({
      ...body,
      correlationId: getCorrelationId(request),
      currentSessionId: await this.resolveCurrentSessionId(request, sessionHeader),
      ipAddress: request.ip,
      userAgent: request.header("user-agent"),
    });

    if (result.status === "denied") {
      throw new UnauthorizedException();
    }

    if (result.status === "validation_failed") {
      throw new BadRequestException(result);
    }

    return result;
  }

  @Post("login")
  @AuthRateLimit("login")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: "Login succeeded and created a tenant-scoped session.",
    schema: {
      oneOf: [
        {
          properties: {
            session: { type: "object" },
            status: { enum: ["authenticated"], type: "string" },
            tokens: { type: "object" },
          },
          required: ["session", "status", "tokens"],
          type: "object",
        },
        {
          properties: {
            session: { type: "object" },
            status: { enum: ["password_change_required"], type: "string" },
            tokens: { type: "object" },
          },
          required: ["session", "status", "tokens"],
          type: "object",
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({
    description: "Login denied without revealing which credential failed.",
  })
  async login(@Body() body: LoginRequest, @Req() request: Request) {
    const result = await this.sessions.login({
      ...body,
      correlationId: getCorrelationId(request),
      ipAddress: request.ip,
      userAgent: request.header("user-agent"),
    });

    if (result.status === "denied") {
      throw new UnauthorizedException();
    }

    return result;
  }

  @Get("me")
  @UseGuards(AuthAccessTokenGuard)
  @ApiBearerAuth()
  @ApiOkResponse({
    description: "Current authenticated tenant identity.",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication is required.",
  })
  me(@Req() request: Request) {
    const context = getAuthenticatedRequestContext(request);

    if (!context) {
      throw new UnauthorizedException();
    }

    return context;
  }

  @Post("logout")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({
    description: "Logout request accepted.",
  })
  async logout(
    @Body() body: { currentSessionId?: string; targetSessionId?: string },
    @Headers("x-session-id") sessionHeader: string | undefined,
    @Req() request: Request,
  ) {
    return this.sessions.logout({
      ...body,
      correlationId: getCorrelationId(request),
      currentSessionId:
        body.currentSessionId ?? (await this.resolveCurrentSessionId(request, sessionHeader)),
      ipAddress: request.ip,
      userAgent: request.header("user-agent"),
    });
  }

  @Get("sessions")
  @ApiOkResponse({
    description: "Current user's active sessions.",
  })
  async listSessions(
    @Headers("x-session-id") sessionHeader: string | undefined,
    @Req() request: Request,
  ) {
    const result = await this.sessions.listSessions({
      currentSessionId: await this.resolveCurrentSessionId(request, sessionHeader),
    });

    if (result.status !== "ok") {
      throw new UnauthorizedException();
    }

    return result;
  }

  @Delete("sessions/:sessionId")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({
    description: "Session revocation request accepted.",
  })
  async revokeSession(
    @Headers("x-session-id") sessionHeader: string | undefined,
    @Param("sessionId") sessionId: string,
    @Req() request: Request,
  ) {
    return this.sessions.logout({
      correlationId: getCorrelationId(request),
      currentSessionId: await this.resolveCurrentSessionId(request, sessionHeader),
      ipAddress: request.ip,
      targetSessionId: sessionId,
      userAgent: request.header("user-agent"),
    });
  }

  @Post("refresh")
  @AuthRateLimit("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: "Refresh token rotated and new token pair issued.",
  })
  @ApiUnauthorizedResponse({
    description: "Refresh denied without token validity disclosure.",
  })
  async refresh(@Body() body: { refreshToken?: string }, @Req() request: Request) {
    const result = await this.tokens.refreshTokenPair({
      correlationId: getCorrelationId(request),
      ipAddress: request.ip,
      refreshToken: body.refreshToken,
      userAgent: request.header("user-agent"),
    });

    if (result.status !== "refreshed") {
      throw new UnauthorizedException();
    }

    return result;
  }

  private async resolveCurrentSessionId(
    request: Request,
    sessionHeader: string | undefined,
  ): Promise<string | undefined> {
    const authorizationHeader = request.header("authorization");

    if (!authorizationHeader) {
      return sessionHeader;
    }

    const result = await this.accessTokens.authenticateBearer(authorizationHeader);

    if (result.status !== "authenticated") {
      throw new UnauthorizedException();
    }

    return result.context.sessionId;
  }
}
