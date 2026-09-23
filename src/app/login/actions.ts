"use server";

import { query } from "@/lib/db";
import { verifyPassword, hashSessionToken } from "@/lib/auth";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { recordUserActivity } from "@/lib/auditLogger";
import { sweepExpiredSessions } from "@/lib/sessionLifecycle";

const GENERIC_FUNC_ERROR = "Usuario o contraseña inválidos.";
const EMPTY_BOTH_ERROR = "Ingrese usuario y contraseña.";
const GENERIC_TECH_ERROR = "No fue posible iniciar sesión en este momento. Inténtalo nuevamente.";

function parseUserAgent(ua: string | null): string {
  if (!ua) return "Navegador Desconocido";
  let browser = "Navegador Web";
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";

  let os = "Desktop";
  if (ua.includes("Windows NT 10.0")) os = "Windows 10/11";
  else if (ua.includes("Windows NT 6.1")) os = "Windows 7";
  else if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  return `${browser} - ${os}`;
}

interface UserDbRecord {
  usuario_id: number;
  usuario_estado: string;
  duracion_sesion_minutos?: number | null;
  password_hash: string | null;
  intentos_fallidos: number | null;
  bloqueado_hasta: string | Date | null;
  intentos_fallidos_permitidos: number | null;
  metodo_acceso_principal: string | null;
  identificador_principal: string | null;
  forzar_cambio_clave?: boolean | null;
  requiere_cambio_clave?: boolean | null;
}

export type LoginState = {
  success?: boolean;
  type?: "validation" | "auth" | "tech";
  error?: string;
} | null;

