import { cookies } from "next/headers";
import { query } from "@/lib/db";

export type AuthResult =
  | { success: true; authUserId: number; targetUserId: number; isSelf: boolean }
  | { success: false; status: 400 | 401 | 403 | 404; error: string; message: string };

/**
 * Strict ID Parser: Must be a string of pure digits, > 0 and <= 2147483647.
 * Rejects "0", "-1", "abc1", "1abc", "1.5", and out-of-range values with HTTP 400.
 */
export function parseAndValidateUserId(paramId: string): number | null {
  if (typeof paramId !== 'string') return null;
  const trimmed = paramId.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  
  const num = Number(trimmed);
  if (!Number.isInteger(num) || num <= 0 || num > 2147483647) return null;
  return num;
}

/**
 * Centralized User Access Authorization
 * - Validates integer ID (HTTP 400 if invalid)
 * - Checks active session_token in admin.usuario_sesion (HTTP 401 if missing/expired)
 * - Self-profile access (targetUserId === authUserId) -> HTTP 200 (Always Allowed)
 * - Target user existence check (HTTP 404 if target does not exist)
 * - Permission Matrix Check (SEGURIDAD module with canView: puede_ver OR puede_editar) across effective roles (rol_principal_id UNION usuario_rol_adicional)
 * - Company Scope Check (HTTP 403 if users belong to different non-null companies)
 */
