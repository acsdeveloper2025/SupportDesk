import { NextResponse } from "next/server";

import { generateCsrfToken, setCsrfCookie } from "@/lib/auth/bff-session";

export function GET() {
  const csrfToken = generateCsrfToken();
  const response = NextResponse.json({
    csrfToken,
  });

  setCsrfCookie(response, csrfToken);

  return response;
}
