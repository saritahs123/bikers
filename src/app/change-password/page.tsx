import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateAndTouchSession } from "@/lib/sessionLifecycle";
import { query } from "@/lib/db";
import ChangePasswordForm from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get("session_token")?.value;

  if (!tokenCookie || !tokenCookie.trim()) {
    redirect("/login");
  }

  const validation = await validateAndTouchSession(tokenCookie);
  if (!validation.valid || !validation.userId) {
    redirect("/login");
  }

  const userId = validation.userId;

  const userRows = await query<any>(
    `SELECT
       u.usuario_id,
       ui.nombre,
       ui.apellido,
       ui.correo_electronico,
       us.identificador_principal,
       us.forzar_cambio_clave,
       us.requiere_cambio_clave
     FROM admin.usuario u
     LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
     LEFT JOIN admin.usuario_seguridad us ON u.usuario_id = us.usuario_id
     WHERE u.usuario_id = $1
     LIMIT 1`,
    [userId]
  );

  if (!userRows || userRows.length === 0) {
    redirect("/login");
  }

  const row = userRows[0];
  const mustChange = Boolean(row.forzar_cambio_clave || row.requiere_cambio_clave);

  // If user does not require mandatory password change, redirect to dashboard
  if (!mustChange) {
    redirect("/");
  }

  const nombre = (row.nombre || "").trim();
  const apellido = (row.apellido || "").trim();
  const fullName = nombre && apellido ? `${nombre} ${apellido}` : (nombre || row.identificador_principal || "Usuario");
  const email = row.correo_electronico || row.identificador_principal || "";

  return <ChangePasswordForm userName={fullName} userEmail={email} />;
}
