import { randomBytes } from "node:crypto";

import type { NextRequest, NextResponse } from "next/server";

import { ACCESS_TOKEN_COOKIE, CSRF_COOKIE, CSRF_HEADER, REFRESH_TOKEN_COOKIE } from "./constants";

export { ACCESS_TOKEN_COOKIE, CSRF_COOKIE, CSRF_HEADER, REFRESH_TOKEN_COOKIE };

export function getApiUrl(path: string): string {
  const baseUrl =
    process.env["SUPPORTDESK_API_URL"] ??
    process.env["NEXT_PUBLIC_API_BASE_URL"] ??
    "http://localhost:3001";

  return `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export function validateCsrf(input: {
  cookieToken: string | undefined;
  headerToken: string | undefined;
  method: string;
}): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(input.method.toUpperCase())) {
    return true;
  }

  return (
    typeof input.cookieToken === "string" &&
    input.cookieToken.length > 0 &&
    input.cookieToken === input.headerToken
  );
}

export function validateRequestCsrf(request: NextRequest): boolean {
  return validateCsrf({
    cookieToken: request.cookies.get(CSRF_COOKIE)?.value,
    headerToken: request.headers.get(CSRF_HEADER) ?? undefined,
    method: request.method,
  });
}

export function sanitizeTokenResponse(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const sanitized: Record<string, unknown> = { ...value };
  const tokenPair = extractTokenPair(value);

  delete sanitized["accessToken"];
  delete sanitized["refreshToken"];

  if (isRecord(sanitized["tokens"])) {
    sanitized["tokens"] = {
      accessTokenExpiresAt: tokenPair?.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokenPair?.refreshTokenExpiresAt,
    };
  }

  return sanitized;
}

export function setAuthCookies(response: NextResponse, value: unknown): void {
  const tokenPair = extractTokenPair(value);

  if (!tokenPair?.accessToken || !tokenPair.refreshToken) {
    return;
  }

  response.cookies.set({
    expires: parseCookieDate(tokenPair.accessTokenExpiresAt),
    httpOnly: true,
    name: ACCESS_TOKEN_COOKIE,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    value: tokenPair.accessToken,
  });
  response.cookies.set({
    expires: parseCookieDate(tokenPair.refreshTokenExpiresAt),
    httpOnly: true,
    name: REFRESH_TOKEN_COOKIE,
    path: "/api/auth",
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    value: tokenPair.refreshToken,
  });
}

export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    httpOnly: false,
    name: CSRF_COOKIE,
    path: "/api/auth",
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    value: token,
  });
}

export function clearAuthCookies(response: NextResponse): void {
  const secure = shouldUseSecureCookies();

  for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, CSRF_COOKIE]) {
    response.cookies.set({
      httpOnly: name !== CSRF_COOKIE,
      maxAge: 0,
      name,
      path: name === ACCESS_TOKEN_COOKIE ? "/" : "/api/auth",
      sameSite: "lax",
      secure,
      value: "",
    });
  }
}

export function getAccessToken(request: NextRequest): string | undefined {
  return request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
}

export function getRefreshToken(request: NextRequest): string | undefined {
  return request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
}

function extractTokenPair(value: unknown):
  | {
      accessToken: string;
      accessTokenExpiresAt: string | undefined;
      refreshToken: string;
      refreshTokenExpiresAt: string | undefined;
    }
  | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const source = isRecord(value["tokens"]) ? value["tokens"] : value;
  const accessToken = source["accessToken"];
  const refreshToken = source["refreshToken"];

  if (typeof accessToken !== "string" || typeof refreshToken !== "string") {
    return undefined;
  }

  return {
    accessToken,
    accessTokenExpiresAt:
      typeof source["accessTokenExpiresAt"] === "string"
        ? source["accessTokenExpiresAt"]
        : undefined,
    refreshToken,
    refreshTokenExpiresAt:
      typeof source["refreshTokenExpiresAt"] === "string"
        ? source["refreshTokenExpiresAt"]
        : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseCookieDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function shouldUseSecureCookies(): boolean {
  return process.env["NODE_ENV"] === "production";
}
