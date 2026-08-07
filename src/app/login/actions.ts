"use server";

import { query } from "@/lib/db";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";

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

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email) {
    throw new Error("Email required");
  }

  const reqHeaders = await headers();
  const userAgentRaw = reqHeaders.get("user-agent");
  const device = parseUserAgent(userAgentRaw);
  const ip = reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || reqHeaders.get("x-real-ip") || "127.0.0.1";

  // Find user by email in admin.usuario_identidad or admin.usuario
  let targetUserId = 1;
  const result = await query(
    "SELECT usuario_id FROM admin.usuario_identidad WHERE correo_electronico = $1 LIMIT 1",
    [email]
  );

  if (result.length > 0) {
    targetUserId = result[0].usuario_id;
  }

  const sessionToken = `ses_${crypto.randomUUID().replace(/-/g, "")}`;
  
  // Insert new session in admin.usuario_sesion
  await query(
    `INSERT INTO admin.usuario_sesion 
     (sesion_id, usuario_id, token_identificador, dispositivo_navegador, direccion_ip, ubicacion, fecha_inicio, ultima_actividad, fecha_expiracion, estado)
     VALUES 
     ((SELECT COALESCE(MAX(sesion_id), 0) + 1 FROM admin.usuario_sesion), $1, $2, $3, $4, 'No disponible', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NOW() + INTERVAL '7 days', 'ACTIVA')`,
    [targetUserId, sessionToken, device, ip]
  ).catch(err => console.error("Error inserting usuario_sesion on login:", err));

  // Insert audit record
  await query(
    `INSERT INTO admin.usuario_auditoria
     (auditoria_id, usuario_id, admin_id, fecha_hora, accion, valor_anterior, valor_nuevo, motivo, resultado, direccion_ip, dispositivo)
     VALUES 
     ((SELECT COALESCE(MAX(auditoria_id), 0) + 1 FROM admin.usuario_auditoria), $1, $1, CURRENT_TIMESTAMP, 'SESSION_CREATED', 'Sin sesión', $2, 'Inicio de sesión exitoso', 'COMPLETADO', $3, $4)`,
    [targetUserId, `Token: ${sessionToken.substring(0, 10)}...`, ip, device]
  ).catch(err => console.error("Error inserting audit on login:", err));

  const cookieStore = await cookies();
  cookieStore.set("session_user_id", targetUserId.toString(), {
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
