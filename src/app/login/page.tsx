import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateAndTouchSession } from "@/lib/sessionLifecycle";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

async function isSessionValid() {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get("session_token")?.value;

    if (!tokenCookie || !tokenCookie.trim()) {
      return false;
    }

    const validation = await validateAndTouchSession(tokenCookie);
    return validation.valid;
  } catch (error) {
    console.error("LoginPage session check error:", error);
    return false;
  }
}

export default async function LoginPage() {
  const loggedIn = await isSessionValid();
  if (loggedIn) {
    redirect("/");
  }

  return <LoginForm />;
}
