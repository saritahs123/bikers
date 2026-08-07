"use server";

import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";

const GENERIC_ERROR_MESSAGE = "Usuario o contraseña incorrectos";

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
}

export async function loginAction(formData: FormData) {
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");

  const email = String(rawEmail || "").trim().toLowerCase();
  const password = String(rawPassword || "");

  // Strict input sanitization & length limits
  if (!email || !password || email.length > 255 || password.length > 128) {
    throw new Error(GENERIC_ERROR_MESSAGE);
  }

  // Basic email syntax format check
  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  if (!emailRegex.test(email)) {
    throw new Error(GENERIC_ERROR_MESSAGE);
  }

  const reqHeaders = await headers();
  const userAgentRaw = reqHeaders.get("user-agent");
  const device = parseUserAgent(userAgentRaw);
  const ip = reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || reqHeaders.get("x-real-ip") || "127.0.0.1";

  let targetUser: UserDbRecord | null = null;

  try {
    const result = await query(
      `SELECT
         u.usuario_id,
         u.estado AS usuario_estado,
         us.password AS password_hash,
         us.intentos_fallidos,
         us.bloqueado_hasta,
         us.intentos_fallidos_permitidos
       FROM admin.usuario_identidad ui
       JOIN admin.usuario u ON ui.usuario_id = u.usuario_id
       LEFT JOIN admin.usuario_seguridad us ON u.usuario_id = us.usuario_id
       WHERE LOWER(ui.correo_electronico) = $1
       LIMIT 1`,
      [email]
    );

    if (result && result.length > 0) {
      targetUser = result[0];
    }
  } catch (dbError) {
    console.error("Database query failure during login authentication:", dbError);
    throw new Error(GENERIC_ERROR_MESSAGE);
  }

  // 1. Check if user exists, is active, and has security credentials
  if (!targetUser || targetUser.usuario_estado !== 'ACTIVO' || !targetUser.password_hash) {
    throw new Error(GENERIC_ERROR_MESSAGE);
  }

  const userId = targetUser.usuario_id;

  // 2. Check account locking state (bloqueado_hasta)
  if (targetUser.bloqueado_hasta) {
    const lockExpiry = new Date(targetUser.bloqueado_hasta);
    if (lockExpiry > new Date()) {
      // Account currently locked - return generic error message
      throw new Error(GENERIC_ERROR_MESSAGE);
    }
  }

  // 3. Verify password hash using scrypt utility
  const isPasswordValid = verifyPassword(password, targetUser.password_hash);

  if (!isPasswordValid) {
    // Atomic increment of failed attempts and automatic 15-minute lock upon 5 failed attempts
    try {
      await query(
        `UPDATE admin.usuario_seguridad
         SET
           intentos_fallidos = COALESCE(intentos_fallidos, 0) + 1,
           bloqueado_hasta = CASE
             WHEN COALESCE(intentos_fallidos, 0) + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
             ELSE bloqueado_hasta
           END,
           motivo_bloqueo = CASE
             WHEN COALESCE(intentos_fallidos, 0) + 1 >= 5 THEN 'Bloqueo automático por 5 intentos fallidos consecutivos'
             ELSE motivo_bloqueo
           END
         WHERE usuario_id = $1`,
        [userId]
      );

      await query(
        `INSERT INTO admin.usuario_auditoria
         (auditoria_id, usuario_id, admin_id, fecha_hora, accion, valor_anterior, valor_nuevo, motivo, resultado, direccion_ip, dispositivo)
         VALUES
         ((SELECT COALESCE(MAX(auditoria_id), 0) + 1 FROM admin.usuario_auditoria), $1, $1, CURRENT_TIMESTAMP, 'LOGIN_FAILED', 'Intentos fallidos', 'Intento fallido', 'Contraseña incorrecta', 'FALLIDO', $2, $3)`,
        [userId, ip, device]
      ).catch(e => console.error("Error inserting login failure audit:", e));
    } catch (err) {
      console.error("Failed to record failed login attempt in database:", err);
    }

    throw new Error(GENERIC_ERROR_MESSAGE);
  }

  // 4. Successful Login: Reset failed attempts counter and clear locks
  try {
    await query(
      `UPDATE admin.usuario_seguridad
       SET
         intentos_fallidos = 0,
         bloqueado_hasta = NULL,
         motivo_bloqueo = NULL,
         fecha_ultimo_acceso = CURRENT_TIMESTAMP
       WHERE usuario_id = $1`,
      [userId]
    );
  } catch (err) {
    console.error("Failed to reset failed attempts on successful login:", err);
  }

  // 5. Generate secure session token and record active session
  const sessionToken = `ses_${crypto.randomUUID().replace(/-/g, "")}`;

  try {
    await query(
      `INSERT INTO admin.usuario_sesion
       (sesion_id, usuario_id, token_identificador, dispositivo_navegador, direccion_ip, ubicacion, fecha_inicio, ultima_actividad, fecha_expiracion, estado)
       VALUES
       ((SELECT COALESCE(MAX(sesion_id), 0) + 1 FROM admin.usuario_sesion), $1, $2, $3, $4, 'No disponible', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NOW() + INTERVAL '7 days', 'ACTIVA')`,
      [userId, sessionToken, device, ip]
    );

    await query(
      `INSERT INTO admin.usuario_auditoria
       (auditoria_id, usuario_id, admin_id, fecha_hora, accion, valor_anterior, valor_nuevo, motivo, resultado, direccion_ip, dispositivo)
       VALUES
       ((SELECT COALESCE(MAX(auditoria_id), 0) + 1 FROM admin.usuario_auditoria), $1, $1, CURRENT_TIMESTAMP, 'SESSION_CREATED', 'Sin sesión', $2, 'Inicio de sesión exitoso con contraseña validada', 'COMPLETADO', $3, $4)`,
      [userId, `Token: ${sessionToken.substring(0, 10)}...`, ip, device]
    );
  } catch (err) {
    console.error("Error inserting session and audit record:", err);
  }

  const cookieStore = await cookies();
  cookieStore.set("session_user_id", userId.toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  cookieStore.set("session_token", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  redirect("/");
}
