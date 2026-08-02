import { type NextRequest, NextResponse } from "next/server";

import { getAccessToken, getApiUrl } from "@/lib/auth/bff-session";

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const path = slug.join("/");
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return NextResponse.json(
      { code: "AUTH_REQUIRED", message: "Authentication required" },
      { status: 401 },
    );
  }

  const query = request.nextUrl.search;
  const res = await fetch(getApiUrl(`/api/v1/admin/${path}${query}`), {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(body, { status: res.status });
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const path = slug.join("/");
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return NextResponse.json(
      { code: "AUTH_REQUIRED", message: "Authentication required" },
      { status: 401 },
    );
  }

  const reqBody = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const res = await fetch(getApiUrl(`/api/v1/admin/${path}`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(reqBody),
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(body, { status: res.status });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const path = slug.join("/");
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return NextResponse.json(
      { code: "AUTH_REQUIRED", message: "Authentication required" },
      { status: 401 },
    );
  }

  const reqBody = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const res = await fetch(getApiUrl(`/api/v1/admin/${path}`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(reqBody),
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(body, { status: res.status });
}
