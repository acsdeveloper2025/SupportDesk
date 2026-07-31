import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

import { AuthAccessTokenService } from "./auth-access-token.service";
import { setAuthenticatedRequestContext } from "./auth-context";

@Injectable()
export class AuthAccessTokenGuard implements CanActivate {
  constructor(
    @Inject(AuthAccessTokenService) private readonly accessTokens: AuthAccessTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const result = await this.accessTokens.authenticateBearer(request.header("authorization"));

    if (result.status !== "authenticated") {
      throw new UnauthorizedException();
    }

    setAuthenticatedRequestContext(request, result.context);

    return true;
  }
}
