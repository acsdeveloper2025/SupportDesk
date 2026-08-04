import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ACCESS_TOKEN_COOKIE,
  CSRF_COOKIE,
  REFRESH_TOKEN_COOKIE,
  sanitizeTokenResponse,
  setCsrfCookie,
  validateCsrf,
} from "@/lib/auth/bff-session";

import { POST as login } from "./login/route";
import { GET as me } from "./me/route";
import { POST as refresh } from "./refresh/route";

describe("auth BFF session routes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("rejects cookie-authenticated mutations without a matching CSRF token", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    const response = await login(
      new NextRequest("http://localhost:3000/api/auth/login", {
        body: JSON.stringify({
          email: "agent@acme.test",
          password: "CorrectHorse9!Battery",
          tenantId: "11111111-1111-4111-8111-111111111111",
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stores login tokens in HttpOnly cookies without returning token material", async () => {
    vi.stubEnv("SUPPORTDESK_API_URL", "http://api.test");
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          Response.json({
            session: {
              id: "33333333-3333-4333-8333-333333333333",
            },
            status: "authenticated",
            tokens: {
              accessToken: "access-token",
              accessTokenExpiresAt: "2026-07-30T00:15:00.000Z",
              refreshToken: "refresh-token",
              refreshTokenExpiresAt: "2026-07-31T00:00:00.000Z",
            },
          }),
        ),
      ),
    );

    const response = await login(
      new NextRequest("http://localhost:3000/api/auth/login", {
        body: JSON.stringify({
          email: "agent@acme.test",
          password: "CorrectHorse9!Battery",
          tenantId: "11111111-1111-4111-8111-111111111111",
        }),
        headers: {
          cookie: `${CSRF_COOKIE}=csrf-token`,
          "x-csrf-token": "csrf-token",
        },
        method: "POST",
      }),
    );
    const body = (await response.json()) as Record<string, unknown>;
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(body).toEqual({
      session: {
        id: "33333333-3333-4333-8333-333333333333",
      },
      status: "authenticated",
      tokens: {
        accessTokenExpiresAt: "2026-07-30T00:15:00.000Z",
        refreshTokenExpiresAt: "2026-07-31T00:00:00.000Z",
      },
    });
    expect(JSON.stringify(body)).not.toContain("access-token");
    expect(JSON.stringify(body)).not.toContain("refresh-token");
    expect(setCookie).toContain(`${ACCESS_TOKEN_COOKIE}=access-token`);
    expect(setCookie).toContain(`${REFRESH_TOKEN_COOKIE}=refresh-token`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
  });

  it("refreshes tokens from the HttpOnly refresh cookie", async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(
        Response.json({
          accessToken: "next-access-token",
          accessTokenExpiresAt: "2026-07-30T00:15:00.000Z",
          refreshToken: "next-refresh-token",
          refreshTokenExpiresAt: "2026-07-31T00:00:00.000Z",
          status: "refreshed",
        }),
      ),
    );
    vi.stubEnv("SUPPORTDESK_API_URL", "http://api.test");
    vi.stubGlobal("fetch", fetch);

    const response = await refresh(
      new NextRequest("http://localhost:3000/api/auth/refresh", {
        headers: {
          cookie: `${CSRF_COOKIE}=csrf-token; ${REFRESH_TOKEN_COOKIE}=refresh-token`,
          "x-csrf-token": "csrf-token",
        },
        method: "POST",
      }),
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(fetch).toHaveBeenCalledWith(
      "http://api.test/api/v1/auth/refresh",
      expect.objectContaining({
        body: JSON.stringify({
          refreshToken: "refresh-token",
        }),
        method: "POST",
      }),
    );
    expect(JSON.stringify(body)).not.toContain("next-refresh-token");
    expect(response.headers.get("set-cookie")).toContain(
      `${REFRESH_TOKEN_COOKIE}=next-refresh-token`,
    );
  });

  it("proxies current identity requests with the access-token cookie as bearer auth", async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(
        Response.json({
          email: "agent@acme.test",
          sessionId: "33333333-3333-4333-8333-333333333333",
          tenantId: "11111111-1111-4111-8111-111111111111",
          userId: "22222222-2222-4222-8222-222222222222",
        }),
      ),
    );
    vi.stubEnv("SUPPORTDESK_API_URL", "http://api.test");
    vi.stubGlobal("fetch", fetch);

    const response = await me(
      new NextRequest("http://localhost:3000/api/auth/me", {
        headers: {
          cookie: `${ACCESS_TOKEN_COOKIE}=access-token`,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      "http://api.test/api/v1/auth/me",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer access-token",
        }) as HeadersInit,
        method: "GET",
      }),
    );
  });
});

describe("auth BFF CSRF and response helpers", () => {
  it("sets the CSRF cookie at the application root for all BFF mutations", () => {
    const response = NextResponse.json({});

    setCsrfCookie(response, "csrf-token");

    expect(response.headers.get("set-cookie")).toMatch(/;\s*Path=\/(?:;|$)/);
  });

  it("requires matching csrf cookie and header for unsafe methods", () => {
    expect(
      validateCsrf({
        cookieToken: "token",
        headerToken: "token",
        method: "POST",
      }),
    ).toBe(true);
    expect(
      validateCsrf({
        cookieToken: "token",
        headerToken: "other",
        method: "POST",
      }),
    ).toBe(false);
    expect(
      validateCsrf({
        cookieToken: undefined,
        headerToken: undefined,
        method: "GET",
      }),
    ).toBe(true);
  });

  it("removes raw token values from auth API responses", () => {
    expect(
      sanitizeTokenResponse({
        status: "authenticated",
        tokens: {
          accessToken: "access-token",
          accessTokenExpiresAt: "2026-07-30T00:15:00.000Z",
          refreshToken: "refresh-token",
          refreshTokenExpiresAt: "2026-07-31T00:00:00.000Z",
        },
      }),
    ).toEqual({
      status: "authenticated",
      tokens: {
        accessTokenExpiresAt: "2026-07-30T00:15:00.000Z",
        refreshTokenExpiresAt: "2026-07-31T00:00:00.000Z",
      },
    });
  });
});
