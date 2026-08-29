import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { recordUserActivity, recordUserAudit } from "@/lib/auditLogger";
import { closeSession } from "@/lib/sessionLifecycle";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get("session_user_id")?.value;
    const tokenCookie = cookieStore.get("session_token")?.value;

    if (tokenCookie) {
      const userId = userIdCookie ? parseInt(userIdCookie, 10) : null;
      
      // Close active session in DB with forensic timestamps
      await closeSession({
        rawToken: tokenCookie,
        userId,
        motivo: "Cierre de sesión voluntario en la plataforma"
      });

      if (userId) {
        // Log operational activity
        await recordUserActivity({
          userId,
          modulo: 'Seguridad',
          evento: 'LOGOUT',
          descripcion: 'Cierre de sesión voluntario en la plataforma',
          resultado: 'Exitoso'
        });
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
