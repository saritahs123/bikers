import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get("session_user_id")?.value;
    const tokenCookie = cookieStore.get("session_token")?.value;

    if (!userIdCookie || !tokenCookie) {
      return NextResponse.json(
        { error: "NO_SESSION", message: "No hay sesión activa." },
        { status: 401 }
      );
    }

    const rows = await query(
      `SELECT sesion_id, usuario_id, estado, ultima_actividad, fecha_expiracion 
       FROM admin.usuario_sesion 
       WHERE token_identificador = $1 AND usuario_id = $2 
       LIMIT 1`,
      [tokenCookie, parseInt(userIdCookie, 10)]
    );

    if (!rows || rows.length === 0) {
      // Session not found in DB
      cookieStore.delete("session_user_id");
      cookieStore.delete("session_token");
      return NextResponse.json(
        { error: "SESSION_NOT_FOUND", message: "La sesión no existe." },
        { status: 401 }
      );
    }

    const session = rows[0];
    if (session.estado === "REVOCADA" || session.estado === "CERRADA" || session.estado === "EXPIRADA") {
      // Session revoked or closed
      cookieStore.delete("session_user_id");
      cookieStore.delete("session_token");
      return NextResponse.json(
        { 
          error: "SESSION_REVOKED", 
          message: "Su sesión fue revocada. Por favor, vuelva a iniciar sesión." 
        },
        { status: 401 }
      );
    }

    // Update ultima_actividad if last update was more than 1 minute ago
    const lastAct = session.ultima_actividad ? new Date(session.ultima_actividad).getTime() : 0;
    const now = Date.now();
    if (now - lastAct > 60 * 1000) {
      await query(
        `UPDATE admin.usuario_sesion 
         SET ultima_actividad = CURRENT_TIMESTAMP 
         WHERE token_identificador = $1`,
        [tokenCookie]
      ).catch(err => console.error("Heartbeat update error:", err));
    }

    return NextResponse.json({ success: true, active: true });
  } catch (error: any) {
    console.error("Heartbeat API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
