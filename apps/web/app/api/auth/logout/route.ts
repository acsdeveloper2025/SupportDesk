import { type NextRequest, NextResponse } from "next/server";

import {
  clearAuthCookies,
  getAccessToken,
  getApiUrl,
  validateRequestCsrf,
} from "@/lib/auth/bff-session";

export async function POST(request: NextRequest) {
  if (!validateRequestCsrf(request)) {
    return NextResponse.json(
      { code: "CSRF_INVALID", message: "CSRF validation failed." },
      { status: 403 },
    );
  }

  const accessToken = getAccessToken(request);

  if (accessToken) {
    await fetch(getApiUrl("/api/v1/auth/logout"), {
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      method: "POST",
      body: "{}",
    });
  }

  const response = NextResponse.json(
    {
      status: "accepted",
    },
    {
      status: 202,
    },
  );

  clearAuthCookies(response);

  return response;
}
