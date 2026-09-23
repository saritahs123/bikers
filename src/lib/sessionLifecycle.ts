import { query } from "@/lib/db";
import { hashSessionToken } from "@/lib/auth";

export const SESSION_ACTIVITY_THROTTLE_SECONDS = 120; // 2 minutes throttling

export interface SessionLifecycleRecord {
  sesion_id: number;
  usuario_id: number;
  token_identificador: string;
  dispositivo_navegador: string | null;
  direccion_ip: string | null;
  ubicacion: string | null;
  fecha_inicio: string | null;
  ultima_actividad: string | null;
  fecha_expiracion: string | null;
  estado: string;
  fecha_cierre: string | null;
  tipo_cierre: string | null;
  motivo_cierre: string | null;
  revocado_por: number | null;
  fecha_revocacion: string | null;
  duracion_sesion_minutos?: number | null;
}

export type ValidateSessionResult =
  | { valid: true; session: SessionLifecycleRecord; userId: number; updatedActivity: boolean }
  | { valid: false; reason: "NO_TOKEN" | "NOT_FOUND" | "REVOKED" | "CLOSED" | "EXPIRED" | "INACTIVE"; status: 401; session?: SessionLifecycleRecord };

/**
 * Validates a session token, checks natural expiration, and updates ultima_actividad with throttling.
 * If expired (NOW() > fecha_expiracion), transitions estado = 'EXPIRADA' and persists the closure cause.
 */
