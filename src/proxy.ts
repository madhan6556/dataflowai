import { type NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const protectedPaths = ["/dashboard"];
  const isProtectedPath = protectedPaths.some((p) => pathname.startsWith(p));

  // We set a lightweight "firebase_session" cookie after login for the proxy to read
  const hasSession = request.cookies.has("firebase_session");

  if (isProtectedPath && !hasSession) {
    const loginUrl = new URL("/auth", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/auth" && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth"],
};
