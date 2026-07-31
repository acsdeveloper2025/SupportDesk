import { type NextRequest, NextResponse } from "next/server";

import {
  getApiUrl,
  sanitizeTokenResponse,
  setAuthCookies,
  validateRequestCsrf,
} from "@/lib/auth/bff-session";

export async function POST(request: NextRequest) {
  if (!validateRequestCsrf(request)) {
    return NextResponse.json(
      { code: "CSRF_INVALID", message: "CSRF validation failed." },
      { status: 403 },
    );
  }

  const apiResponse = await fetch(getApiUrl("/api/v1/auth/login"), {
    body: await request.text(),
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    method: "POST",
  });
  const body = await readJson(apiResponse);
  const response = NextResponse.json(sanitizeTokenResponse(body), {
    status: apiResponse.status,
  });

  if (apiResponse.ok) {
    setAuthCookies(response, body);
  }

  return response;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
