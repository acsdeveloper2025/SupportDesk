import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ACCESS_TOKEN_COOKIE, CSRF_COOKIE } from "@/lib/auth/bff-session";

import { POST } from "./[...slug]/route";

describe("admin BFF routes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects cookie-authenticated admin mutations without a matching CSRF token", async () => {
    const fetch = vi.fn(() => Promise.resolve(Response.json({ ok: true })));
    vi.stubEnv("SUPPORTDESK_API_URL", "http://api.test");
    vi.stubGlobal("fetch", fetch);

    const response = await POST(
      new NextRequest("http://localhost:3000/api/admin/users/invite", {
        body: JSON.stringify({ email: "agent@acme.test" }),
        headers: {
          cookie: `${ACCESS_TOKEN_COOKIE}=access-token`,
        },
        method: "POST",
      }),
      {
        params: Promise.resolve({ slug: ["users", "invite"] }),
      },
    );

    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("proxies admin mutations when CSRF and auth cookies are present", async () => {
    const fetch = vi.fn(() => Promise.resolve(Response.json({ invited: true })));
    vi.stubEnv("SUPPORTDESK_API_URL", "http://api.test");
    vi.stubGlobal("fetch", fetch);

    const response = await POST(
      new NextRequest("http://localhost:3000/api/admin/users/invite", {
        body: JSON.stringify({ email: "agent@acme.test" }),
        headers: {
          cookie: `${ACCESS_TOKEN_COOKIE}=access-token; ${CSRF_COOKIE}=csrf-token`,
          "x-csrf-token": "csrf-token",
        },
        method: "POST",
      }),
      {
        params: Promise.resolve({ slug: ["users", "invite"] }),
      },
    );

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      "http://api.test/api/v1/admin/users/invite",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer access-token",
        }) as HeadersInit,
        method: "POST",
      }),
    );
  });
});
