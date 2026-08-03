import { type NextRequest, NextResponse } from "next/server";

import { getAccessToken, getApiUrl, validateRequestCsrf } from "@/lib/auth/bff-session";

export async function GET(request: NextRequest) {
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return NextResponse.json(
      { code: "AUTH_REQUIRED", message: "Authentication is required." },
      { status: 401 },
    );
  }

  const { searchParams } = request.nextUrl;
  const targetUrl = new URL(getApiUrl("/api/v1/tickets"));
  searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  const apiResponse = await fetch(targetUrl.toString(), {
    headers: { authorization: `Bearer ${accessToken}` },
    method: "GET",
  });

  const body = await readJson(apiResponse);
  return NextResponse.json(body, { status: apiResponse.status });
}

export async function POST(request: NextRequest) {
  if (!validateRequestCsrf(request)) {
    return NextResponse.json(
      { code: "CSRF_INVALID", message: "CSRF validation failed." },
      { status: 403 },
    );
  }

  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { code: "AUTH_REQUIRED", message: "Authentication is required." },
      { status: 401 },
    );
  }

  const apiResponse = await fetch(getApiUrl("/api/v1/tickets"), {
    body: await request.text(),
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    method: "POST",
  });

  const body = await readJson(apiResponse);
  return NextResponse.json(body, { status: apiResponse.status });
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
