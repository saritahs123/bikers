import { query } from "@/lib/db";
import { headers } from "next/headers";

export function parseDeviceFromUserAgent(ua: string | null | undefined): string | null {
  if (!ua || !ua.trim()) return null;
  
  let browser = "Navegador";
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";
  else if (ua.includes("Opera/") || ua.includes("OPR/")) browser = "Opera";

  let os = "Desktop";
  if (ua.includes("Windows NT 10.0")) os = "Windows 10/11";
  else if (ua.includes("Windows NT 6.1")) os = "Windows 7";
  else if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  return `${browser} - ${os}`;
}

export async function extractClientInfo(req?: Request) {
  let ip: string | null = null;
  let rawUa: string | null = null;

  if (req) {
    const xForwarded = req.headers.get("x-forwarded-for");
    const xReal = req.headers.get("x-real-ip");
    ip = xForwarded ? xForwarded.split(",")[0].trim() : (xReal || null);
    rawUa = req.headers.get("user-agent");
  } else {
    try {
      const reqHeaders = await headers();
      const xForwarded = reqHeaders.get("x-forwarded-for");
      const xReal = reqHeaders.get("x-real-ip");
      ip = xForwarded ? xForwarded.split(",")[0].trim() : (xReal || null);
      rawUa = reqHeaders.get("user-agent");
    } catch {
      // Out of request context
    }
  }

  const dispositivo = parseDeviceFromUserAgent(rawUa) || (rawUa ? rawUa.substring(0, 100) : null);
  return { ip, rawUa, dispositivo };
}

/**
 * Sanitizes any data payload before persisting to audit logs.
 * Strips presigned URLs, AWS credentials, auth tokens, passwords, cookies, etc.
 */
export function sanitizeAuditPayload(data: any): any {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(sanitizeAuditPayload);

  const clean: Record<string, any> = {};
  const forbiddenPatterns = ["password", "token", "hash", "secret", "cookie", "auth", "credential", "signature", "x-amz-", "key_secret"];

  for (const [k, v] of Object.entries(data)) {
    const keyLower = k.toLowerCase();
    const isForbidden = forbiddenPatterns.some(p => keyLower.includes(p));

    if (isForbidden) {
      clean[k] = "[REDACTED]";
      continue;
    }

    // Strip presigned AWS URLs (leave only logical S3 key or relative path)
    if (typeof v === "string" && (v.includes("X-Amz-Signature") || v.includes("X-Amz-Credential") || (v.startsWith("http") && v.includes(".s3.")))) {
      clean[k] = "[S3_PRESIGNED_URL_REDACTED]";
      continue;
    }

    if (v !== null && typeof v === "object" && !(v instanceof Date)) {
      clean[k] = sanitizeAuditPayload(v);
    } else {
      clean[k] = v;
    }
  }

  return clean;
}

/**
 * Computes difference between before and after states.
 * Returns only modified keys to ensure lean, forensic audit trails.
 */
export function computeDiff(
  before: Record<string, any> = {},
  after: Record<string, any> = {},
  ignoreKeys: string[] = ["fecha_modificacion", "usuario_modificacion", "fecha_actualizacion", "usuario_actualizacion", "fecha_creacion", "usuario_creacion"]
) {
  const diffBefore: Record<string, any> = {};
  const diffAfter: Record<string, any> = {};
  const allKeys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));

  for (const key of allKeys) {
    if (ignoreKeys.includes(key)) continue;

    const valBefore = before?.[key] !== undefined ? before[key] : null;
    const valAfter = after?.[key] !== undefined ? after[key] : null;

    const normBefore = valBefore instanceof Date ? valBefore.toISOString() : valBefore;
    const normAfter = valAfter instanceof Date ? valAfter.toISOString() : valAfter;

    if (JSON.stringify(normBefore) !== JSON.stringify(normAfter)) {
      diffBefore[key] = normBefore;
      diffAfter[key] = normAfter;
    }
  }

  const cleanBefore = sanitizeAuditPayload(diffBefore);
  const cleanAfter = sanitizeAuditPayload(diffAfter);

  const hasChanges = Object.keys(cleanAfter).length > 0 || Object.keys(cleanBefore).length > 0;

  return {
    hasChanges,
    diffBefore: cleanBefore,
    diffAfter: cleanAfter,
    valorAnterior: Object.keys(cleanBefore).length > 0 ? JSON.stringify(cleanBefore) : null,
    valorNuevo: Object.keys(cleanAfter).length > 0 ? JSON.stringify(cleanAfter) : null,
  };
}

