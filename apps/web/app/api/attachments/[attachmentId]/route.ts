import { type NextRequest, NextResponse } from "next/server";

import { getAccessToken, getApiUrl, validateRequestCsrf } from "@/lib/auth/bff-session";

interface RouteContext {
  params: Promise<{ attachmentId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { code: "AUTH_REQUIRED", message: "Authentication is required." },
      { status: 401 },
    );
  }

  const { attachmentId } = await context.params;
  const apiResponse = await fetch(getApiUrl(`/api/v1/attachments/${attachmentId}`), {
    headers: { authorization: `Bearer ${accessToken}` },
    method: "GET",
  });

  const contentType = apiResponse.headers.get("content-type") || "application/octet-stream";
  const contentDisposition = apiResponse.headers.get("content-disposition") || "attachment";
  const contentLength = apiResponse.headers.get("content-length");
  const arrayBuffer = await apiResponse.arrayBuffer();

  return new NextResponse(arrayBuffer, {
    headers: {
      ...(contentLength ? { "content-length": contentLength } : {}),
      "content-disposition": contentDisposition,
      "content-type": contentType,
    },
    status: apiResponse.status,
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
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

  const { attachmentId } = await context.params;
  const apiResponse = await fetch(getApiUrl(`/api/v1/attachments/${attachmentId}`), {
    body: await request.text(),
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    method: "DELETE",
  });

  if (apiResponse.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

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
