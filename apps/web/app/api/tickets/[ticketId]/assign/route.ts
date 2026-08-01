import { type NextRequest, NextResponse } from "next/server";

import { getAccessToken, getApiUrl, validateRequestCsrf } from "@/lib/auth/bff-session";

interface RouteContext {
  params: Promise<{ ticketId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { ticketId } = await context.params;

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

  const apiResponse = await fetch(getApiUrl(`/api/v1/tickets/${ticketId}/assign`), {
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
