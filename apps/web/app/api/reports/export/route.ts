import { type NextRequest, NextResponse } from "next/server";

import { getAccessToken, getApiUrl, validateRequestCsrf } from "@/lib/auth/bff-session";

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

  const res = await fetch(getApiUrl("/api/v1/reports/export"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
  });

  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const contentDisposition = res.headers.get("content-disposition") || "attachment";
  const arrayBuffer = await res.arrayBuffer();

  return new NextResponse(arrayBuffer, {
    status: res.status,
    headers: {
      "content-type": contentType,
      "content-disposition": contentDisposition,
    },
  });
}
