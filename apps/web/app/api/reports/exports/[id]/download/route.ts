import { type NextRequest, NextResponse } from "next/server";

import { getAccessToken, getApiUrl } from "@/lib/auth/bff-session";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { code: "AUTH_REQUIRED", message: "Authentication required" },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const res = await fetch(getApiUrl(`/api/v1/reports/exports/${id}/download`), {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const contentDisposition = res.headers.get("content-disposition") || "attachment";
  const arrayBuffer = await res.arrayBuffer();

  return new NextResponse(arrayBuffer, {
    headers: {
      "content-disposition": contentDisposition,
      "content-type": contentType,
    },
    status: res.status,
  });
}
