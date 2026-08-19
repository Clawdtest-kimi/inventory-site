import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Block search engines from /master and /login
  const path = request.nextUrl.pathname;
  if (path === "/master" || path === "/login") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  matcher: ["/master", "/login"],
};