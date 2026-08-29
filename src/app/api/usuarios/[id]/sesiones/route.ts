import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { authorizeUserAccess } from "@/lib/userAuth";
import { recordUserActivity, recordUserAudit } from "@/lib/auditLogger";
import { hashSessionToken } from "@/lib/auth";
import { revokeSession, revokeAllUserSessions } from "@/lib/sessionLifecycle";

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
    const authResult = await authorizeUserAccess(id);

    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const userId = authResult.targetUserId;
    const cookieStore = await cookies();
    const callerSessionToken = cookieStore.get("session_token")?.value || "";
    const callerTokenHash = callerSessionToken ? hashSessionToken(callerSessionToken) : "";

    const sql = `
      SELECT 
        s.*,
        COALESCE(
          NULLIF(TRIM(ui.nombre || ' ' || ui.apellido), ''),
          ui.correo_electronico,
          'Admin #' || s.revocado_por::text
        ) AS revocado_por_nombre
      FROM admin.usuario_sesion s
      LEFT JOIN admin.usuario_identidad ui ON s.revocado_por = ui.usuario_id
      WHERE s.usuario_id = $1
      ORDER BY s.fecha_inicio DESC, s.ultima_actividad DESC
    `;

    const rows = await query(sql, [userId]);
    const nowMs = Date.now();

    const mapped = (rows || []).map((r: any) => {
      const rawState = (r.estado || 'ACTIVA').toUpperCase();
      const startMs = r.fecha_inicio ? new Date(r.fecha_inicio).getTime() : nowMs;
      const lastActMs = r.ultima_actividad ? new Date(r.ultima_actividad).getTime() : startMs;
      const expMs = r.fecha_expiracion ? new Date(r.fecha_expiracion).getTime() : null;
      const cierreMs = r.fecha_cierre ? new Date(r.fecha_cierre).getTime() : null;

      let derivedState = rawState;
      if (expMs && expMs < nowMs && rawState === 'ACTIVA') {
        derivedState = 'EXPIRADA';
      } else if (rawState === 'ACTIVA') {
        const minsInactive = (nowMs - lastActMs) / (1000 * 60);
        if (minsInactive > SESSION_STALE_MINUTES) {
          derivedState = 'POSIBLEMENTE COLGADA';
        }
      }

      const isCurrent = Boolean(
        callerTokenHash &&
        r.token_identificador === callerTokenHash
      );

      const endMsForDuration = (derivedState === 'ACTIVA' || derivedState === 'POSIBLEMENTE COLGADA')
        ? nowMs
        : (cierreMs || lastActMs);
      const durationFormatted = formatDuration(startMs, endMsForDuration);

      return {
        id: r.sesion_id,
        sesion_id: r.sesion_id,
        usuario_id: r.usuario_id,
        device: r.dispositivo_navegador || "No registrado",
        dispositivo_navegador: r.dispositivo_navegador || "No registrado",
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
        revocado_por: r.revocado_por || null,
        revocado_por_nombre: r.revocado_por_nombre || null,
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
    const authResult = await authorizeUserAccess(id);

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const userId = authResult.targetUserId;
    const callerUserId = authResult.authUserId;
    const body = await req.json();

    const cookieStore = await cookies();
    const callerSessionToken = cookieStore.get("session_token")?.value || "";

    if (body.revokeAll) {
      let excludeSessionId: number | undefined;
      if (body.keepCurrent !== false && callerSessionToken) {
        const callerHash = hashSessionToken(callerSessionToken);
        const curRes = await query<{ sesion_id: number }>(
          `SELECT sesion_id FROM admin.usuario_sesion WHERE token_identificador = $1 LIMIT 1`,
          [callerHash]
        );
        if (curRes && curRes.length > 0) {
          excludeSessionId = curRes[0].sesion_id;
        }
      }

      await revokeAllUserSessions({
        targetUserId: userId,
        adminId: callerUserId,
        motivo: body.motivo || 'Revocación masiva de sesiones por administrador',
        excludeSessionId
      });

      // Record audit
      await recordUserAudit({
        userId,
        adminId: callerUserId,
        accion: 'ALL_SESSIONS_REVOKED',
        valorAnterior: 'Estado: ACTIVAS',
        valorNuevo: 'Estado: REVOCADAS',
        motivo: body.motivo || 'Revocación masiva de sesiones por administrador',
        resultado: 'COMPLETADO',
        req
      });

      // Record activity
      await recordUserActivity({
        userId,
        modulo: 'Seguridad',
        evento: 'REVOCAR_TODAS_SESIONES',
        descripcion: 'Revocación masiva de todas las sesiones activas por administrador',
        resultado: 'Exitoso',
        req
      });

      return NextResponse.json({ success: true, message: "Todas las sesiones activas han sido revocadas exitosamente." });
    }

    if (body.sessionId) {
      const sessionIdNum = parseInt(String(body.sessionId).replace(/\D/g, ""), 10);

      await revokeSession({
        sessionId: sessionIdNum,
        adminId: callerUserId,
        motivo: body.motivo || `Revocación administrativa de sesión ID #${sessionIdNum}`
      });

      // Record audit
      await recordUserAudit({
        userId,
        adminId: callerUserId,
        accion: 'SESSION_REVOKED',
        valorAnterior: 'Estado: ACTIVA',
        valorNuevo: 'Estado: REVOCADA',
        motivo: body.motivo || `Revocación de sesión ID #${sessionIdNum}`,
        resultado: 'COMPLETADO',
        req
      });

      // Record activity
      await recordUserActivity({
        userId,
        modulo: 'Seguridad',
        evento: 'REVOCAR_SESION',
        descripcion: `Revocación de sesión ID #${sessionIdNum} por administrador`,
        resultado: 'Exitoso',
        req
      });

      return NextResponse.json({ success: true, message: "La sesión ha sido revocada exitosamente." });
    }

    return NextResponse.json({ success: false, error: "Parámetros insuficientes." }, { status: 400 });
  } catch (error: any) {
    console.error("Error revoking usuario_sesion:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
