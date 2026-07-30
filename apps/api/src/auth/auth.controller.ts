import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req } from "@nestjs/common";
import { ApiAcceptedResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { getCorrelationId } from "../common/logging/correlation-id";
import { AuthRegistrationService } from "./registration/auth-registration.service";
import type {
  ConfirmEmailVerificationRequest,
  RegisterRequest,
} from "./registration/auth-registration.types";

@ApiTags("authentication")
@Controller("api/v1/auth")
export class AuthController {
  constructor(
    @Inject(AuthRegistrationService) private readonly registration: AuthRegistrationService,
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
}