export interface RecordActivityParams {
  userId: number;
  modulo: string;
  evento: string;
  descripcion?: string | null;
  resultado?: string;
  req?: Request;
  ip?: string | null;
  dispositivo?: string | null;
}

/**
 * Centralized User Activity Logger
 * Persists operational events directly to admin.usuario_actividad
 */
export async function recordUserActivity(params: RecordActivityParams): Promise<boolean> {
  try {
    const { userId, modulo, evento, descripcion = null, resultado = 'Exitoso', req } = params;
    if (!userId || !modulo || !evento) return false;

    let ip = params.ip;
    let dispositivo = params.dispositivo;

    if (!ip || !dispositivo) {
      const clientInfo = await extractClientInfo(req);
      if (!ip) ip = clientInfo.ip;
      if (!dispositivo) dispositivo = clientInfo.dispositivo;
    }

    await query(
      `INSERT INTO admin.usuario_actividad 
       (usuario_id, fecha_hora, modulo, evento, descripcion, resultado, direccion_ip, dispositivo)
       VALUES 
       ($1, NOW(), $2, $3, $4, $5, $6, $7)`,
      [
        Number(userId),
        String(modulo).trim(),
        String(evento).trim(),
        descripcion ? String(descripcion).trim() : null,
        String(resultado).trim(),
        ip || null,
        dispositivo || null
      ]
    );

    return true;
  } catch (error) {
    console.error("Failed to record user activity in PostgreSQL:", error);
    return false;
  }
}

export interface RecordAuditParams {
  userId: number;
  adminId?: number | null;
  accion: string;
  valorAnterior?: string | null;
  valorNuevo?: string | null;
  motivo?: string | null;
  resultado?: string;
  req?: Request;
  ip?: string | null;
  dispositivo?: string | null;
}

/**
 * Centralized User Audit Logger
 * Persists administrative/security changes directly to admin.usuario_auditoria
 */
export async function recordUserAudit(params: RecordAuditParams): Promise<boolean> {
  try {
    const { userId, adminId = null, accion, valorAnterior = null, valorNuevo = null, motivo = null, resultado = 'COMPLETADO', req } = params;
    if (!userId || !accion) return false;

    let ip = params.ip;
    let dispositivo = params.dispositivo;

    if (!ip || !dispositivo) {
      const clientInfo = await extractClientInfo(req);
      if (!ip) ip = clientInfo.ip;
      if (!dispositivo) dispositivo = clientInfo.dispositivo;
    }

    await query(
      `INSERT INTO admin.usuario_auditoria
       (usuario_id, admin_id, fecha_hora, accion, valor_anterior, valor_nuevo, motivo, resultado, direccion_ip, dispositivo)
       VALUES
       ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9)`,
      [
        Number(userId),
        adminId ? Number(adminId) : null,
        String(accion).trim(),
        valorAnterior ? String(valorAnterior) : null,
        valorNuevo ? String(valorNuevo) : null,
        motivo ? String(motivo).trim() : null,
        String(resultado).trim(),
        ip || null,
        dispositivo || null
      ]
    );

    return true;
  } catch (error) {
    console.error("Failed to record user audit in PostgreSQL:", error);
    return false;
  }
}
