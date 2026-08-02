import { type NextRequest, NextResponse } from "next/server";

import { getAccessToken, getApiUrl, validateRequestCsrf } from "@/lib/auth/bff-session";

export async function GET(request: NextRequest) {
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { code: "AUTH_REQUIRED", message: "Authentication required" },
      { status: 401 },
    );
  }

  const res = await fetch(getApiUrl("/api/v1/reports/saved"), {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  const body = (await res.json().catch(() => ({}))) as unknown;
  return NextResponse.json(body, { status: res.status });
}

export async function POST(request: NextRequest) {
  if (!validateRequestCsrf(request)) {
    return NextResponse.json(
      { code: "CSRF_INVALID", message: "CSRF validation failed" },
      { status: 403 },
    );
  }

  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { code: "AUTH_REQUIRED", message: "Authentication required" },
      { status: 401 },
    );
  }

  const res = await fetch(getApiUrl("/api/v1/reports/saved"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
  });

  const body = (await res.json().catch(() => ({}))) as unknown;
  return NextResponse.json(body, { status: res.status });
}