export async function validateAndTouchSession(rawToken?: string | null): Promise<ValidateSessionResult> {
  if (!rawToken || !rawToken.trim()) {
    return { valid: false, reason: "NO_TOKEN", status: 401 };
  }

  const tokenClean = rawToken.trim();
  const tokenHash = hashSessionToken(tokenClean);

  try {
    const rows = await query<SessionLifecycleRecord>(
      `SELECT
         s.sesion_id,
         s.usuario_id,
         s.token_identificador,
         s.dispositivo_navegador,
         s.direccion_ip,
         s.ubicacion,
         s.fecha_inicio,
         s.ultima_actividad,
         s.fecha_expiracion,
         s.estado,
         s.fecha_cierre,
         s.tipo_cierre,
         s.motivo_cierre,
         s.revocado_por,
         s.fecha_revocacion,
         u.duracion_sesion_minutos
       FROM admin.usuario_sesion s
       LEFT JOIN admin.usuario u ON s.usuario_id = u.usuario_id
       WHERE s.token_identificador = $1
       LIMIT 1`,
      [tokenHash]
    );

    if (!rows || rows.length === 0) {
      return { valid: false, reason: "NOT_FOUND", status: 401 };
    }

    const session = rows[0];

    // 1. Explicit revoked check
    if (session.estado === "REVOCADA") {
      return { valid: false, reason: "REVOKED", status: 401, session };
    }

    // 2. Explicit closed check
    if (session.estado === "CERRADA") {
      return { valid: false, reason: "CLOSED", status: 401, session };
    }

    // 3. Explicit expired check
    if (session.estado === "EXPIRADA") {
      return { valid: false, reason: "EXPIRED", status: 401, session };
    }

    // 4. Any other non-active state
    if (session.estado !== "ACTIVA") {
      return { valid: false, reason: "INACTIVE", status: 401, session };
    }

    // 5. Check natural expiration against fecha_expiracion or newly configured user duration
    if (session.fecha_inicio && session.duracion_sesion_minutos) {
      const startTime = new Date(session.fecha_inicio).getTime();
      const configuredDurationMs = Number(session.duracion_sesion_minutos) * 60 * 1000;
      const expectedExpirationTime = startTime + configuredDurationMs;
      const currentExpirationTime = session.fecha_expiracion ? new Date(session.fecha_expiracion).getTime() : 0;

      if (Math.abs(expectedExpirationTime - currentExpirationTime) > 1000) {
        session.fecha_expiracion = new Date(expectedExpirationTime).toISOString();
        await query(
          `UPDATE admin.usuario_sesion
           SET fecha_expiracion = fecha_inicio + make_interval(mins => $1)
           WHERE sesion_id = $2 AND estado = 'ACTIVA'`,
          [session.duracion_sesion_minutos, session.sesion_id]
        ).catch(err => console.warn("Could not sync session expiration:", err));
      }
    }

    if (session.fecha_expiracion) {
      const expirationDate = new Date(session.fecha_expiracion);
      if (!isNaN(expirationDate.getTime()) && expirationDate.getTime() <= Date.now()) {
        // Persist natural expiration in PostgreSQL
        await query(
          `UPDATE admin.usuario_sesion
           SET estado = 'EXPIRADA',
               fecha_cierre = clock_timestamp(),
               tipo_cierre = 'EXPIRACION',
               motivo_cierre = 'Sesión expirada por tiempo máximo configurado'
           WHERE sesion_id = $1 AND estado = 'ACTIVA'`,
          [session.sesion_id]
        ).catch(err => console.warn("Could not persist session expiration:", err));

        session.estado = 'EXPIRADA';
        session.tipo_cierre = 'EXPIRACION';
        session.motivo_cierre = 'Sesión expirada por tiempo máximo configurado';
        return { valid: false, reason: "EXPIRED", status: 401, session };
      }
    }

    // 6. Throttling of ultima_actividad (every 120 seconds)
    const lastActivityTime = session.ultima_actividad ? new Date(session.ultima_actividad).getTime() : 0;
    const nowTime = Date.now();
    const shouldUpdateActivity = (nowTime - lastActivityTime) > (SESSION_ACTIVITY_THROTTLE_SECONDS * 1000);

    if (shouldUpdateActivity) {
      await query(
        `UPDATE admin.usuario_sesion
         SET ultima_actividad = clock_timestamp()
         WHERE sesion_id = $1`,
        [session.sesion_id]
      ).catch(err => console.warn("Could not update session activity:", err));

      await query(
        `UPDATE admin.usuario_seguridad
         SET fecha_ultimo_acceso = clock_timestamp()
         WHERE usuario_id = $1`,
        [session.usuario_id]
      ).catch(err => console.warn("Could not update usuario_seguridad last access:", err));

      return { valid: true, session, userId: session.usuario_id, updatedActivity: true };
    }

    return { valid: true, session, userId: session.usuario_id, updatedActivity: false };
  } catch (error) {
    console.error("validateAndTouchSession error:", error);
    return { valid: false, reason: "NOT_FOUND", status: 401 };
  }
}

/**
 * Closes an active session on user logout
 */
export async function closeSession(params: {
  rawToken?: string | null;
  userId?: number | null;
  motivo?: string;
}): Promise<boolean> {
  const { rawToken, userId, motivo } = params;
  if (!rawToken && !userId) return false;

  const tokenClean = rawToken ? rawToken.trim() : null;
  const tokenHash = tokenClean ? hashSessionToken(tokenClean) : null;
  const motivoCierre = motivo || "Cierre de sesión voluntario por el usuario";

  try {
    if (tokenHash) {
      await query(
        `UPDATE admin.usuario_sesion
         SET estado = 'CERRADA',
             fecha_cierre = clock_timestamp(),
             tipo_cierre = 'LOGOUT',
             motivo_cierre = $1,
             ultima_actividad = clock_timestamp()
         WHERE token_identificador = $2
           AND estado = 'ACTIVA'`,
        [motivoCierre, tokenHash]
      );
    } else if (userId) {
      await query(
        `UPDATE admin.usuario_sesion
         SET estado = 'CERRADA',
             fecha_cierre = clock_timestamp(),
             tipo_cierre = 'LOGOUT',
             motivo_cierre = $1,
             ultima_actividad = clock_timestamp()
         WHERE usuario_id = $2
           AND estado = 'ACTIVA'`,
        [motivoCierre, userId]
      );
    }
    return true;
  } catch (error) {
    console.error("closeSession error:", error);
    return false;
  }
}

