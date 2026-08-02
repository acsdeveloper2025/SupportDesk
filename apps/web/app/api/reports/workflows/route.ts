import { type NextRequest, NextResponse } from "next/server";

import { getAccessToken, getApiUrl } from "@/lib/auth/bff-session";

export async function GET(request: NextRequest) {
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { code: "AUTH_REQUIRED", message: "Authentication required" },
      { status: 401 },
    );
  }

  const query = request.nextUrl.search;
  const res = await fetch(getApiUrl(`/api/v1/reports/workflows${query}`), {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  const body = (await res.json().catch(() => ({}))) as unknown;
  return NextResponse.json(body, { status: res.status });
}
