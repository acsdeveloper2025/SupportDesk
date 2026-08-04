import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ACCESS_TOKEN_COOKIE, CSRF_COOKIE } from "@/lib/auth/bff-session";

import { POST as assignAsset } from "./[assetId]/assign/route";
import { GET as getAssetHistory } from "./[assetId]/history/route";
import { POST as unassignAsset } from "./[assetId]/unassign/route";

const routeContext = { params: Promise.resolve({ assetId: "asset-1" }) };

describe("asset BFF routes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("proxies asset assignment to the backend assignments endpoint", async () => {
    const fetch = vi.fn(() => Promise.resolve(Response.json({ id: "asset-1" })));
    vi.stubEnv("SUPPORTDESK_API_URL", "http://api.test");
    vi.stubGlobal("fetch", fetch);

    const response = await assignAsset(
      new NextRequest("http://localhost:3000/api/assets/asset-1/assign", {
        body: JSON.stringify({ kind: "DEPARTMENT", assignedDepartment: "IT" }),
        headers: {
          cookie: `${ACCESS_TOKEN_COOKIE}=access-token; ${CSRF_COOKIE}=csrf-token`,
          "x-csrf-token": "csrf-token",
        },
        method: "POST",
      }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      "http://api.test/api/v1/assets/asset-1/assignments",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("proxies asset unassignment as DELETE to the backend assignments endpoint", async () => {
    const fetch = vi.fn(() => Promise.resolve(Response.json({ id: "asset-1" })));
    vi.stubEnv("SUPPORTDESK_API_URL", "http://api.test");
    vi.stubGlobal("fetch", fetch);

    const response = await unassignAsset(
      new NextRequest("http://localhost:3000/api/assets/asset-1/unassign", {
        headers: {
          cookie: `${ACCESS_TOKEN_COOKIE}=access-token; ${CSRF_COOKIE}=csrf-token`,
          "x-csrf-token": "csrf-token",
        },
        method: "POST",
      }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      "http://api.test/api/v1/assets/asset-1/assignments",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("proxies asset history reads to the backend history endpoint", async () => {
    const fetch = vi.fn(() => Promise.resolve(Response.json([{ id: "history-1" }])));
    vi.stubEnv("SUPPORTDESK_API_URL", "http://api.test");
    vi.stubGlobal("fetch", fetch);

    const response = await getAssetHistory(
      new NextRequest("http://localhost:3000/api/assets/asset-1/history", {
        headers: {
          cookie: `${ACCESS_TOKEN_COOKIE}=access-token`,
        },
        method: "GET",
      }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith("http://api.test/api/v1/assets/asset-1/history", {
      headers: { authorization: "Bearer access-token" },
      method: "GET",
    });
  });
});
