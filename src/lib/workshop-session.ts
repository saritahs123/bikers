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
    const userIdCookie = cookieStore.get("session_user_id")?.value;
    const tokenCookie = cookieStore.get("session_token")?.value;

    let userId = userIdCookie ? parseInt(userIdCookie, 10) : 1;
    if (isNaN(userId)) userId = 1;

    // Check active session in DB if token exists
    if (tokenCookie) {
      const sessions = await query(
        `SELECT s.sesion_id, s.usuario_id, s.estado, s.fecha_expiracion,
                u.empresa_id, u.rol_principal_id, u.nombre, u.apellido, u.email
         FROM admin.usuario_sesion s
         JOIN admin.usuario u ON u.usuario_id = s.usuario_id
         WHERE s.token_identificador = $1 AND s.usuario_id = $2
         LIMIT 1`,
        [tokenCookie, userId]
      );

      if (sessions && sessions.length > 0) {
        const s = sessions[0];
        const isExpired = s.fecha_expiracion && new Date(s.fecha_expiracion) < new Date();
        if (s.estado !== "REVOCADA" && s.estado !== "CERRADA" && s.estado !== "EXPIRADA" && !isExpired) {
          return {
            usuario_id: s.usuario_id,
            empresa_id: s.empresa_id || 1,
            rol_principal_id: s.rol_principal_id || 2,
            nombre_usuario: `${s.nombre || ''} ${s.apellido || ''}`.trim() || s.email || 'Usuario',
            email: s.email || ''
          };
        }
      }
    }

    // Fallback for dev mode / default active user when session cookie is not set
    const userRows = await query(
      `SELECT usuario_id, empresa_id, rol_principal_id, nombre, apellido, email
       FROM admin.usuario
       WHERE usuario_id = $1 AND (activo = true OR activo IS NULL)
       LIMIT 1`,
      [userId]
    );

    if (userRows && userRows.length > 0) {
      const u = userRows[0];
      return {
        usuario_id: u.usuario_id,
        empresa_id: u.empresa_id || 1,
        rol_principal_id: u.rol_principal_id || 2,
        nombre_usuario: `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.email || 'Usuario Administrador',
        email: u.email || ''
      };
    }

    // Absolute fallback
    return {
      usuario_id: 1,
      empresa_id: 1,
      rol_principal_id: 2,
      nombre_usuario: "Usuario Administrador",
      email: "admin@bikers.com"
    };

  } catch (err) {
    console.error("Error in getWorkshopSession:", err);
    return {
      usuario_id: 1,
      empresa_id: 1,
      rol_principal_id: 2,
      nombre_usuario: "Usuario Administrador",
      email: "admin@bikers.com"
    };
  }
}

export async function getModulePermissions(
  moduloId: number,
  rolId: number
): Promise<ModulePermissions> {
  const defaultPerms: ModulePermissions = {
    puede_ver: true,
    puede_crear: true,
    puede_editar: true,
    puede_inactivar: true,
    puede_exportar: true,
    puede_importar: true,
    puede_aprobar: true,
    puede_asignar: true,
    puede_mover: true,
    puede_cerrar: true,
    puede_reabrir: true,
    puede_eliminar: true
  };

  try {
    const rows = await query(
      `SELECT puede_ver, puede_crear, puede_editar, puede_inactivar,
              puede_exportar, puede_importar, puede_aprobar, puede_asignar,
              puede_mover, puede_cerrar, puede_reabrir, puede_eliminar
       FROM admin.matriz_acceso_rol
       WHERE modulo_sistema_id = $1 AND rol_funcional_id = $2
       LIMIT 1`,
      [moduloId, rolId]
    );

    if (!rows || rows.length === 0) return defaultPerms;

    const r = rows[0];
    return {
      puede_ver: r.puede_ver !== false,
      puede_crear: r.puede_crear !== false,
      puede_editar: r.puede_editar !== false,
      puede_inactivar: r.puede_inactivar !== false,
      puede_exportar: r.puede_exportar !== false,
      puede_importar: r.puede_importar !== false,
      puede_aprobar: r.puede_aprobar !== false,
      puede_asignar: r.puede_asignar !== false,
      puede_mover: r.puede_mover !== false,
      puede_cerrar: r.puede_cerrar !== false,
      puede_reabrir: r.puede_reabrir !== false,
      puede_eliminar: r.puede_eliminar !== false
    };
  } catch (err) {
    console.error("Error in getModulePermissions:", err);
    return defaultPerms;
  }
}
