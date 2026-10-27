import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { normalizeModuleCode } from "@/lib/moduleCode";
import { CANONICAL_NAVIGATION, normalizeCode, getRequiredActionForScreen } from "@/config/navigationConfig";

export interface WorkshopSession {
  usuario_id: number;
  empresa_id: number;
  rol_principal_id: number;
  nombre_usuario: string;
  email: string;
}

export interface ModulePermissions {
  puede_ver: boolean;
  puede_crear: boolean;
  puede_editar: boolean;
  puede_inactivar: boolean;
  puede_exportar: boolean;
  puede_importar: boolean;
  puede_aprobar: boolean;
  puede_asignar: boolean;
  puede_mover: boolean;
  puede_cerrar: boolean;
  puede_reabrir: boolean;
  puede_eliminar: boolean;
}

import { validateAndTouchSession } from "@/lib/sessionLifecycle";

export async function getWorkshopSession(): Promise<WorkshopSession | null> {
  try {
    let tokenCookie: string | undefined;
    try {
      const cookieStore = await cookies();
      tokenCookie = cookieStore.get("session_token")?.value;
    } catch {
      tokenCookie = process.env.TEST_AUTH_SESSION_TOKEN;
    }

    if (!tokenCookie || !tokenCookie.trim()) {
      return null;
    }

    const validation = await validateAndTouchSession(tokenCookie);
    if (!validation.valid) {
      return null;
    }

    const userRows = await query(
      `SELECT
         u.usuario_id,
         u.empresa_id,
         u.rol_principal_id,
         ui.nombre,
         ui.apellido,
         ui.correo_electronico AS email
       FROM admin.usuario u
       LEFT JOIN admin.usuario_identidad ui
         ON ui.usuario_id = u.usuario_id
       WHERE u.usuario_id = $1 AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
       LIMIT 1`,
      [validation.userId]
    );

    if (!userRows || userRows.length === 0) {
      return null;
    }

    const u = userRows[0];
    return {
      usuario_id: u.usuario_id,
      empresa_id: u.empresa_id,
      rol_principal_id: u.rol_principal_id,
      nombre_usuario: `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.email || 'Usuario',
      email: u.email || ''
    };
  } catch {
    return null;
  }
}

/**
 * Salvaguarda Institucional de Seguridad (Modelo B - GAP-06)
 * Recursos administrativos indispensables a los cuales el Administrador General (Rol 1)
 * conserva acceso garantizado e inmutable para prevenir bloqueos de administración.
 */
export const INSTITUTIONAL_SECURITY_SCREEN_CODES = new Set([
  "SEGURIDAD",
  "SEGURIDAD_USUARIOS",
  "SEGURIDAD_ROLES",
  "SEGURIDAD_PERMISOS",
  "SEGURIDAD_EMPRESAS",
  "SEGURIDAD_TIPOS_EMPRESA",
  "SEGURIDAD_TIPOS_USUARIO",
]);

export const INSTITUTIONAL_SECURITY_PATHS = new Set([
  "/settings/security/roles",
  "/settings/security/users",
  "/settings/security/permissions",
  "/settings/security/companies",
  "/settings/security/company-types",
  "/settings/security/user-types",
  "/settings/security/departments",
  "/settings/security/positions",
  "/settings/security/areas",
  "/settings/security/data-scopes",
]);

export function isInstitutionalSecurityTarget(target: string | number): boolean {
  if (typeof target === "number") {
    return target === 2; // modulo_sistema_id = 2 es SEGURIDAD
  }
  const clean = String(target).trim();
  const upper = clean.toUpperCase();
  if (upper === "SEGURIDAD") return true;
  if (INSTITUTIONAL_SECURITY_SCREEN_CODES.has(upper)) return true;
  if (INSTITUTIONAL_SECURITY_PATHS.has(clean)) return true;
  for (const path of INSTITUTIONAL_SECURITY_PATHS) {
    if (clean === path || clean.startsWith(path + "/") || clean.startsWith(path + "?")) {
      return true;
    }
  }
  return false;
}

export async function isSuperAdmin(usuarioId: number): Promise<boolean> {
  if (!usuarioId) return false;
  try {
    const rows = await query(
      `SELECT 1
       FROM admin.usuario u
       JOIN admin.rol_funcional r ON r.rol_funcional_id = 1 AND r.estado = 'ACTIVO'
       WHERE u.usuario_id = $1
         AND u.estado = 'ACTIVO'
         AND (
           u.rol_principal_id = 1
           OR EXISTS (
             SELECT 1 FROM admin.usuario_rol_adicional ura
             WHERE ura.usuario_id = u.usuario_id AND ura.rol_funcional_id = 1
           )
         )
       LIMIT 1`,
      [usuarioId]
    );
    return Boolean(rows && rows.length > 0);
  } catch {
    return false;
  }
}

export async function getModulePermissions(
  moduloNameOrId: string | number,
  usuarioId: number
): Promise<ModulePermissions> {
  const fullPerms: ModulePermissions = {
    puede_ver: true, puede_crear: true, puede_editar: true, puede_inactivar: true,
    puede_exportar: true, puede_importar: true, puede_aprobar: true, puede_asignar: true,
    puede_mover: true, puede_cerrar: true, puede_reabrir: true, puede_eliminar: true
  };

  const noPerms: ModulePermissions = {
    puede_ver: false, puede_crear: false, puede_editar: false, puede_inactivar: false,
    puede_exportar: false, puede_importar: false, puede_aprobar: false, puede_asignar: false,
    puede_mover: false, puede_cerrar: false, puede_reabrir: false, puede_eliminar: false
  };

  if (!usuarioId) return noPerms;

  try {
    // Verificar que el usuario exista y esté activo
    const userCheck = await query(
      `SELECT estado FROM admin.usuario WHERE usuario_id = $1 LIMIT 1`,
      [usuarioId]
    );
    if (!userCheck || userCheck.length === 0 || (userCheck[0].estado && userCheck[0].estado !== 'ACTIVO')) {
      return noPerms;
    }

    if ((await isSuperAdmin(usuarioId)) && isInstitutionalSecurityTarget(moduloNameOrId)) {
      return fullPerms;
    }

    const isId = typeof moduloNameOrId === 'number' || /^\d+$/.test(String(moduloNameOrId));
    const targetModule = isId ? Number(moduloNameOrId) : String(moduloNameOrId).toUpperCase();
    const targetCode = isId ? '' : normalizeModuleCode(String(moduloNameOrId));

    // 1. Obtener módulo objetivo: intenta por código canónico, con fallback a nombre
    let modRows: Array<{ modulo_sistema_id: number }> = [];
    if (isId) {
      modRows = (await query(
        `SELECT modulo_sistema_id FROM admin.modulo_sistema WHERE modulo_sistema_id = $1 LIMIT 1`,
        [targetModule]
      )) as Array<{ modulo_sistema_id: number }>;
    } else {
      if (targetCode) {
        try {
          modRows = await query(
            `SELECT modulo_sistema_id FROM admin.modulo_sistema WHERE codigo = $1 LIMIT 1`,
            [targetCode]
          );
        } catch {
          modRows = [];
        }
      }

      if (!modRows || modRows.length === 0) {
        modRows = await query(
          `SELECT modulo_sistema_id
           FROM admin.modulo_sistema
           WHERE UPPER(nombre) = UPPER($1)
              OR UPPER(TRANSLATE(nombre, 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou')) = UPPER(TRANSLATE($1, 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou'))
           LIMIT 1`,
          [targetModule]
        );
      }
    }

    if (!modRows || modRows.length === 0) {
      return noPerms;
    }
    const moduloId = modRows[0].modulo_sistema_id;

    // 2. Consulta con precedencia: Permiso personalizado de usuario > Unión de roles activos
    const rows = await query(
      `WITH user_roles AS (
         SELECT rf.rol_funcional_id
         FROM admin.rol_funcional rf
         WHERE rf.estado = 'ACTIVO'
           AND rf.rol_funcional_id IN (
             SELECT u.rol_principal_id FROM admin.usuario u WHERE u.usuario_id = $2 AND u.rol_principal_id IS NOT NULL AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
             UNION
             SELECT ura.rol_funcional_id FROM admin.usuario_rol_adicional ura JOIN admin.usuario u ON ura.usuario_id = u.usuario_id WHERE ura.usuario_id = $2 AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
           )
       ),
       user_custom AS (
         SELECT *
         FROM admin.usuario_permiso_personalizado
         WHERE usuario_id = $2 AND modulo_sistema_id = $1 AND pantalla_id IS NULL AND estado = 'ACTIVO'
         LIMIT 1
       ),
       role_perms AS (
         SELECT
           BOOL_OR(m.puede_ver) AS puede_ver,
           BOOL_OR(m.puede_crear) AS puede_crear,
           BOOL_OR(m.puede_editar) AS puede_editar,
           BOOL_OR(m.puede_inactivar) AS puede_inactivar,
           BOOL_OR(m.puede_exportar) AS puede_exportar,
           BOOL_OR(m.puede_importar) AS puede_importar,
           BOOL_OR(m.puede_aprobar) AS puede_aprobar,
           BOOL_OR(m.puede_asignar) AS puede_asignar,
           BOOL_OR(m.puede_mover) AS puede_mover,
           BOOL_OR(m.puede_cerrar) AS puede_cerrar,
           BOOL_OR(m.puede_reabrir) AS puede_reabrir,
           BOOL_OR(m.puede_eliminar) AS puede_eliminar
         FROM user_roles ur
         JOIN admin.matriz_acceso_rol m ON m.rol_funcional_id = ur.rol_funcional_id AND m.modulo_sistema_id = $1
       )
       SELECT
         COALESCE(uc.puede_ver, rp.puede_ver, false) AS puede_ver,
         COALESCE(uc.puede_crear, rp.puede_crear, false) AS puede_crear,
         COALESCE(uc.puede_editar, rp.puede_editar, false) AS puede_editar,
         COALESCE(uc.puede_inactivar, rp.puede_inactivar, false) AS puede_inactivar,
         COALESCE(uc.puede_exportar, rp.puede_exportar, false) AS puede_exportar,
         COALESCE(uc.puede_importar, rp.puede_importar, false) AS puede_importar,
         COALESCE(uc.puede_aprobar, rp.puede_aprobar, false) AS puede_aprobar,
         COALESCE(uc.puede_asignar, rp.puede_asignar, false) AS puede_asignar,
         COALESCE(uc.puede_mover, rp.puede_mover, false) AS puede_mover,
         COALESCE(uc.puede_cerrar, rp.puede_cerrar, false) AS puede_cerrar,
         COALESCE(uc.puede_reabrir, rp.puede_reabrir, false) AS puede_reabrir,
         COALESCE(uc.puede_eliminar, rp.puede_eliminar, false) AS puede_eliminar
       FROM role_perms rp
       FULL OUTER JOIN user_custom uc ON true`,
      [moduloId, usuarioId]
    );

    if (!rows || rows.length === 0 || !rows[0]) {
      return noPerms;
    }

    const r = rows[0];
    return {
      puede_ver: Boolean(r.puede_ver),
      puede_crear: Boolean(r.puede_crear),
      puede_editar: Boolean(r.puede_editar),
      puede_inactivar: Boolean(r.puede_inactivar),
      puede_exportar: Boolean(r.puede_exportar),
      puede_importar: Boolean(r.puede_importar),
      puede_aprobar: Boolean(r.puede_aprobar),
      puede_asignar: Boolean(r.puede_asignar),
      puede_mover: Boolean(r.puede_mover),
      puede_cerrar: Boolean(r.puede_cerrar),
      puede_reabrir: Boolean(r.puede_reabrir),
      puede_eliminar: Boolean(r.puede_eliminar)
    };
  } catch {
    return noPerms;
  }
}

export async function getScreenPermissions(
  screenCodeOrPath: string,
  usuarioId: number
): Promise<ModulePermissions> {
  const fullPerms: ModulePermissions = {
    puede_ver: true, puede_crear: true, puede_editar: true, puede_inactivar: true,
    puede_exportar: true, puede_importar: true, puede_aprobar: true, puede_asignar: true,
    puede_mover: true, puede_cerrar: true, puede_reabrir: true, puede_eliminar: true
  };

  const noPerms: ModulePermissions = {
    puede_ver: false, puede_crear: false, puede_editar: false, puede_inactivar: false,
    puede_exportar: false, puede_importar: false, puede_aprobar: false, puede_asignar: false,
    puede_mover: false, puede_cerrar: false, puede_reabrir: false, puede_eliminar: false
  };

  if (!usuarioId) return noPerms;

  try {
    // Verificar que el usuario exista y esté activo
    const userCheck = await query(
      `SELECT estado FROM admin.usuario WHERE usuario_id = $1 LIMIT 1`,
      [usuarioId]
    );
    if (!userCheck || userCheck.length === 0 || (userCheck[0].estado && userCheck[0].estado !== 'ACTIVO')) {
      return noPerms;
    }

    if ((await isSuperAdmin(usuarioId)) && isInstitutionalSecurityTarget(screenCodeOrPath)) {
      return fullPerms;
    }

    // 1. Identificar pantalla en admin.pantalla_sistema
    const screenRows = await query(
      `SELECT pantalla_id, modulo_sistema_id
       FROM admin.pantalla_sistema
       WHERE activo = true
         AND (
           UPPER(codigo) = UPPER($1)
           OR ruta = $1
           OR (ruta LIKE '%?%' AND split_part(ruta, '?', 1) = split_part($1, '?', 1))
           OR ($1 LIKE (ruta || '%'))
         )
       ORDER BY CASE
         WHEN ruta = $1 THEN 1
         WHEN UPPER(codigo) = UPPER($1) THEN 2
         WHEN ($1 = '/workshop' OR $1 = '/workshop/') AND ruta = '/workshop?view=list' THEN 3
         ELSE 4
       END, orden ASC, pantalla_id ASC
       LIMIT 1`,
      [screenCodeOrPath]
    );

    if (!screenRows || screenRows.length === 0) {
      // Fallback a permiso de módulo si screenCodeOrPath coincide con un módulo
      return getModulePermissions(screenCodeOrPath, usuarioId);
    }

    const pantallaId = screenRows[0].pantalla_id;
    const moduloId = screenRows[0].modulo_sistema_id;

    if (moduloId === 2 && (await isSuperAdmin(usuarioId))) {
      return fullPerms;
    }

    // 2. Precedencia:
    //    1) user_custom_screen (permiso personalizado usuario en pantalla)
    //    2) user_custom_module (permiso personalizado usuario en módulo padre)
    //    3) role_effective (override en matriz_acceso_pantalla > herencia en matriz_acceso_rol)
    const rows = await query(
      `WITH user_roles AS (
         SELECT rf.rol_funcional_id
         FROM admin.rol_funcional rf
         WHERE rf.estado = 'ACTIVO'
           AND rf.rol_funcional_id IN (
             SELECT u.rol_principal_id FROM admin.usuario u WHERE u.usuario_id = $2 AND u.rol_principal_id IS NOT NULL AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
             UNION
             SELECT ura.rol_funcional_id FROM admin.usuario_rol_adicional ura JOIN admin.usuario u ON ura.usuario_id = u.usuario_id WHERE ura.usuario_id = $2 AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
           )
       ),
       user_custom_screen AS (
         SELECT *
         FROM admin.usuario_permiso_personalizado
         WHERE usuario_id = $2 AND pantalla_id = $1 AND estado = 'ACTIVO'
         LIMIT 1
       ),
       user_custom_module AS (
         SELECT *
         FROM admin.usuario_permiso_personalizado
         WHERE usuario_id = $2 AND modulo_sistema_id = $3 AND pantalla_id IS NULL AND estado = 'ACTIVO'
         LIMIT 1
       ),
       role_effective AS (
         SELECT
           BOOL_OR(COALESCE(map.puede_ver, mar.puede_ver, false)) AS puede_ver,
           BOOL_OR(COALESCE(map.puede_crear, mar.puede_crear, false)) AS puede_crear,
           BOOL_OR(COALESCE(map.puede_editar, mar.puede_editar, false)) AS puede_editar,
           BOOL_OR(COALESCE(map.puede_inactivar, mar.puede_inactivar, false)) AS puede_inactivar,
           BOOL_OR(COALESCE(map.puede_exportar, mar.puede_exportar, false)) AS puede_exportar,
           BOOL_OR(COALESCE(map.puede_importar, mar.puede_importar, false)) AS puede_importar,
           BOOL_OR(COALESCE(map.puede_aprobar, mar.puede_aprobar, false)) AS puede_aprobar,
           BOOL_OR(COALESCE(map.puede_asignar, mar.puede_asignar, false)) AS puede_asignar,
           BOOL_OR(COALESCE(map.puede_mover, mar.puede_mover, false)) AS puede_mover,
           BOOL_OR(COALESCE(map.puede_cerrar, mar.puede_cerrar, false)) AS puede_cerrar,
           BOOL_OR(COALESCE(map.puede_reabrir, mar.puede_reabrir, false)) AS puede_reabrir,
           BOOL_OR(COALESCE(map.puede_eliminar, mar.puede_eliminar, false)) AS puede_eliminar
         FROM user_roles ur
         LEFT JOIN admin.matriz_acceso_pantalla map
           ON map.rol_funcional_id = ur.rol_funcional_id AND map.pantalla_id = $1
         LEFT JOIN admin.matriz_acceso_rol mar
           ON mar.rol_funcional_id = ur.rol_funcional_id AND mar.modulo_sistema_id = $3
       )
       SELECT
         COALESCE(ucs.puede_ver, ucm.puede_ver, re.puede_ver, false) AS puede_ver,
         COALESCE(ucs.puede_crear, ucm.puede_crear, re.puede_crear, false) AS puede_crear,
         COALESCE(ucs.puede_editar, ucm.puede_editar, re.puede_editar, false) AS puede_editar,
         COALESCE(ucs.puede_inactivar, ucm.puede_inactivar, re.puede_inactivar, false) AS puede_inactivar,
         COALESCE(ucs.puede_exportar, ucm.puede_exportar, re.puede_exportar, false) AS puede_exportar,
         COALESCE(ucs.puede_importar, ucm.puede_importar, re.puede_importar, false) AS puede_importar,
         COALESCE(ucs.puede_aprobar, ucm.puede_aprobar, re.puede_aprobar, false) AS puede_aprobar,
         COALESCE(ucs.puede_asignar, ucm.puede_asignar, re.puede_asignar, false) AS puede_asignar,
         COALESCE(ucs.puede_mover, ucm.puede_mover, re.puede_mover, false) AS puede_mover,
         COALESCE(ucs.puede_cerrar, ucm.puede_cerrar, re.puede_cerrar, false) AS puede_cerrar,
         COALESCE(ucs.puede_reabrir, ucm.puede_reabrir, re.puede_reabrir, false) AS puede_reabrir,
         COALESCE(ucs.puede_eliminar, ucm.puede_eliminar, re.puede_eliminar, false) AS puede_eliminar
       FROM role_effective re
       LEFT JOIN user_custom_screen ucs ON true
       LEFT JOIN user_custom_module ucm ON true`,
      [pantallaId, usuarioId, moduloId]
    );

    if (!rows || rows.length === 0 || !rows[0]) {
      return noPerms;
    }

    const r = rows[0];
    return {
      puede_ver: Boolean(r.puede_ver),
      puede_crear: Boolean(r.puede_crear),
      puede_editar: Boolean(r.puede_editar),
      puede_inactivar: Boolean(r.puede_inactivar),
      puede_exportar: Boolean(r.puede_exportar),
      puede_importar: Boolean(r.puede_importar),
      puede_aprobar: Boolean(r.puede_aprobar),
      puede_asignar: Boolean(r.puede_asignar),
      puede_mover: Boolean(r.puede_mover),
      puede_cerrar: Boolean(r.puede_cerrar),
      puede_reabrir: Boolean(r.puede_reabrir),
      puede_eliminar: Boolean(r.puede_eliminar)
    };
  } catch {
    return noPerms;
  }
}

export async function getUserNavigationPermissions(usuarioId: number): Promise<{
  isSuperAdmin: boolean;
  modules: Record<string, boolean>; // codigo/nombre normalizado -> puede_ver
  screens: Record<string, boolean>; // codigo/ruta -> puede_ver
}> {
  if (!usuarioId) {
    return { isSuperAdmin: false, modules: {}, screens: {} };
  }

  try {
    // Verificar que el usuario exista y esté activo
    const userCheck = await query(
      `SELECT estado FROM admin.usuario WHERE usuario_id = $1 LIMIT 1`,
      [usuarioId]
    );
    if (!userCheck || userCheck.length === 0 || (userCheck[0].estado && userCheck[0].estado !== 'ACTIVO')) {
      return { isSuperAdmin: false, modules: {}, screens: {} };
    }

    const isSuper = await isSuperAdmin(usuarioId);

    // 1. Module-level visibility (user custom override > role permission)
    const modRows = await query(
      `WITH user_roles AS (
         SELECT rf.rol_funcional_id
         FROM admin.rol_funcional rf
         WHERE rf.estado = 'ACTIVO'
           AND rf.rol_funcional_id IN (
             SELECT u.rol_principal_id FROM admin.usuario u WHERE u.usuario_id = $1 AND u.rol_principal_id IS NOT NULL AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
             UNION
             SELECT ura.rol_funcional_id FROM admin.usuario_rol_adicional ura JOIN admin.usuario u ON ura.usuario_id = u.usuario_id WHERE ura.usuario_id = $1 AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
           )
       )
       SELECT
         UPPER(TRANSLATE(mod.nombre, 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou')) AS modulo_key,
         COALESCE(
           upp.puede_ver,
           BOOL_OR(m.puede_ver),
           false
         ) AS puede_ver
       FROM admin.modulo_sistema mod
       LEFT JOIN admin.matriz_acceso_rol m
         ON mod.modulo_sistema_id = m.modulo_sistema_id
         AND m.rol_funcional_id IN (SELECT rol_funcional_id FROM user_roles)
       LEFT JOIN admin.usuario_permiso_personalizado upp
         ON upp.modulo_sistema_id = mod.modulo_sistema_id
         AND upp.pantalla_id IS NULL
         AND upp.usuario_id = $1
         AND upp.estado = 'ACTIVO'
       WHERE mod.estado = 'ACTIVO'
       GROUP BY mod.modulo_sistema_id, mod.nombre, upp.puede_ver`,
      [usuarioId]
    );

    interface ModRow {
      modulo_key: string;
      puede_ver: boolean;
    }
    const modules: Record<string, boolean> = {};
    ((modRows || []) as unknown as ModRow[]).forEach((row) => {
      modules[row.modulo_key] = Boolean(row.puede_ver);
    });

    // 2. Screen-level visibility (user custom screen > user custom module > role screen override > role menu)
    const screenRows = await query(
      `WITH user_roles AS (
         SELECT rf.rol_funcional_id
         FROM admin.rol_funcional rf
         WHERE rf.estado = 'ACTIVO'
           AND rf.rol_funcional_id IN (
             SELECT u.rol_principal_id FROM admin.usuario u WHERE u.usuario_id = $1 AND u.rol_principal_id IS NOT NULL AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
             UNION
             SELECT ura.rol_funcional_id FROM admin.usuario_rol_adicional ura JOIN admin.usuario u ON ura.usuario_id = u.usuario_id WHERE ura.usuario_id = $1 AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
           )
       ),
       role_screen_visibility AS (
         SELECT
           ps.pantalla_id,
           ps.modulo_sistema_id,
           ps.codigo,
           ps.ruta,
           BOOL_OR(COALESCE(map.puede_ver, mar.puede_ver, false)) AS puede_ver_rol,
           BOOL_OR(COALESCE(map.puede_crear, mar.puede_crear, false)) AS puede_crear_rol,
           BOOL_OR(COALESCE(map.puede_editar, mar.puede_editar, false)) AS puede_editar_rol,
           BOOL_OR(COALESCE(map.puede_inactivar, mar.puede_inactivar, false)) AS puede_inactivar_rol,
           BOOL_OR(COALESCE(map.puede_exportar, mar.puede_exportar, false)) AS puede_exportar_rol,
           BOOL_OR(COALESCE(map.puede_importar, mar.puede_importar, false)) AS puede_importar_rol,
           BOOL_OR(COALESCE(map.puede_aprobar, mar.puede_aprobar, false)) AS puede_aprobar_rol,
           BOOL_OR(COALESCE(map.puede_asignar, mar.puede_asignar, false)) AS puede_asignar_rol,
           BOOL_OR(COALESCE(map.puede_mover, mar.puede_mover, false)) AS puede_mover_rol,
           BOOL_OR(COALESCE(map.puede_cerrar, mar.puede_cerrar, false)) AS puede_cerrar_rol,
           BOOL_OR(COALESCE(map.puede_reabrir, mar.puede_reabrir, false)) AS puede_reabrir_rol,
           BOOL_OR(COALESCE(map.puede_eliminar, mar.puede_eliminar, false)) AS puede_eliminar_rol
         FROM admin.pantalla_sistema ps
         LEFT JOIN user_roles ur ON true
         LEFT JOIN admin.matriz_acceso_pantalla map
           ON map.pantalla_id = ps.pantalla_id AND map.rol_funcional_id = ur.rol_funcional_id
         LEFT JOIN admin.matriz_acceso_rol mar
           ON mar.modulo_sistema_id = ps.modulo_sistema_id AND mar.rol_funcional_id = ur.rol_funcional_id
         WHERE ps.activo = true
         GROUP BY ps.pantalla_id, ps.modulo_sistema_id, ps.codigo, ps.ruta
       )
       SELECT
         rsv.codigo AS pantalla_codigo,
         rsv.ruta AS pantalla_ruta,
         UPPER(TRANSLATE(ms.nombre, 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou')) AS modulo_key,
         COALESCE(ucs.puede_ver, ucm.puede_ver, rsv.puede_ver_rol, false) AS puede_ver,
         COALESCE(ucs.puede_crear, ucm.puede_crear, rsv.puede_crear_rol, false) AS puede_crear,
         COALESCE(ucs.puede_editar, ucm.puede_editar, rsv.puede_editar_rol, false) AS puede_editar,
         COALESCE(ucs.puede_inactivar, ucm.puede_inactivar, rsv.puede_inactivar_rol, false) AS puede_inactivar,
         COALESCE(ucs.puede_exportar, ucm.puede_exportar, rsv.puede_exportar_rol, false) AS puede_exportar,
         COALESCE(ucs.puede_importar, ucm.puede_importar, rsv.puede_importar_rol, false) AS puede_importar,
         COALESCE(ucs.puede_aprobar, ucm.puede_aprobar, rsv.puede_aprobar_rol, false) AS puede_aprobar,
         COALESCE(ucs.puede_asignar, ucm.puede_asignar, rsv.puede_asignar_rol, false) AS puede_asignar,
         COALESCE(ucs.puede_mover, ucm.puede_mover, rsv.puede_mover_rol, false) AS puede_mover,
         COALESCE(ucs.puede_cerrar, ucm.puede_cerrar, rsv.puede_cerrar_rol, false) AS puede_cerrar,
         COALESCE(ucs.puede_reabrir, ucm.puede_reabrir, rsv.puede_reabrir_rol, false) AS puede_reabrir,
         COALESCE(ucs.puede_eliminar, ucm.puede_eliminar, rsv.puede_eliminar_rol, false) AS puede_eliminar
       FROM role_screen_visibility rsv
       JOIN admin.modulo_sistema ms ON rsv.modulo_sistema_id = ms.modulo_sistema_id
       LEFT JOIN admin.usuario_permiso_personalizado ucs
         ON ucs.pantalla_id = rsv.pantalla_id
         AND ucs.usuario_id = $1
         AND ucs.estado = 'ACTIVO'
       LEFT JOIN admin.usuario_permiso_personalizado ucm
         ON ucm.modulo_sistema_id = rsv.modulo_sistema_id
         AND ucm.pantalla_id IS NULL
         AND ucm.usuario_id = $1
         AND ucm.estado = 'ACTIVO'`,
      [usuarioId]
    );

    interface ScreenRow {
      pantalla_codigo: string;
      pantalla_ruta: string;
      modulo_key: string;
      puede_ver: boolean;
      puede_crear: boolean;
      puede_editar: boolean;
      puede_inactivar: boolean;
      puede_exportar: boolean;
      puede_importar: boolean;
      puede_aprobar: boolean;
      puede_asignar: boolean;
      puede_mover: boolean;
      puede_cerrar: boolean;
      puede_reabrir: boolean;
      puede_eliminar: boolean;
      [key: string]: unknown;
    }
    const screens: Record<string, boolean> = {};
    ((screenRows || []) as unknown as ScreenRow[]).forEach((row) => {
      const requiredAction = getRequiredActionForScreen(row.pantalla_codigo) || "puede_ver";
      const hasBaseVer = Boolean(row.puede_ver);
      let isAllowed = hasBaseVer;
      if (hasBaseVer && requiredAction !== "puede_ver") {
        isAllowed = Boolean(row[requiredAction]);
      }

      screens[row.pantalla_codigo] = isAllowed;
      screens[row.pantalla_ruta] = isAllowed;
      // Si el usuario tiene acceso a alguna pantalla de un módulo, el módulo debe ser visible
      if (isAllowed && row.modulo_key) {
        modules[row.modulo_key] = true;
      }
    });

    if (isSuper) {
      // Salvaguarda institucional inmutable para Administrador General (Modelo B)
      modules["SEGURIDAD"] = true;
      for (const code of INSTITUTIONAL_SECURITY_SCREEN_CODES) {
        screens[code] = true;
      }
      for (const path of INSTITUTIONAL_SECURITY_PATHS) {
        screens[path] = true;
      }
    }

    return {
      isSuperAdmin: isSuper,
      modules,
      screens
    };
  } catch (err) {
    console.error("Error in getUserNavigationPermissions:", err);
    return { isSuperAdmin: false, modules: {}, screens: {} };
  }
}

/**
 * Helper unificado de autorización server-side
 * Verifica si el usuario actual tiene permiso para realizar una acción específica
 * sobre una pantalla, reporte o módulo del sistema.
 */
export async function canUser(
  usuarioId: number,
  action: keyof ModulePermissions,
  target: string | number
): Promise<boolean> {
  if (!usuarioId) return false;
  if ((await isSuperAdmin(usuarioId)) && isInstitutionalSecurityTarget(target)) return true;

  if (typeof target === "string" && (target.startsWith("/") || target.includes("_"))) {
    const perms = await getScreenPermissions(target, usuarioId);
    return Boolean(perms[action]);
  }

  const modPerms = await getModulePermissions(target, usuarioId);
  return Boolean(modPerms[action]);
}

/**
 * Valida que el usuario tenga acceso a la empresa indicada (Multitenant isolation)
 */
export function validateCompanyAccess(
  sessionEmpresaId: number | null | undefined,
  targetEmpresaId: number | null | undefined,
  isSuperAdminUser = false
): boolean {
  if (isSuperAdminUser) return true;
  if (!sessionEmpresaId || !targetEmpresaId) return false;
  return Number(sessionEmpresaId) === Number(targetEmpresaId);
}

/**
 * Resuelve el destino inicial autorizado para un usuario autenticado
 * cuando no tiene acceso a DASHBOARD_MAIN ('/').
 *
 * Condiciones:
 * 1. Prioriza módulos según el orden canónico documentado:
 *    TALLER -> FACTURACIÓN -> CRM -> INVENTARIO -> REPORTES -> CONFIGURACIÓN -> SEGURIDAD
 * 2. Valida permisos efectivos de pantalla en el motor RBAC (no únicamente de módulo).
 * 3. Admite rutas con query parameters (ej. /workshop?view=work_orders).
 * 4. Excluye rutas de creación (/new, /create), edición (/edit), eliminación (/delete).
 * 5. Excluye APIs (/api/*), tracking público (/tracking/*) y rutas externas.
 * 6. Excluye '/' para evitar bucles de redirección.
 * 7. Prioriza listados, consultas y resúmenes.
 * 8. Retorna la ruta destino autorizada o null si el usuario no tiene pantallas operativas.
 */
export async function resolveDefaultAuthorizedPath(usuarioId: number | string): Promise<string | null> {
  const numUserId = typeof usuarioId === "string" ? parseInt(usuarioId, 10) : usuarioId;
  if (!numUserId || isNaN(numUserId)) return null;

  try {
    const navPerms = await getUserNavigationPermissions(numUserId);
    if (!navPerms || !navPerms.modules || !navPerms.screens) {
      return null;
    }

    for (const menu of CANONICAL_NAVIGATION) {
      // Ignorar home/dashboard porque la función se llama cuando DASHBOARD_MAIN está denegado
      if (menu.id === "home") continue;

      const menuKey = normalizeCode(menu.codigo);
      const hasModulePerm = Boolean(navPerms.modules[menuKey]);

      for (const screen of menu.screens) {
        const ruta = (screen.ruta || "").trim();
        if (!ruta) continue;

        // Descartar '/' para evitar bucle
        if (ruta === "/") continue;

        // Descartar APIs, tracking público y rutas externas
        if (
          ruta.startsWith("/api") ||
          ruta.startsWith("/tracking") ||
          ruta.startsWith("http://") ||
          ruta.startsWith("https://") ||
          ruta.startsWith("//")
        ) {
          continue;
        }

        // Descartar rutas de creación, edición, eliminación o auxiliares
        const lowerRuta = ruta.toLowerCase();
        if (
          lowerRuta.includes("/new") ||
          lowerRuta.includes("/nuevo") ||
          lowerRuta.includes("/nueva") ||
          lowerRuta.includes("/create") ||
          lowerRuta.includes("/crear") ||
          lowerRuta.includes("/edit") ||
          lowerRuta.includes("/editar") ||
          lowerRuta.includes("/delete") ||
          lowerRuta.includes("/eliminar")
        ) {
          continue;
        }

        // Validar permisos de pantalla (no únicamente de módulo)
        const screenExplicitPerm =
          navPerms.screens[screen.codigo] !== undefined
            ? navPerms.screens[screen.codigo]
            : navPerms.screens[ruta];

        const isAuthorized =
          screenExplicitPerm !== undefined ? Boolean(screenExplicitPerm) : hasModulePerm;

        if (isAuthorized) {
          return ruta;
        }
      }
    }

    return null;
  } catch (err) {
    console.error("Error in resolveDefaultAuthorizedPath:", err);
    return null;
  }
}
