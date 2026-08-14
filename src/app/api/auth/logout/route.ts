import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { query } from "@/lib/db";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get("session_user_id")?.value;
    const tokenCookie = cookieStore.get("session_token")?.value;

    if (tokenCookie) {
      const userId = userIdCookie ? parseInt(userIdCookie, 10) : null;
      
      // Close active session in DB
      await query(
        `UPDATE admin.usuario_sesion 
         SET estado = 'CERRADA', ultima_actividad = CURRENT_TIMESTAMP 
         WHERE token_identificador = $1 AND estado = 'ACTIVA'`,
        [tokenCookie]
      ).catch(err => console.error("Error closing session on logout:", err));

      if (userId) {
        const reqHeaders = await headers();
        const ip = reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || reqHeaders.get("x-real-ip") || "127.0.0.1";
        const ua = reqHeaders.get("user-agent") || "Navegador Web";

        // Log audit
        await query(
          `INSERT INTO admin.usuario_auditoria
           (auditoria_id, usuario_id, admin_id, fecha_hora, accion, valor_anterior, valor_nuevo, motivo, resultado, direccion_ip, dispositivo)
           VALUES 
           ((SELECT COALESCE(MAX(auditoria_id), 0) + 1 FROM admin.usuario_auditoria), $1, $1, CURRENT_TIMESTAMP, 'SESSION_LOGOUT', 'Estado: ACTIVA', 'Estado: CERRADA', 'Cierre de sesión voluntario', 'COMPLETADO', $2, $3)`,
          [userId, ip, ua]
        ).catch(err => console.error("Error inserting logout audit:", err));
      }
    }

    cookieStore.delete("session_user_id");
    cookieStore.delete("session_token");

    return NextResponse.json({ success: true, message: "Sesión cerrada correctamente." });
  } catch (error: any) {
    console.error("Logout API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
