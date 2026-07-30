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
} from "@nestjs/common";
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request } from "express";

import { getCorrelationId } from "../common/logging/correlation-id";
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
      currentSessionId: sessionHeader,
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
      currentSessionId: body.currentSessionId ?? sessionHeader,
    });
  }

  @Get("sessions")
  @ApiOkResponse({
    description: "Current user's active sessions.",
  })
  async listSessions(@Headers("x-session-id") sessionHeader: string | undefined) {
    const result = await this.sessions.listSessions({
      currentSessionId: sessionHeader,
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
      currentSessionId: sessionHeader,
      targetSessionId: sessionId,
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
  async refresh(@Body() body: { refreshToken?: string }) {
    const result = await this.tokens.refreshTokenPair({
      refreshToken: body.refreshToken,
    });

    if (result.status !== "refreshed") {
      throw new UnauthorizedException();
    }

    return result;
  }
}
