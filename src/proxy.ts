import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const isLoginPage = request.nextUrl.pathname === "/login";
  const userId = request.cookies.get("session_user_id")?.value;

  if (!userId && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (userId && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|logo.png|.*\\.png$).*)"],
};
