import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateAndTouchSession } from "@/lib/sessionLifecycle";
import { query } from "@/lib/db";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

async function isSessionValid() {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get("session_token")?.value;

    if (!tokenCookie || !tokenCookie.trim()) {
      return { valid: false, mustChange: false };
    }

    const validation = await validateAndTouchSession(tokenCookie);
    if (!validation.valid || !validation.userId) {
      return { valid: false, mustChange: false };
    }

    const secRows = await query<any>(
      `SELECT forzar_cambio_clave, requiere_cambio_clave FROM admin.usuario_seguridad WHERE usuario_id = $1 LIMIT 1`,
      [validation.userId]
    );
    const mustChange = Boolean(secRows?.[0]?.forzar_cambio_clave || secRows?.[0]?.requiere_cambio_clave);

    return { valid: true, mustChange };
  } catch (error) {
    console.error("LoginPage session check error:", error);
    return { valid: false, mustChange: false };
  }
}

export default async function LoginPage() {
  const sessionStatus = await isSessionValid();
  if (sessionStatus.valid) {
    if (sessionStatus.mustChange) {
      redirect("/change-password");
    } else {
      redirect("/");
    }
  }

  return <LoginForm />;
}
