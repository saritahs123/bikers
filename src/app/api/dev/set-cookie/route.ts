import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") || "ses_user1_topbar_test";
  const userId = searchParams.get("userId") || "1";

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set("session_token", token, { path: "/", httpOnly: true });
  response.cookies.set("session_user_id", userId, { path: "/" });
  return response;
}
