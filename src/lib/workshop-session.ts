import { cookies } from "next/headers";
import { query } from "@/lib/db";

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

export async function getWorkshopSession(): Promise<WorkshopSession | null> {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get("session_token")?.value;

    if (!tokenCookie || !tokenCookie.trim()) {
      return null;
    }

    const sessions = await query(
      `SELECT
         s.usuario_id,
         s.estado,
         s.fecha_expiracion,
         u.empresa_id,
         u.rol_principal_id,
         ui.nombre,
         ui.apellido,
         ui.correo_electronico AS email
       FROM admin.usuario_sesion s
       JOIN admin.usuario u
         ON u.usuario_id = s.usuario_id
       LEFT JOIN admin.usuario_identidad ui
         ON ui.usuario_id = u.usuario_id
       WHERE s.token_identificador = $1
         AND s.estado = 'ACTIVA'
         AND (
           s.fecha_expiracion IS NULL
           OR s.fecha_expiracion > NOW()
         )
       LIMIT 1`,
      [tokenCookie.trim()]
    );

    if (!sessions || sessions.length === 0) {
      return null;
    }

    const s = sessions[0];
    return {
      usuario_id: s.usuario_id,
      empresa_id: s.empresa_id,
      rol_principal_id: s.rol_principal_id,
      nombre_usuario: `${s.nombre || ''} ${s.apellido || ''}`.trim() || s.email || 'Usuario',
      email: s.email || ''
    };
  } catch (err) {
    return null;
  }
}

export async function getModulePermissions(
  moduloNameOrId: string | number,
  usuarioId: number
): Promise<ModulePermissions> {
  const noPerms: ModulePermissions = {
    puede_ver: false,
    puede_crear: false,
    puede_editar: false,
    puede_inactivar: false,
    puede_exportar: false,
    puede_importar: false,
    puede_aprobar: false,
    puede_asignar: false,
    puede_mover: false,
    puede_cerrar: false,
    puede_reabrir: false,
    puede_eliminar: false
  };

  if (!usuarioId) return noPerms;

  try {
    const isId = typeof moduloNameOrId === 'number' || /^\d+$/.test(String(moduloNameOrId));
    const targetModule = isId ? Number(moduloNameOrId) : String(moduloNameOrId).toUpperCase();

    const rows = await query(
      `SELECT 
         COALESCE(BOOL_OR(m.puede_ver), false) AS puede_ver,
         COALESCE(BOOL_OR(m.puede_crear), false) AS puede_crear,
         COALESCE(BOOL_OR(m.puede_editar), false) AS puede_editar,
         COALESCE(BOOL_OR(m.puede_inactivar), false) AS puede_inactivar,
         COALESCE(BOOL_OR(m.puede_exportar), false) AS puede_exportar,
         COALESCE(BOOL_OR(m.puede_importar), false) AS puede_importar,
         COALESCE(BOOL_OR(m.puede_aprobar), false) AS puede_aprobar,
         COALESCE(BOOL_OR(m.puede_asignar), false) AS puede_asignar,
         COALESCE(BOOL_OR(m.puede_mover), false) AS puede_mover,
         COALESCE(BOOL_OR(m.puede_cerrar), false) AS puede_cerrar,
         COALESCE(BOOL_OR(m.puede_reabrir), false) AS puede_reabrir,
         COALESCE(BOOL_OR(m.puede_eliminar), false) AS puede_eliminar
       FROM admin.matriz_acceso_rol m
       JOIN admin.modulo_sistema mod ON mod.modulo_sistema_id = m.modulo_sistema_id
       WHERE ${isId ? 'mod.modulo_sistema_id = $1' : 'UPPER(mod.nombre) = UPPER($1)'}
         AND m.rol_funcional_id IN (
           SELECT rol_principal_id FROM admin.usuario WHERE usuario_id = $2 AND rol_principal_id IS NOT NULL
           UNION
           SELECT rol_funcional_id FROM admin.usuario_rol_adicional WHERE usuario_id = $2
         )`,
      [targetModule, usuarioId]
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
  } catch (err) {
    return noPerms;
  }
}
