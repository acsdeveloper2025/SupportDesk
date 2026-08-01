import { type NextRequest, NextResponse } from "next/server";

import { getAccessToken, getApiUrl } from "@/lib/auth/bff-session";

interface RouteContext {
  params: Promise<{ ticketId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { ticketId } = await context.params;
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return NextResponse.json(
      { code: "AUTH_REQUIRED", message: "Authentication is required." },
      { status: 401 },
    );
  }

  const { searchParams } = request.nextUrl;
  const page = searchParams.get("page") ?? "1";
  const pageSize = searchParams.get("pageSize") ?? "50";

  const apiResponse = await fetch(
    getApiUrl(`/api/v1/tickets/${ticketId}/timeline?page=${page}&pageSize=${pageSize}`),
    {
      headers: { authorization: `Bearer ${accessToken}` },
      method: "GET",
    },
  );

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
