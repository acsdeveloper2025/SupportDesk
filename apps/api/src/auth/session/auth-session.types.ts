import type { TenantLookupInput } from "../../identity/identity.types";
import type { TokenPair } from "../tokens/auth-token.service";

export interface LoginRequest {
  correlationId?: string;
  deviceName?: string;
  email?: string;
  password?: string;
  rememberMe?: boolean;
  tenant?: TenantLookupInput;
  tenantId?: string;
  userAgent?: string;
}

export interface LogoutRequest {
  correlationId?: string;
  currentSessionId?: string;
  targetSessionId?: string;
}

export interface ListSessionsRequest {
  currentSessionId?: string;
}

export interface AuthSessionView {
  deviceName: string | null;
  expiresAt: Date;
  id: string;
  lastSeenAt: Date | null;
  rememberMe: boolean;
  state: string;
}

export type LoginResult =
  | {
      session: AuthSessionView;
      status: "authenticated";
      tokens: TokenPair;
    }
  | {
      session: AuthSessionView;
      status: "password_change_required";
      tokens: TokenPair;
    }
  | {
      status: "denied";
    };

export type LogoutResult = {
  status: "accepted";
};

export type ListSessionsResult =
  | {
      sessions: AuthSessionView[];
      status: "ok";
    }
  | {
      status: "denied";
    };
