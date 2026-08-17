import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") || "ses_user1_topbar_test";
  const userId = parseInt(searchParams.get("userId") || "1", 10);
  const redirectUrl = searchParams.get("redirectUrl") || "/security/my-profile";

  try {
    const existing = await query(
      `SELECT sesion_id FROM admin.usuario_sesion WHERE token_identificador = $1`,
      [token]
    );

    if (!existing || existing.length === 0) {
      await query(
        `INSERT INTO admin.usuario_sesion (
           sesion_id, usuario_id, token_identificador, estado,
           direccion_ip, dispositivo_navegador, ubicacion, fecha_inicio, ultima_actividad, fecha_expiracion
         )
         VALUES (
           (SELECT COALESCE(MAX(sesion_id), 0) + 1 FROM admin.usuario_sesion),
           $1, $2, 'ACTIVA', '127.0.0.1', 'Dev Helper Agent', 'No disponible', NOW(), NOW(), NOW() + INTERVAL '100 years'
         )`,
        [userId, token]
      );
    } else {
      await query(
        `UPDATE admin.usuario_sesion
         SET estado = 'ACTIVA', ultima_actividad = NOW(), fecha_expiracion = NOW() + INTERVAL '100 years'
         WHERE token_identificador = $1`,
        [token]
      );
    }
  } catch (err) {
    console.error("Error in dev set-cookie:", err);
  }

  const response = NextResponse.redirect(new URL(redirectUrl, request.url));
  response.cookies.set("session_token", token, { path: "/", httpOnly: true });
  response.cookies.set("session_user_id", String(userId), { path: "/" });
  return response;
}
