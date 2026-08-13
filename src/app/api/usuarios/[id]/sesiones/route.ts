import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { query } from "@/lib/db";

const SESSION_STALE_MINUTES = 30;

function formatDuration(startMs: number, endMs: number): string {
  const diffSec = Math.max(0, Math.floor((endMs - startMs) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  const remMin = diffMin % 60;
  if (diffHours < 24) return `${diffHours}h ${remMin}m`;
  const diffDays = Math.floor(diffHours / 24);
  const remHours = diffHours % 24;
  return `${diffDays}d ${remHours}h`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseInt(id.replace(/\D/g, ""), 10);

    if (!userId || isNaN(userId)) {
      return NextResponse.json([]);
    }

    const cookieStore = await cookies();
    const callerSessionToken = cookieStore.get("session_token")?.value || "";

    const sql = `
      SELECT *
      FROM admin.usuario_sesion
      WHERE usuario_id = $1
      ORDER BY ultima_actividad DESC, fecha_inicio DESC
    `;

    const rows = await query(sql, [userId]);
    const nowMs = Date.now();

    const mapped = (rows || []).map((r: any) => {
      const rawState = (r.estado || 'ACTIVA').toUpperCase();
      const startMs = r.fecha_inicio ? new Date(r.fecha_inicio).getTime() : nowMs;
      const lastActMs = r.ultima_actividad ? new Date(r.ultima_actividad).getTime() : startMs;
      const expMs = r.fecha_expiracion ? new Date(r.fecha_expiracion).getTime() : null;

      let derivedState = rawState;
      if (expMs && expMs < nowMs && rawState === 'ACTIVA') {
        derivedState = 'EXPIRADA';
      } else if (rawState === 'ACTIVA') {
        const minsInactive = (nowMs - lastActMs) / (1000 * 60);
        if (minsInactive > SESSION_STALE_MINUTES) {
          derivedState = 'POSIBLEMENTE COLGADA';
        }
      }

      const isCurrent = Boolean(callerSessionToken && r.token_identificador === callerSessionToken);

      const endMsForDuration = (derivedState === 'ACTIVA' || derivedState === 'POSIBLEMENTE COLGADA') ? nowMs : lastActMs;
      const durationFormatted = formatDuration(startMs, endMsForDuration);

      return {
        id: r.sesion_id,
        sesion_id: r.sesion_id,
        usuario_id: r.usuario_id,
        device: r.dispositivo_navegador || "Navegador Web",
        dispositivo_navegador: r.dispositivo_navegador || "Navegador Web",
        ip: r.direccion_ip || "—",
        direccion_ip: r.direccion_ip || "—",
        location: r.ubicacion || "No disponible",
        ubicacion: r.ubicacion || "No disponible",
        login_time: r.fecha_inicio || null,
        fecha_inicio: r.fecha_inicio || null,
        last_activity_at: r.ultima_actividad || null,
        ultima_actividad: r.ultima_actividad || null,
        fecha_expiracion: r.fecha_expiracion || null,
        fecha_cierre: r.fecha_cierre || null,
        fecha_revocacion: r.fecha_revocacion || null,
        motivo_cierre: r.motivo_cierre || null,
        motivo_revocacion: r.motivo_revocacion || null,
        revocado_por: r.revocado_por || null,
        tipo_cierre: r.tipo_cierre || null,
        raw_estado: rawState,
        estado: derivedState,
        is_current: isCurrent,
        duration: durationFormatted
      };
    });

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error("Error fetching usuario_sesion:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseInt(id.replace(/\D/g, ""), 10);
    const body = await req.json();

    if (!userId || isNaN(userId)) {
      return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const callerUserId = parseInt(cookieStore.get("session_user_id")?.value || "1", 10);
    const callerSessionToken = cookieStore.get("session_token")?.value || "";

    const reqHeaders = await headers();
    const ip = reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || reqHeaders.get("x-real-ip") || "127.0.0.1";
    const device = reqHeaders.get("user-agent") || "Navegador Web";

    if (body.revokeAll) {
      const keepCurrentToken = body.keepCurrent !== false ? callerSessionToken : "";
      
      if (keepCurrentToken) {
        await query(`
          UPDATE admin.usuario_sesion
          SET estado = 'REVOCADA', ultima_actividad = CURRENT_TIMESTAMP
          WHERE usuario_id = $1 AND UPPER(estado) = 'ACTIVA' AND token_identificador != $2
        `, [userId, keepCurrentToken]);
      } else {
        await query(`
          UPDATE admin.usuario_sesion
          SET estado = 'REVOCADA', ultima_actividad = CURRENT_TIMESTAMP
          WHERE usuario_id = $1 AND UPPER(estado) = 'ACTIVA'
        `, [userId]);
      }

      // Record audit
      await query(`
        INSERT INTO admin.usuario_auditoria
        (auditoria_id, usuario_id, admin_id, fecha_hora, accion, valor_anterior, valor_nuevo, motivo, resultado, direccion_ip, dispositivo)
        VALUES
        ((SELECT COALESCE(MAX(auditoria_id), 0) + 1 FROM admin.usuario_auditoria), $1, $2, CURRENT_TIMESTAMP, 'ALL_SESSIONS_REVOKED', 'Estado: ACTIVAS', 'Estado: REVOCADAS', 'Revocación masiva de sesiones por administrador', 'COMPLETADO', $3, $4)
      `, [userId, callerUserId, ip, device]).catch(err => console.error("Audit error:", err));

      return NextResponse.json({ success: true, message: "Todas las sesiones activas han sido revocadas exitosamente." });
    }

    if (body.sessionId) {
      const sessionIdNum = parseInt(String(body.sessionId).replace(/\D/g, ""), 10);
      
      await query(`
        UPDATE admin.usuario_sesion
        SET estado = 'REVOCADA', ultima_actividad = CURRENT_TIMESTAMP
        WHERE usuario_id = $1 AND sesion_id = $2
      `, [userId, sessionIdNum]);

      // Record audit
      await query(`
        INSERT INTO admin.usuario_auditoria
        (auditoria_id, usuario_id, admin_id, fecha_hora, accion, valor_anterior, valor_nuevo, motivo, resultado, direccion_ip, dispositivo)
        VALUES
        ((SELECT COALESCE(MAX(auditoria_id), 0) + 1 FROM admin.usuario_auditoria), $1, $2, CURRENT_TIMESTAMP, 'SESSION_REVOKED', 'Estado: ACTIVA', 'Estado: REVOCADA', $3, 'COMPLETADO', $4, $5)
      `, [userId, callerUserId, `Revocación de sesión ID ${sessionIdNum}`, ip, device]).catch(err => console.error("Audit error:", err));

      return NextResponse.json({ success: true, message: "La sesión ha sido revocada exitosamente." });
    }

    return NextResponse.json({ success: false, error: "Parámetros insuficientes." }, { status: 400 });
  } catch (error: any) {
    console.error("Error revoking usuario_sesion:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
