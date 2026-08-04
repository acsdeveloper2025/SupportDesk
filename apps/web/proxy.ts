import { type NextRequest, NextResponse } from "next/server";

import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/constants";

const protectedRoutePrefixes = ["/admin", "/tickets", "/reports", "/assets", "/kb", "/profile"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedRoute = protectedRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/tickets/:path*",
    "/reports/:path*",
    "/assets/:path*",
    "/kb/:path*",
    "/profile/:path*",
  ],
};
