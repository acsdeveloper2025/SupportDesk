import {
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
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request } from "express";

import { getCorrelationId } from "../common/logging/correlation-id";
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
    @Inject(AuthRegistrationService) private readonly registration: AuthRegistrationService,
    @Inject(AuthSessionService) private readonly sessions: AuthSessionService,
    @Inject(AuthTokenService) private readonly tokens: AuthTokenService,
  ) {}

  @Post("register")
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

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: "Login succeeded and created a tenant-scoped session.",
  })
  @ApiUnauthorizedResponse({
    description: "Login denied without revealing which credential failed.",
  })
  async login(@Body() body: LoginRequest, @Req() request: Request) {
    const result = await this.sessions.login({
      ...body,
      correlationId: getCorrelationId(request),
      userAgent: request.header("user-agent"),
    });

    if (result.status !== "authenticated") {
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
