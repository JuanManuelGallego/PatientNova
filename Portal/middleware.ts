import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PATHS = [
  "/dashboard",
  "/patients",
  "/appointments",
  "/calendar",
  "/reminders",
  "/settings",
  "/medical-records",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Presence of the access token cookie is the fast, edge-safe check.
  // Full validity is still verified server-side on every API call, and
  // client-side via AuthGuard → /auth/me.
  const token = req.cookies.get("token")?.value;
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/patients/:path*",
    "/appointments/:path*",
    "/calendar/:path*",
    "/reminders/:path*",
    "/settings/:path*",
    "/medical-records/:path*",
  ],
};
