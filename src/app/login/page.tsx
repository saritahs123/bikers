import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

async function isSessionValid() {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get("session_token")?.value;

    if (!tokenCookie || !tokenCookie.trim()) {
      return false;
    }

    const sessionCheck = await query<{ usuario_id: number; fecha_expiracion: string | Date | null; estado: string }>(
      `SELECT usuario_id, fecha_expiracion, estado
       FROM admin.usuario_sesion
       WHERE token_identificador = $1 AND estado = 'ACTIVA'
       LIMIT 1`,
      [tokenCookie]
    );

    if (!sessionCheck || sessionCheck.length === 0) {
      return false;
    }

    const session = sessionCheck[0];
    if (session.estado !== "ACTIVA") {
      return false;
    }

    return true;
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