export async function authorizeUserAccess(paramId: string): Promise<AuthResult> {
  const targetUserId = parseAndValidateUserId(paramId);
  if (targetUserId === null) {
    return {
      success: false,
      status: 400,
      error: "ID_INVALIDO",
      message: "El ID especificado no es un entero positivo válido."
    };
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;

  if (!sessionToken) {
    return {
      success: false,
      status: 401,
      error: "UNAUTHORIZED",
      message: "No autenticado. Token de sesión no proporcionado."
    };
  }

  const sessionRows = await query<{ usuario_id: number; empresa_id: number | null }>(
    `SELECT s.usuario_id, u.empresa_id
     FROM admin.usuario_sesion s
     JOIN admin.usuario u ON s.usuario_id = u.usuario_id
     WHERE s.token_identificador = $1 AND s.estado = 'ACTIVA'
     LIMIT 1`,
    [sessionToken]
  );

  if (!sessionRows || sessionRows.length === 0) {
    return {
      success: false,
      status: 401,
      error: "UNAUTHORIZED",
      message: "Sesión inválida o expirada."
    };
  }

  const authUserId = sessionRows[0].usuario_id;
  const authUserCompanyId = sessionRows[0].empresa_id;

  // 1. Self profile access -> Always allowed
  if (targetUserId === authUserId) {
    return { success: true, authUserId, targetUserId, isSelf: true };
  }

  // 2. Check if target user exists and get target user's company ID
  const targetUserRows = await query<{ usuario_id: number; empresa_id: number | null }>(
    `SELECT usuario_id, empresa_id FROM admin.usuario WHERE usuario_id = $1`,
    [targetUserId]
  );

  if (!targetUserRows || targetUserRows.length === 0) {
    return {
      success: false,
      status: 404,
      error: "NOT_FOUND",
      message: "Usuario no encontrado."
    };
  }

  const targetUserCompanyId = targetUserRows[0].empresa_id;

  // 3. Permission Matrix Check on effective roles (principal + adicionales) for canView (puede_ver OR puede_editar) on module 'SEGURIDAD'
  const matrixPermission = await query(
    `SELECT 1
     FROM admin.matriz_acceso_rol m
     JOIN admin.modulo_sistema mod ON m.modulo_sistema_id = mod.modulo_sistema_id
     WHERE m.rol_funcional_id IN (
       SELECT u.rol_principal_id FROM admin.usuario u WHERE u.usuario_id = $1 AND u.rol_principal_id IS NOT NULL
       UNION
       SELECT ura.rol_funcional_id FROM admin.usuario_rol_adicional ura WHERE ura.usuario_id = $1
     )
     AND mod.nombre = 'SEGURIDAD'
     AND (m.puede_ver = true OR m.puede_editar = true)
     LIMIT 1`,
    [authUserId]
  );

  const hasPermission = matrixPermission && matrixPermission.length > 0;
  if (!hasPermission) {
    return {
      success: false,
      status: 403,
      error: "FORBIDDEN",
      message: "Acceso denegado. No tiene permisos para consultar este usuario."
    };
  }

  // 4. Company Scope Check (Must belong to same company if both companies are specified)
  if (authUserCompanyId && targetUserCompanyId && authUserCompanyId !== targetUserCompanyId) {
    return {
      success: false,
      status: 403,
      error: "FORBIDDEN",
      message: "Acceso denegado. El usuario solicitado pertenece a otra empresa."
    };
  }

  return { success: true, authUserId, targetUserId, isSelf: false };
}

export type AuthUpdateResult =
  | { success: true; authUserId: number; targetUserId: number; isSelf: boolean; authUserCompanyId: number | null }
  | { success: false; status: 400 | 401 | 403 | 404; error: string; message: string; field?: string };

/**
 * Centralized User Update Authorization
 * - Validates integer ID (HTTP 400 if invalid)
 * - Checks active session_token in admin.usuario_sesion (HTTP 401 if missing/expired)
 * - Self-profile access (targetUserId === authUserId) -> isSelf: true (Allowed with whitelist)
 * - Target user existence check (HTTP 404 if target does not exist)
 * - Edit Permission Matrix Check (SEGURIDAD module requiring puede_editar = true) across effective roles
 * - Company Scope Check (HTTP 403 if users belong to different non-null companies)
 */
export async function authorizeUserUpdate(paramId: string): Promise<AuthUpdateResult> {
  const targetUserId = parseAndValidateUserId(paramId);
  if (targetUserId === null) {
    return {
      success: false,
      status: 400,
      error: "VALIDATION_ERROR",
      message: "El ID especificado no es un entero positivo válido.",
      field: "id"
    };
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;

  if (!sessionToken) {
    return {
      success: false,
      status: 401,
      error: "UNAUTHORIZED",
      message: "No autenticado. Token de sesión no proporcionado."
    };
  }

  const sessionRows = await query<{ usuario_id: number; empresa_id: number | null }>(
    `SELECT s.usuario_id, u.empresa_id
     FROM admin.usuario_sesion s
     JOIN admin.usuario u ON s.usuario_id = u.usuario_id
     WHERE s.token_identificador = $1 AND s.estado = 'ACTIVA'
     LIMIT 1`,
    [sessionToken]
  );

  if (!sessionRows || sessionRows.length === 0) {
    return {
      success: false,
      status: 401,
      error: "UNAUTHORIZED",
      message: "Sesión inválida o expirada."
    };
  }

  const authUserId = sessionRows[0].usuario_id;
  const authUserCompanyId = sessionRows[0].empresa_id;

  const targetUserRows = await query<{ usuario_id: number; empresa_id: number | null }>(
    `SELECT usuario_id, empresa_id FROM admin.usuario WHERE usuario_id = $1`,
    [targetUserId]
  );

  if (!targetUserRows || targetUserRows.length === 0) {
    return {
      success: false,
      status: 404,
      error: "NOT_FOUND",
      message: "Usuario no encontrado."
    };
  }

  const targetUserCompanyId = targetUserRows[0].empresa_id;

  if (targetUserId === authUserId) {
    return {
      success: true,
      authUserId,
      targetUserId,
      isSelf: true,
      authUserCompanyId
    };
  }

  const editPermission = await query(
    `SELECT 1
     FROM admin.matriz_acceso_rol m
     JOIN admin.modulo_sistema mod ON m.modulo_sistema_id = mod.modulo_sistema_id
     WHERE m.rol_funcional_id IN (
       SELECT u.rol_principal_id FROM admin.usuario u WHERE u.usuario_id = $1 AND u.rol_principal_id IS NOT NULL
       UNION
       SELECT ura.rol_funcional_id FROM admin.usuario_rol_adicional ura WHERE ura.usuario_id = $1
     )
     AND mod.nombre = 'SEGURIDAD'
     AND m.puede_editar = true
     LIMIT 1`,
    [authUserId]
  );

  const canEdit = editPermission && editPermission.length > 0;
  if (!canEdit) {
    return {
      success: false,
      status: 403,
      error: "FORBIDDEN",
      message: "Acceso denegado. Se requiere permiso de edición en el módulo SEGURIDAD para modificar otros usuarios."
    };
  }

  if (
    authUserCompanyId == null ||
    targetUserCompanyId == null ||
    authUserCompanyId !== targetUserCompanyId
  ) {
    return {
      success: false,
      status: 403,
      error: "FORBIDDEN",
      message: "Acceso denegado. El usuario a modificar pertenece a otra empresa o la empresa es nula."
    };
  }

  return {
    success: true,
    authUserId,
    targetUserId,
    isSelf: false,
    authUserCompanyId
  };
}
