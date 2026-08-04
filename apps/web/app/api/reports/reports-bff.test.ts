import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ACCESS_TOKEN_COOKIE, CSRF_COOKIE } from "@/lib/auth/bff-session";

describe("reports BFF routes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("proxies saved report deletes through the same-origin BFF", async () => {
    const { DELETE } = await import("./saved/[id]/route");
    const fetch = vi.fn(() => Promise.resolve(Response.json({ deleted: true })));
    vi.stubEnv("SUPPORTDESK_API_URL", "http://api.test");
    vi.stubGlobal("fetch", fetch);

    const response = await DELETE(
      new NextRequest("http://localhost:3000/api/reports/saved/report-1", {
        headers: {
          cookie: `${ACCESS_TOKEN_COOKIE}=access-token; ${CSRF_COOKIE}=csrf-token`,
          "x-csrf-token": "csrf-token",
        },
        method: "DELETE",
      }),
      {
        params: Promise.resolve({ id: "report-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      "http://api.test/api/v1/reports/saved/report-1",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer access-token",
        }) as HeadersInit,
        method: "DELETE",
      }),
    );
  });

  it("rejects scheduled report deletes without CSRF", async () => {
    const { DELETE } = await import("./scheduled/[id]/route");
    const fetch = vi.fn(() => Promise.resolve(Response.json({ deleted: true })));
    vi.stubGlobal("fetch", fetch);

    const response = await DELETE(
      new NextRequest("http://localhost:3000/api/reports/scheduled/schedule-1", {
        headers: {
          cookie: `${ACCESS_TOKEN_COOKIE}=access-token`,
        },
        method: "DELETE",
      }),
      {
        params: Promise.resolve({ id: "schedule-1" }),
      },
    );

    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("streams report export downloads through the same-origin BFF", async () => {
    const { GET } = await import("./exports/[id]/download/route");
    const fetch = vi.fn(() =>
      Promise.resolve(
        new Response("export-data", {
          headers: {
            "content-disposition": 'attachment; filename="report.csv"',
            "content-type": "text/csv",
          },
        }),
      ),
    );
    vi.stubEnv("SUPPORTDESK_API_URL", "http://api.test");
    vi.stubGlobal("fetch", fetch);

    const response = await GET(
      new NextRequest("http://localhost:3000/api/reports/exports/export-1/download", {
        headers: {
          cookie: `${ACCESS_TOKEN_COOKIE}=access-token`,
        },
      }),
      {
        params: Promise.resolve({ id: "export-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="report.csv"');
    expect(await response.text()).toBe("export-data");
    expect(fetch).toHaveBeenCalledWith(
      "http://api.test/api/v1/reports/exports/export-1/download",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer access-token",
        }) as HeadersInit,
      }),
    );
  });
});