export async function loginAction(
  previousState: LoginState,
  formData: FormData
): Promise<LoginState> {
  try {
    const rawIdentifier = formData.get("identifier");
    const rawPassword = formData.get("password");

    const identifier = String(rawIdentifier || "").trim();
    const password = String(rawPassword || "");

    // 1. Completely empty form check (NO DB query executed)
    if (!identifier && !password) {
      return { success: false, type: "validation", error: EMPTY_BOTH_ERROR };
    }

    // 2. Partial data entered (missing either user or password, or excessive length)
    if (!identifier || !password || identifier.length > 255 || password.length > 128) {
      return { success: false, type: "auth", error: GENERIC_FUNC_ERROR };
    }

    const reqHeaders = await headers();
    const userAgentRaw = reqHeaders.get("user-agent");
    const device = parseUserAgent(userAgentRaw);
    const ip = reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || reqHeaders.get("x-real-ip") || null;

    let targetUser: UserDbRecord | null = null;

    // 3. Query PostgreSQL matching identificador_principal (LIMIT 2)
    try {
      const results = await query<UserDbRecord>(
        `SELECT
           u.usuario_id,
           u.estado AS usuario_estado,
           u.duracion_sesion_minutos,
           us.password AS password_hash,
           us.intentos_fallidos,
           us.bloqueado_hasta,
           us.intentos_fallidos_permitidos,
           us.metodo_acceso_principal,
           us.identificador_principal,
           us.forzar_cambio_clave,
           us.requiere_cambio_clave
         FROM admin.usuario u
         JOIN admin.usuario_seguridad us ON u.usuario_id = us.usuario_id
         WHERE (
           LOWER(us.identificador_principal) = LOWER($1)
           OR REPLACE(REPLACE(us.identificador_principal, '-', ''), ' ', '') = REPLACE(REPLACE($1, '-', ''), ' ', '')
         )
         LIMIT 2`,
        [identifier]
      );

      if (!results || results.length === 0) {
        return { success: false, type: "auth", error: GENERIC_FUNC_ERROR };
      }

      if (results.length > 1) {
        console.error(`CRITICAL INTEGRITY ERROR: Non-unique identificador_principal matches (${results.length}) found`);
        return { success: false, type: "tech", error: GENERIC_TECH_ERROR };
      }

      targetUser = results[0];
    } catch (dbError) {
      console.error("Technical failure querying database for authentication:", dbError);
      return { success: false, type: "tech", error: GENERIC_TECH_ERROR };
    }

    // 4. Method-based Access Format Verification
    const rawMethod = String(targetUser.metodo_acceso_principal || "").trim().toLowerCase();
    const isEmailMethod = rawMethod === "email" || rawMethod.includes("correo");
    const isDocumentMethod = rawMethod === "document" || rawMethod.includes("cédula") || rawMethod.includes("cedula") || rawMethod.includes("pasaporte");

    if (isEmailMethod) {
      if ((targetUser.identificador_principal || "").toLowerCase() !== identifier.toLowerCase()) {
        return { success: false, type: "auth", error: GENERIC_FUNC_ERROR };
      }
    } else if (isDocumentMethod) {
      const normDbDoc = (targetUser.identificador_principal || "").replace(/[- ]/g, "");
      const normInputDoc = identifier.replace(/[- ]/g, "");
      if (targetUser.identificador_principal !== identifier && normDbDoc !== normInputDoc) {
        return { success: false, type: "auth", error: GENERIC_FUNC_ERROR };
      }
    }

    // 5. Verify user active status & security credentials
    if (targetUser.usuario_estado !== 'ACTIVO' || !targetUser.password_hash) {
      return { success: false, type: "auth", error: GENERIC_FUNC_ERROR };
    }

    // 6. Account Lock Verification
    if (targetUser.bloqueado_hasta) {
      const lockExpiry = new Date(targetUser.bloqueado_hasta);
      if (lockExpiry > new Date()) {
        return { success: false, type: "auth", error: GENERIC_FUNC_ERROR };
      }
    }

    // 7. Password Hash Verification
    const isPasswordValid = verifyPassword(password, targetUser.password_hash);
    if (!isPasswordValid) {
      try {
        await query(
          `UPDATE admin.usuario_seguridad
           SET
             intentos_fallidos = COALESCE(intentos_fallidos, 0) + 1,
             bloqueado_hasta = CASE
               WHEN COALESCE(intentos_fallidos, 0) + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
               ELSE bloqueado_hasta
             END
           WHERE usuario_id = $1`,
          [targetUser.usuario_id]
        );

        // Record failed login in activity log
        await recordUserActivity({
          userId: targetUser.usuario_id,
          modulo: 'Seguridad',
          evento: 'LOGIN',
          descripcion: 'Intento de inicio de sesión con contraseña incorrecta',
          resultado: 'Fallido',
          ip,
          dispositivo: device
        });
      } catch (e) {
        console.error("Technical error updating failed attempts counter:", e);
      }

      return { success: false, type: "auth", error: GENERIC_FUNC_ERROR };
    }

    // 8. Session Duration & Cookie Expiration Configuration based on DB user duration
    const sessionToken = `ses_${crypto.randomUUID().replace(/-/g, "")}`;
    const tokenHash = hashSessionToken(sessionToken);
    const sessionDurationMinutes = Math.max(1, Number(targetUser.duracion_sesion_minutos) || 480);

    try {
      await sweepExpiredSessions().catch(() => {});

      // Close previous active sessions for this user on login so only the new active session stays
      await query(
        `UPDATE admin.usuario_sesion
         SET estado = 'CERRADA',
             fecha_cierre = clock_timestamp(),
             tipo_cierre = 'NUEVO_LOGIN',
             motivo_cierre = 'Sustituida por nuevo inicio de sesión'
         WHERE usuario_id = $1 AND estado = 'ACTIVA'`,
        [targetUser.usuario_id]
      ).catch(() => {});

      await query(
        `UPDATE admin.usuario_seguridad
         SET
           intentos_fallidos = 0,
           bloqueado_hasta = NULL,
           motivo_bloqueo = NULL,
           fecha_ultimo_acceso = CURRENT_TIMESTAMP
         WHERE usuario_id = $1`,
        [targetUser.usuario_id]
      );

      await query(
        `INSERT INTO admin.usuario_sesion
         (usuario_id, token_identificador, dispositivo_navegador, direccion_ip, ubicacion, fecha_inicio, ultima_actividad, fecha_expiracion, estado)
         VALUES
         ($1, $2, $3, $4, 'No disponible', clock_timestamp(), clock_timestamp(), clock_timestamp() + make_interval(mins => $5), 'ACTIVA')`,
        [targetUser.usuario_id, tokenHash, device, ip, sessionDurationMinutes]
      );

      // Record successful login in activity log
      const userDisplayName = targetUser.identificador_principal || 'Usuario';
      await recordUserActivity({
        userId: targetUser.usuario_id,
        modulo: 'Seguridad',
        evento: 'LOGIN',
        descripcion: `${userDisplayName} inició sesión en la plataforma`,
        resultado: 'Exitoso',
        ip,
        dispositivo: device
      });

      const cookieStore = await cookies();
      const maxAgeSeconds = sessionDurationMinutes * 60;
      const baseCookieOptions: {
        httpOnly: boolean;
        secure: boolean;
        sameSite: "lax" | "strict" | "none";
        path: string;
        maxAge: number;
        expires: Date;
      } = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: maxAgeSeconds,
        expires: new Date(Date.now() + maxAgeSeconds * 1000)
      };

      cookieStore.set("session_user_id", targetUser.usuario_id.toString(), baseCookieOptions);
      cookieStore.set("session_token", sessionToken, baseCookieOptions);
    } catch (techErr) {
      console.error("Technical error establishing user session:", techErr);
      return { success: false, type: "tech", error: GENERIC_TECH_ERROR };
    }

    // 9. Redirect based on password change requirement
    const mustChangePassword = Boolean(targetUser.forzar_cambio_clave || targetUser.requiere_cambio_clave);
    if (mustChangePassword) {
      redirect("/change-password");
    } else {
      redirect("/");
    }
  } catch (err: unknown) {
    if (err && typeof err === "object" && "digest" in err && String((err as { digest: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    console.error("Unhandled technical error in loginAction:", err);
    return { success: false, type: "tech", error: GENERIC_TECH_ERROR };
  }
}
