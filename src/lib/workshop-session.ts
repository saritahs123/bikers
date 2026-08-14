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
  const isProduction = process.env.NODE_ENV === "production";

  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get("session_user_id")?.value;
    const tokenCookie = cookieStore.get("session_token")?.value;

    let userId = userIdCookie ? parseInt(userIdCookie, 10) : (isProduction ? 0 : 1);
    if (isNaN(userId)) userId = isProduction ? 0 : 1;

    // Check active session in DB if token exists
    if (tokenCookie && userId > 0) {
      const sessions = await query(
        `SELECT s.sesion_id, s.usuario_id, s.estado, s.fecha_expiracion,
                u.empresa_id, u.rol_principal_id,
                ui.nombre AS nombre, ui.apellido AS apellido, ui.correo_electronico AS email
         FROM admin.usuario_sesion s
         JOIN admin.usuario u ON u.usuario_id = s.usuario_id
         LEFT JOIN admin.usuario_identidad ui ON ui.usuario_id = u.usuario_id
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

    // In production, if token/session is missing or invalid, return null to trigger 401 response
    if (isProduction) {
      return null;
    }

    // Fallback for dev mode / default active user when session cookie is not set
    const userRows = await query(
      `SELECT u.usuario_id, u.empresa_id, u.rol_principal_id,
              ui.nombre AS nombre, ui.apellido AS apellido, ui.correo_electronico AS email
       FROM admin.usuario u
       LEFT JOIN admin.usuario_identidad ui ON ui.usuario_id = u.usuario_id
       WHERE u.usuario_id = $1 AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
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

    // Absolute fallback for dev mode
    return {
      usuario_id: 1,
      empresa_id: 1,
      rol_principal_id: 1,
      nombre_usuario: "Usuario Administrador",
      email: "admin@bikers.com"
    };

  } catch (err) {
    console.error("Error in getWorkshopSession:", err);
    if (isProduction) {
      return null;
    }
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

  if (!moduloId || !rolId) return noPerms;

  // Admin Role (1) always retains full access
  if (rolId === 1) {
    return {
      puede_ver: true, puede_crear: true, puede_editar: true, puede_inactivar: true,
      puede_exportar: true, puede_importar: true, puede_aprobar: true, puede_asignar: true,
      puede_mover: true, puede_cerrar: true, puede_reabrir: true, puede_eliminar: true
    };
  }

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

    if (!rows || rows.length === 0) {
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
    console.error("Error in getModulePermissions:", err);
    return noPerms;
  }
}
