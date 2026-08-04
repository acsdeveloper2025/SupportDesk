import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWithCsrf } from "@/lib/auth/csrf-client";

describe("client CSRF fetch helper", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds the BFF CSRF token to JSON mutations", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ csrfToken: "csrf-token" }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetch);

    const response = await fetchWithCsrf("/api/assets", {
      body: JSON.stringify({ name: "Laptop" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(response.ok).toBe(true);
    expect(fetch).toHaveBeenNthCalledWith(1, "/api/auth/csrf", { method: "GET" });
    const [, requestInit] = fetch.mock.calls[1] as [string, RequestInit];
    const headers = new Headers(requestInit.headers);

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/assets",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-csrf-token")).toBe("csrf-token");
  });
});