/**
 * Administratively revokes a single session
 */
export async function revokeSession(params: {
  sessionId: number;
  adminId: number;
  motivo?: string;
}): Promise<boolean> {
  const { sessionId, adminId, motivo } = params;
  const motivoRevocacion = motivo || "Sesión revocada administrativamente";

  try {
    await query(
      `UPDATE admin.usuario_sesion
       SET estado = 'REVOCADA',
           fecha_cierre = clock_timestamp(),
           fecha_revocacion = clock_timestamp(),
           revocado_por = $1,
           tipo_cierre = 'REVOCACION',
           motivo_cierre = $2,
           ultima_actividad = clock_timestamp()
       WHERE sesion_id = $3`,
      [adminId, motivoRevocacion, sessionId]
    );
    return true;
  } catch (error) {
    console.error("revokeSession error:", error);
    return false;
  }
}

/**
 * Administratively revokes all active sessions for a target user
 */
export async function revokeAllUserSessions(params: {
  targetUserId: number;
  adminId: number;
  motivo?: string;
  excludeSessionId?: number;
}): Promise<number> {
  const { targetUserId, adminId, motivo, excludeSessionId } = params;
  const motivoRevocacion = motivo || "Revocación masiva de sesiones por administrador";

  try {
    let sql = `
      UPDATE admin.usuario_sesion
      SET estado = 'REVOCADA',
          fecha_cierre = clock_timestamp(),
          fecha_revocacion = clock_timestamp(),
          revocado_por = $1,
          tipo_cierre = 'REVOCACION',
          motivo_cierre = $2,
          ultima_actividad = clock_timestamp()
      WHERE usuario_id = $3
        AND estado = 'ACTIVA'
    `;
    const queryParams: (number | string)[] = [adminId, motivoRevocacion, targetUserId];

    if (excludeSessionId) {
      sql += ` AND sesion_id != $4`;
      queryParams.push(excludeSessionId);
    }

    const res = await query(sql, queryParams);
    return (res as { rowCount?: number })?.rowCount || 0;
  } catch (error) {
    console.error("revokeAllUserSessions error:", error);
    return 0;
  }
}

/**
 * Global sweep: Transitions all sessions whose fecha_expiracion <= clock_timestamp() to 'EXPIRADA'
 */
export async function sweepExpiredSessions(): Promise<number> {
  try {
    const expiredRows = await query<{ sesion_id: number }>(
      `UPDATE admin.usuario_sesion
       SET estado = 'EXPIRADA',
           fecha_cierre = COALESCE(fecha_expiracion, clock_timestamp()),
           tipo_cierre = 'EXPIRACION',
           motivo_cierre = 'Sesión expirada por límite de tiempo'
       WHERE estado = 'ACTIVA'
         AND fecha_expiracion <= clock_timestamp()
       RETURNING sesion_id`
    );
    return expiredRows.length;
  } catch (err) {
    console.warn("sweepExpiredSessions error:", err);
    return 0;
  }
}

declare global {
  var __sessionSweeperStarted: boolean | undefined;
}

/**
 * Initializes a background sweeper running in the Node.js server
 */
export function initSessionSweeper() {
  if (typeof window !== "undefined") return;
  if (global.__sessionSweeperStarted) return;
  global.__sessionSweeperStarted = true;

  // Run immediate sweep on startup
  sweepExpiredSessions().catch(() => {});

  // Run periodic sweep every 20 seconds
  const timer = setInterval(() => {
    sweepExpiredSessions().catch(() => {});
  }, 20000);

  if (typeof timer.unref === "function") {
    timer.unref();
  }
}

// Automatically start background sweeper on server initialization
if (typeof window === "undefined") {
  initSessionSweeper();
}
