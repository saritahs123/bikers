"use server";

import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";

const SESSION_DURATION_HOURS = 8;
const REMEMBER_ME_DURATION_DAYS = 30;

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
  password_hash: string | null;
  intentos_fallidos: number | null;
  bloqueado_hasta: string | Date | null;
  intentos_fallidos_permitidos: number | null;
  metodo_acceso_principal: string | null;
  identificador_principal: string | null;
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
    const rememberMe = formData.get("rememberMe") === "true";

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
    const ip = reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || reqHeaders.get("x-real-ip") || "127.0.0.1";

    let targetUser: UserDbRecord | null = null;

    // 3. Query PostgreSQL matching identificador_principal (LIMIT 2)
    try {
      const results = await query<UserDbRecord>(
        `SELECT
           u.usuario_id,
           u.estado AS usuario_estado,
           us.password AS password_hash,
           us.intentos_fallidos,
           us.bloqueado_hasta,
           us.intentos_fallidos_permitidos,
           us.metodo_acceso_principal,
           us.identificador_principal
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
      } catch (e) {
        console.error("Technical error updating failed attempts counter:", e);
      }

      return { success: false, type: "auth", error: GENERIC_FUNC_ERROR };
    }

    // 8. Session Duration & Cookie Expiration Configuration based on RememberMe
    const sessionToken = `ses_${crypto.randomUUID().replace(/-/g, "")}`;
    const intervalSql = rememberMe
      ? `${REMEMBER_ME_DURATION_DAYS} days`
      : `${SESSION_DURATION_HOURS} hours`;

    try {
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
         (sesion_id, usuario_id, token_identificador, dispositivo_navegador, direccion_ip, ubicacion, fecha_inicio, ultima_actividad, fecha_expiracion, estado)
         VALUES
         ((SELECT COALESCE(MAX(sesion_id), 0) + 1 FROM admin.usuario_sesion), $1, $2, $3, $4, 'No disponible', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NOW() + $5::interval, 'ACTIVA')`,
        [targetUser.usuario_id, sessionToken, device, ip, intervalSql]
      );

      const cookieStore = await cookies();
      const baseCookieOptions: any = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      };

      if (rememberMe) {
        const maxAgeSeconds = REMEMBER_ME_DURATION_DAYS * 24 * 60 * 60;
        baseCookieOptions.maxAge = maxAgeSeconds;
        baseCookieOptions.expires = new Date(Date.now() + maxAgeSeconds * 1000);
      }

      cookieStore.set("session_user_id", targetUser.usuario_id.toString(), baseCookieOptions);
      cookieStore.set("session_token", sessionToken, baseCookieOptions);
    } catch (techErr) {
      console.error("Technical error establishing user session:", techErr);
      return { success: false, type: "tech", error: GENERIC_TECH_ERROR };
    }

    // 9. Redirect on successful login
    redirect("/");
  } catch (err: any) {
    if (err && typeof err === "object" && "digest" in err && String(err.digest).startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    console.error("Unhandled technical error in loginAction:", err);
    return { success: false, type: "tech", error: GENERIC_TECH_ERROR };
  }
}
