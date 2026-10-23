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
import { validateAndTouchSession } from "@/lib/sessionLifecycle";
import { isSuperAdmin } from "@/lib/workshop-session";

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

  let sessionToken: string | undefined;
  try {
    const cookieStore = await cookies();
    sessionToken = cookieStore.get("session_token")?.value;
  } catch {
    sessionToken = process.env.TEST_AUTH_SESSION_TOKEN;
  }

  if (!sessionToken) {
    return {
      success: false,
      status: 401,
      error: "UNAUTHORIZED",
      message: "No autenticado. Token de sesión no proporcionado."
    };
  }

  const validation = await validateAndTouchSession(sessionToken);
  if (!validation.valid) {
    const errorMap: Record<string, string> = {
      REVOKED: "Su sesión fue revocada. Por favor, vuelva a iniciar sesión.",
      CLOSED: "La sesión ha sido cerrada.",
      EXPIRED: "La sesión ha expirado por límite de tiempo.",
      NOT_FOUND: "Sesión inválida o expirada."
    };
    return {
      success: false,
      status: 401,
      error: validation.reason === "REVOKED" ? "SESSION_REVOKED" : (validation.reason === "EXPIRED" ? "SESSION_EXPIRED" : "UNAUTHORIZED"),
      message: errorMap[validation.reason] || "Sesión inválida o expirada."
    };
  }

  const authUserId = validation.userId;

  const authUserRows = await query<{ empresa_id: number | null }>(
    `SELECT empresa_id FROM admin.usuario WHERE usuario_id = $1 LIMIT 1`,
    [authUserId]
  );
  const authUserCompanyId = authUserRows?.[0]?.empresa_id ?? null;

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

  // 4. Company Scope Check (Must belong to same company if both companies are specified and caller is not global admin)
  const callerIsSuper = await isSuperAdmin(authUserId);
  let hasGlobalScope = callerIsSuper;
  if (!hasGlobalScope) {
    const scopeCheck = await query(
      `SELECT 1 FROM admin.usuario_alcance WHERE usuario_id = $1 AND nivel_alcance = 'TODA_EMPRESA' LIMIT 1`,
      [authUserId]
    );
    hasGlobalScope = Boolean(scopeCheck && scopeCheck.length > 0);
  }

  if (!hasGlobalScope) {
    if (authUserCompanyId && targetUserCompanyId && authUserCompanyId !== targetUserCompanyId) {
      return {
        success: false,
        status: 403,
        error: "FORBIDDEN",
        message: "Acceso denegado. El usuario solicitado pertenece a otra empresa."
      };
    }
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
 * - Company Scope Check (HTTP 403 if non-global users belong to different companies)
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

  let sessionToken: string | undefined;
  try {
    const cookieStore = await cookies();
    sessionToken = cookieStore.get("session_token")?.value;
  } catch {
    sessionToken = process.env.TEST_AUTH_SESSION_TOKEN;
  }

  if (!sessionToken) {
    return {
      success: false,
      status: 401,
      error: "UNAUTHORIZED",
      message: "No autenticado. Token de sesión no proporcionado."
    };
  }

  const validation = await validateAndTouchSession(sessionToken);
  if (!validation.valid) {
    const errorMap: Record<string, string> = {
      REVOKED: "Su sesión fue revocada. Por favor, vuelva a iniciar sesión.",
      CLOSED: "La sesión ha sido cerrada.",
      EXPIRED: "La sesión ha expirado por límite de tiempo.",
      NOT_FOUND: "Sesión inválida o expirada."
    };
    return {
      success: false,
      status: 401,
      error: validation.reason === "REVOKED" ? "SESSION_REVOKED" : (validation.reason === "EXPIRED" ? "SESSION_EXPIRED" : "UNAUTHORIZED"),
      message: errorMap[validation.reason] || "Sesión inválida o expirada."
    };
  }

  const authUserId = validation.userId;

  // Block operation if caller has mandatory password change pending
  const callerSec = await query<{ forzar_cambio_clave: boolean | null; requiere_cambio_clave: boolean | null }>(
    `SELECT forzar_cambio_clave, requiere_cambio_clave FROM admin.usuario_seguridad WHERE usuario_id = $1 LIMIT 1`,
    [authUserId]
  );
  if (callerSec && callerSec.length > 0 && (callerSec[0].forzar_cambio_clave || callerSec[0].requiere_cambio_clave)) {
    return {
      success: false,
      status: 403,
      error: "PASSWORD_CHANGE_REQUIRED",
      message: "Debe actualizar su contraseña antes de realizar operaciones en el sistema."
    };
  }

  const authUserRows = await query<{ empresa_id: number | null }>(
    `SELECT empresa_id FROM admin.usuario WHERE usuario_id = $1 LIMIT 1`,
    [authUserId]
  );
  const authUserCompanyId = authUserRows?.[0]?.empresa_id ?? null;

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

  // Check if target user has Role 1 (SuperAdmin) and caller is not SuperAdmin
  const targetIsSuper = await isSuperAdmin(targetUserId);
  const callerIsSuper = await isSuperAdmin(authUserId);

  if (targetIsSuper && !callerIsSuper) {
    return {
      success: false,
      status: 403,
      error: "FORBIDDEN",
      message: "Acceso denegado. Solo un SuperAdmin institucional puede modificar una cuenta con Rol 1 (Administrador General)."
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

  let hasGlobalScope = callerIsSuper;
  if (!hasGlobalScope) {
    const scopeCheck = await query(
      `SELECT 1 FROM admin.usuario_alcance WHERE usuario_id = $1 AND nivel_alcance = 'TODA_EMPRESA' LIMIT 1`,
      [authUserId]
    );
    hasGlobalScope = Boolean(scopeCheck && scopeCheck.length > 0);
  }

  if (!hasGlobalScope) {
    if (
      authUserCompanyId &&
      targetUserCompanyId &&
      authUserCompanyId !== targetUserCompanyId
    ) {
      return {
        success: false,
        status: 403,
        error: "FORBIDDEN",
        message: "Acceso denegado. El usuario a modificar pertenece a otra empresa."
      };
    }
  }

  return {
    success: true,
    authUserId,
    targetUserId,
    isSelf: false,
    authUserCompanyId
  };
}

export type AuthCreateResult =
  | { success: true; authUserId: number; authUserCompanyId: number | null }
  | { success: false; status: 400 | 401 | 403; error: string; message: string; field?: string };

/**
 * Centralized User Creation Authorization
 * - Checks active session_token in admin.usuario_sesion (HTTP 401 if missing/expired)
 * - Strict Creation Permission Check: SEGURIDAD module requiring puede_crear = true across effective roles
 * - Company Scope Check: HTTP 403 if non-global user tries to create a user for another company
 */
export async function authorizeUserCreate(targetCompanyId?: number | null): Promise<AuthCreateResult> {
  let sessionToken: string | undefined;
  try {
    const cookieStore = await cookies();
    sessionToken = cookieStore.get("session_token")?.value;
  } catch {
    sessionToken = process.env.TEST_AUTH_SESSION_TOKEN;
  }

  if (!sessionToken) {
    return {
      success: false,
      status: 401,
      error: "UNAUTHORIZED",
      message: "No autenticado. Token de sesión no proporcionado."
    };
  }

  const validation = await validateAndTouchSession(sessionToken);
  if (!validation.valid) {
    const errorMap: Record<string, string> = {
      REVOKED: "Su sesión fue revocada. Por favor, vuelva a iniciar sesión.",
      CLOSED: "La sesión ha sido cerrada.",
      EXPIRED: "La sesión ha expirado por límite de tiempo.",
      NOT_FOUND: "Sesión inválida o expirada."
    };
    return {
      success: false,
      status: 401,
      error: validation.reason === "REVOKED" ? "SESSION_REVOKED" : (validation.reason === "EXPIRED" ? "SESSION_EXPIRED" : "UNAUTHORIZED"),
      message: errorMap[validation.reason] || "Sesión inválida o expirada."
    };
  }

  const authUserId = validation.userId;

  // Block operation if caller has mandatory password change pending
  const callerSecCreate = await query<{ forzar_cambio_clave: boolean | null; requiere_cambio_clave: boolean | null }>(
    `SELECT forzar_cambio_clave, requiere_cambio_clave FROM admin.usuario_seguridad WHERE usuario_id = $1 LIMIT 1`,
    [authUserId]
  );
  if (callerSecCreate && callerSecCreate.length > 0 && (callerSecCreate[0].forzar_cambio_clave || callerSecCreate[0].requiere_cambio_clave)) {
    return {
      success: false,
      status: 403,
      error: "PASSWORD_CHANGE_REQUIRED",
      message: "Debe actualizar su contraseña antes de crear usuarios en el sistema."
    };
  }

  const authUserRows = await query<{ empresa_id: number | null }>(
    `SELECT empresa_id FROM admin.usuario WHERE usuario_id = $1 LIMIT 1`,
    [authUserId]
  );
  const authUserCompanyId = authUserRows?.[0]?.empresa_id ?? null;

  // Strict check: ONLY puede_crear = true on module 'SEGURIDAD'
  const createPermission = await query(
    `SELECT 1
     FROM admin.matriz_acceso_rol m
     JOIN admin.modulo_sistema mod ON m.modulo_sistema_id = mod.modulo_sistema_id
     WHERE m.rol_funcional_id IN (
       SELECT u.rol_principal_id FROM admin.usuario u WHERE u.usuario_id = $1 AND u.rol_principal_id IS NOT NULL
       UNION
       SELECT ura.rol_funcional_id FROM admin.usuario_rol_adicional ura WHERE ura.usuario_id = $1
     )
     AND mod.nombre = 'SEGURIDAD'
     AND m.puede_crear = true
     LIMIT 1`,
    [authUserId]
  );

  const canCreate = createPermission && createPermission.length > 0;
  if (!canCreate) {
    return {
      success: false,
      status: 403,
      error: "FORBIDDEN",
      message: "Acceso denegado. Se requiere permiso de creación en el módulo SEGURIDAD para crear nuevos usuarios."
    };
  }

  const callerIsSuper = await isSuperAdmin(authUserId);
  let hasGlobalScope = callerIsSuper;
  if (!hasGlobalScope) {
    const scopeCheck = await query(
      `SELECT 1 FROM admin.usuario_alcance WHERE usuario_id = $1 AND nivel_alcance = 'TODA_EMPRESA' LIMIT 1`,
      [authUserId]
    );
    hasGlobalScope = Boolean(scopeCheck && scopeCheck.length > 0);
  }

  if (!hasGlobalScope) {
    if (
      authUserCompanyId != null &&
      targetCompanyId != null &&
      Number(authUserCompanyId) !== Number(targetCompanyId)
    ) {
      return {
        success: false,
        status: 403,
        error: "FORBIDDEN",
        message: "Acceso denegado. No posee permisos para crear usuarios en otra empresa."
      };
    }
  }

  return {
    success: true,
    authUserId,
    authUserCompanyId
  };
}

/**
 * Extrae el rol principal de un payload independientemente de la clave o formato utilizado.
 */
export function extractPrimaryRoleId(body: Record<string, unknown>): unknown {
  if (!body || typeof body !== 'object') return undefined;
  return body.roleId ?? body.rol_id ?? body.rol_principal_id ?? body.role_id ?? body.role;
}

/**
 * Extrae los roles adicionales de un payload independientemente de la clave o formato utilizado.
 */
export function extractAdditionalRoles(body: Record<string, unknown>): unknown {
  if (!body || typeof body !== 'object') return undefined;
  return body.roles_additional ?? body.roles_adicionales ?? body.additional_roles;
}

/**
 * Resolución y validación estricta de un rol funcional.
 * - Verifica existencia en admin.rol_funcional
 * - Verifica que el estado sea 'ACTIVO'
 * - Impide la asignación del Rol 1 si el ejecutor no es SuperAdmin
 */
export async function resolveAndValidateRole(
  rawRole: unknown,
  callerIsSuperAdmin: boolean,
  isMandatory: boolean = false
): Promise<{
  valid: boolean;
  status: 400 | 403;
  error: string;
  message: string;
  field?: string;
  roleId?: number;
}> {
  if (rawRole === undefined || rawRole === null || rawRole === '') {
    if (isMandatory) {
      return {
        valid: false,
        status: 400,
        error: "VALIDATION_ERROR",
        message: "El rol principal es obligatorio.",
        field: "roleId"
      };
    }
    return {
      valid: true,
      status: 400,
      error: "",
      message: "",
      roleId: undefined
    };
  }

  let resolvedId: number | null = null;

  if (typeof rawRole === 'number') {
    resolvedId = Number.isInteger(rawRole) && rawRole > 0 ? rawRole : null;
  } else if (typeof rawRole === 'string') {
    const trimmed = rawRole.trim();
    if (/^\d+$/.test(trimmed)) {
      resolvedId = parseInt(trimmed, 10);
    } else if (trimmed.length > 0) {
      const rRes = await query<{ rol_funcional_id: number }>(
        `SELECT rol_funcional_id FROM admin.rol_funcional WHERE UPPER(nombre) = UPPER($1) LIMIT 1`,
        [trimmed]
      );
      if (rRes && rRes.length > 0) {
        resolvedId = rRes[0].rol_funcional_id;
      }
    }
  } else if (typeof rawRole === 'object' && rawRole !== null) {
    const obj = rawRole as Record<string, unknown>;
    const candidate = obj.id ?? obj.rol_funcional_id ?? obj.rol_id;
    if (candidate !== undefined && candidate !== null) {
      const num = Number(candidate);
      if (Number.isInteger(num) && num > 0) {
        resolvedId = num;
      }
    }
  }

  if (resolvedId === null || isNaN(resolvedId) || resolvedId <= 0) {
    return {
      valid: false,
      status: 400,
      error: "VALIDATION_ERROR",
      message: "El rol principal especificado no es válido o no existe.",
      field: "roleId"
    };
  }

  // Verificar en la base de datos existencia y estado
  const roleRows = await query<{ rol_funcional_id: number; nombre: string; estado: string }>(
    `SELECT rol_funcional_id, nombre, estado FROM admin.rol_funcional WHERE rol_funcional_id = $1 LIMIT 1`,
    [resolvedId]
  );

  if (!roleRows || roleRows.length === 0) {
    return {
      valid: false,
      status: 400,
      error: "VALIDATION_ERROR",
      message: "El rol principal especificado no existe.",
      field: "roleId"
    };
  }

  if (roleRows[0].estado !== 'ACTIVO') {
    return {
      valid: false,
      status: 400,
      error: "VALIDATION_ERROR",
      message: "El rol principal especificado se encuentra inactivo.",
      field: "roleId"
    };
  }

  // Blindaje Rol 1: Solo SuperAdmin institucional puede asignarlo
  if (resolvedId === 1 && !callerIsSuperAdmin) {
    return {
      valid: false,
      status: 403,
      error: "FORBIDDEN",
      message: "Acceso denegado. Solo un SuperAdmin institucional puede asignar el Rol 1 (Administrador General).",
      field: "roleId"
    };
  }

  return {
    valid: true,
    status: 400,
    error: "",
    message: "",
    roleId: resolvedId
  };
}

/**
 * Validación y resolución de roles adicionales (`roles_additional`).
 * - Verifica estructura (debe ser arreglo)
 * - Rechaza duplicados
 * - Rechaza roles iguales al rol principal
 * - Verifica existencia y estado 'ACTIVO'
 * - Impide la asignación del Rol 1 si el ejecutor no es SuperAdmin
 */
export async function resolveAndValidateAdditionalRoles(
  rawAdd: unknown,
  callerIsSuperAdmin: boolean,
  primaryRoleId?: number | null
): Promise<{
  valid: boolean;
  status: 400 | 403;
  error: string;
  message: string;
  field?: string;
  roleIds: number[];
}> {
  if (rawAdd === undefined || rawAdd === null) {
    return {
      valid: true,
      status: 400,
      error: "",
      message: "",
      roleIds: []
    };
  }

  if (!Array.isArray(rawAdd)) {
    return {
      valid: false,
      status: 400,
      error: "VALIDATION_ERROR",
      message: "El campo de roles adicionales debe ser un arreglo.",
      field: "roles_additional",
      roleIds: []
    };
  }

  if (rawAdd.length === 0) {
    return {
      valid: true,
      status: 400,
      error: "",
      message: "",
      roleIds: []
    };
  }

  const roleIds: number[] = [];
  const seen = new Set<number>();

  for (const item of rawAdd) {
    let id: number | null = null;
    if (typeof item === 'number') {
      id = Number.isInteger(item) && item > 0 ? item : null;
    } else if (typeof item === 'string') {
      const trimmed = item.trim();
      if (/^\d+$/.test(trimmed)) {
        id = parseInt(trimmed, 10);
      } else {
        const rRes = await query<{ rol_funcional_id: number }>(
          `SELECT rol_funcional_id FROM admin.rol_funcional WHERE UPPER(nombre) = UPPER($1) LIMIT 1`,
          [trimmed]
        );
        if (rRes && rRes.length > 0) {
          id = rRes[0].rol_funcional_id;
        }
      }
    } else if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      const candidate = obj.id ?? obj.rol_funcional_id ?? obj.rol_id;
      if (candidate !== undefined && candidate !== null) {
        const num = Number(candidate);
        if (Number.isInteger(num) && num > 0) id = num;
      }
    }

    if (id === null || isNaN(id) || id <= 0) {
      return {
        valid: false,
        status: 400,
        error: "VALIDATION_ERROR",
        message: "El arreglo de roles adicionales contiene identificadores inválidos.",
        field: "roles_additional",
        roleIds: []
      };
    }

    if (seen.has(id)) {
      return {
        valid: false,
        status: 400,
        error: "VALIDATION_ERROR",
        message: "No se permiten roles adicionales duplicados.",
        field: "roles_additional",
        roleIds: []
      };
    }
    seen.add(id);

    if (primaryRoleId && id === primaryRoleId) {
      return {
        valid: false,
        status: 400,
        error: "VALIDATION_ERROR",
        message: "Un rol no puede ser asignado simultáneamente como rol principal y adicional.",
        field: "roles_additional",
        roleIds: []
      };
    }

    // Blindaje Rol 1 en adicionales
    if (id === 1 && !callerIsSuperAdmin) {
      return {
        valid: false,
        status: 403,
        error: "FORBIDDEN",
        message: "Acceso denegado. Solo un SuperAdmin institucional puede asignar el Rol 1 como rol adicional.",
        field: "roles_additional",
        roleIds: []
      };
    }

    // Validar existencia y estado
    const rCheck = await query<{ rol_funcional_id: number; estado: string }>(
      `SELECT rol_funcional_id, estado FROM admin.rol_funcional WHERE rol_funcional_id = $1 LIMIT 1`,
      [id]
    );

    if (!rCheck || rCheck.length === 0) {
      return {
        valid: false,
        status: 400,
        error: "VALIDATION_ERROR",
        message: "Uno o más roles adicionales especificados no existen.",
        field: "roles_additional",
        roleIds: []
      };
    }

    if (rCheck[0].estado !== 'ACTIVO') {
      return {
        valid: false,
        status: 400,
        error: "VALIDATION_ERROR",
        message: "Uno o más roles adicionales especificados se encuentran inactivos.",
        field: "roles_additional",
        roleIds: []
      };
    }

    roleIds.push(id);
  }

  return {
    valid: true,
    status: 400,
    error: "",
    message: "",
    roleIds
  };
}

/**
 * Guardia Anti-Autoescalamiento Estricta (Self-Profile Guard).
 * Se aplica SIEMPRE que un usuario intente modificar su propia cuenta (isSelf === true).
 * Ningún usuario (ni siquiera SuperAdmin ni administradores con permisos de edición)
 * puede modificar atributos administrativos/privilegiados mediante el endpoint ordinario de perfil.
 */
export function validateSelfProfileUpdate(
  body: Record<string, unknown>,
  current: Record<string, unknown>
): {
  allowed: boolean;
  status: 400 | 403;
  error: string;
  message: string;
  field?: string;
} {
  const isChanged = (newVal: unknown, oldVal: unknown): boolean => {
    if (newVal === undefined || newVal === null) return false;
    return String(newVal).trim() !== String(oldVal ?? '').trim();
  };

  // 1. Rol principal
  const triedRole = extractPrimaryRoleId(body);
  if (triedRole !== undefined && triedRole !== null && String(triedRole).trim() !== '') {
    const isDifferent = String(triedRole).trim() !== String(current.rol_principal_id ?? '').trim() &&
                        String(triedRole).trim().toUpperCase() !== String(current.rol_nombre ?? '').trim().toUpperCase();
    if (isDifferent) {
      return {
        allowed: false,
        status: 403,
        error: "FORBIDDEN",
        message: "No posee permisos para modificar el rol de su propia cuenta.",
        field: "roleId"
      };
    }
  }

  // 2. Roles adicionales
  const triedAdd = extractAdditionalRoles(body);
  if (triedAdd !== undefined && triedAdd !== null) {
    return {
      allowed: false,
      status: 403,
      error: "FORBIDDEN",
      message: "No posee permisos para modificar roles adicionales de su propia cuenta.",
      field: "roles_additional"
    };
  }

  // 3. Empresa
  const triedCompany = body.companyId ?? body.empresa_id;
  if (isChanged(triedCompany, current.empresa_id)) {
    return {
      allowed: false,
      status: 403,
      error: "FORBIDDEN",
      message: "No posee permisos para modificar la empresa de su propia cuenta.",
      field: "companyId"
    };
  }
  if (body.empresa_nombre !== undefined && body.empresa_nombre !== null && isChanged(body.empresa_nombre, current.empresa_nombre)) {
    return {
      allowed: false,
      status: 403,
      error: "FORBIDDEN",
      message: "No posee permisos para modificar la empresa de su propia cuenta.",
      field: "companyId"
    };
  }

  // 4. Ámbito de seguridad / Alcance
  if (
    body.scope_type !== undefined ||
    body.nivel_alcance !== undefined ||
    body.scope_entity_ids !== undefined ||
    body.include_children !== undefined ||
    body.incluir_herencia_jerarquica !== undefined
  ) {
    return {
      allowed: false,
      status: 403,
      error: "FORBIDDEN",
      message: "No posee permisos para modificar el ámbito de seguridad o alcance de su propia cuenta.",
      field: "scope_type"
    };
  }

  // 5. Estado administrativo de la cuenta
  const triedStatus = body.status ?? body.estado;
  if (isChanged(triedStatus, current.estado)) {
    return {
      allowed: false,
      status: 403,
      error: "FORBIDDEN",
      message: "No posee permisos para modificar el estado administrativo de su propia cuenta.",
      field: "estado"
    };
  }

  // 6. Estado de activación
  const triedActivation = body.estado_activacion ?? body.activation;
  if (isChanged(triedActivation, current.estado_activacion)) {
    return {
      allowed: false,
      status: 403,
      error: "FORBIDDEN",
      message: "No posee permisos para modificar el estado de activación de su propia cuenta.",
      field: "estado_activacion"
    };
  }

  // 7. Tipo de usuario
  const triedUserType = body.user_type_id ?? body.tipo_usuario_id ?? body.userTypeId;
  if (isChanged(triedUserType, current.tipo_usuario_id)) {
    return {
      allowed: false,
      status: 403,
      error: "FORBIDDEN",
      message: "No posee permisos para modificar el tipo de usuario de su propia cuenta.",
      field: "tipo_usuario_id"
    };
  }

  // 8. Duración de sesión
  if (
    body.duracion_sesion_minutos !== undefined &&
    current.duracion_sesion_minutos !== undefined &&
    Number(body.duracion_sesion_minutos) !== Number(current.duracion_sesion_minutos)
  ) {
    return {
      allowed: false,
      status: 403,
      error: "FORBIDDEN",
      message: "No posee permisos para modificar la duración de sesión de su propia cuenta.",
      field: "duracion_sesion_minutos"
    };
  }

  // 9. Permisos personalizados
  if (body.permissionsOverride !== undefined || body.permisos_personalizados !== undefined) {
    return {
      allowed: false,
      status: 403,
      error: "FORBIDDEN",
      message: "No posee permisos para modificar permisos personalizados de su propia cuenta.",
      field: "permissionsOverride"
    };
  }

  // 10. Contraseña y credenciales (debe usar flujo específico de cambio de contraseña)
  if (body.password !== undefined || body.confirm_password !== undefined) {
    return {
      allowed: false,
      status: 403,
      error: "FORBIDDEN",
      message: "La actualización de contraseña de su propia cuenta debe realizarse mediante el flujo seguro de cambio de clave.",
      field: "password"
    };
  }

  // 11. Políticas de seguridad y MFA
  if (
    body.forzar_cambio_clave !== undefined ||
    body.requiere_cambio_clave !== undefined ||
    body.mfaEnabled !== undefined ||
    body.mfa_activo !== undefined ||
    body.mfa_tipo !== undefined ||
    body.mfa_method !== undefined
  ) {
    return {
      allowed: false,
      status: 403,
      error: "FORBIDDEN",
      message: "No posee permisos para modificar políticas de seguridad o autenticación de su propia cuenta.",
      field: "mfaEnabled"
    };
  }

  return {
    allowed: true,
    status: 400,
    error: "",
    message: ""
  };
}
