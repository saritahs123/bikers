import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get("session_user_id")?.value;
    const tokenCookie = cookieStore.get("session_token")?.value;

    let targetUserId: number | null = null;

    // 1. Identify user from valid active session token in DB
    if (tokenCookie) {
      const sessionCheck = await query(
        `SELECT usuario_id, fecha_expiracion, estado
         FROM admin.usuario_sesion
         WHERE token_identificador = $1
         LIMIT 1`,
        [tokenCookie]
      );

      if (sessionCheck && sessionCheck.length > 0) {
        const s = sessionCheck[0];
        const isExpired = s.fecha_expiracion && new Date(s.fecha_expiracion) < new Date();
        if (s.estado !== "REVOCADA" && s.estado !== "CERRADA" && s.estado !== "EXPIRADA" && !isExpired) {
          targetUserId = s.usuario_id;
        }
      }
    }

    // 2. Fallback to session_user_id cookie if token check did not yield user
    if (!targetUserId && userIdCookie) {
      const parsedId = parseInt(userIdCookie, 10);
      if (!isNaN(parsedId) && parsedId > 0) {
        targetUserId = parsedId;
      }
    }

    // 3. Return HTTP 401 if no valid authenticated session exists
    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    // 4. Query authenticated user details from real joined security tables
    const userRows = await query(
      `SELECT 
         u.usuario_id,
         u.estado AS usuario_estado,
         ui.nombre,
         ui.apellido,
         ui.correo_electronico,
         us.correo_acceso,
         us.identificador_principal,
         r.nombre AS rol_nombre,
         c.nombre AS cargo_nombre,
         e.nombre_comercial AS empresa_nombre
       FROM admin.usuario u
       LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
       LEFT JOIN admin.usuario_seguridad us ON u.usuario_id = us.usuario_id
       LEFT JOIN admin.rol_funcional r ON u.rol_principal_id = r.rol_funcional_id
       LEFT JOIN admin.empresa e ON u.empresa_id = e.empresa_id
       LEFT JOIN admin.cargo c ON ui.cargo_id = c.cargo_id
       WHERE u.usuario_id = $1 AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
       LIMIT 1`,
      [targetUserId]
    );

    if (!userRows || userRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "USER_NOT_FOUND", message: "Usuario no encontrado o inactivo." },
        { status: 404 }
      );
    }

    const row = userRows[0];
    const nombre = (row.nombre || "").trim();
    const apellido = (row.apellido || "").trim();
    const email = row.correo_acceso || row.correo_electronico || row.identificador_principal || "";

    let nombreCompleto = "";
    if (nombre && apellido) {
      nombreCompleto = `${nombre} ${apellido}`;
    } else if (nombre) {
      nombreCompleto = nombre;
    } else if (apellido) {
      nombreCompleto = apellido;
    } else if (email) {
      nombreCompleto = email;
    } else {
      nombreCompleto = "Sin nombre registrado";
    }

    let iniciales = "--";
    if (nombre && apellido) {
      iniciales = `${nombre[0]}${apellido[0]}`.toUpperCase();
    } else if (nombre) {
      iniciales = nombre.substring(0, 2).toUpperCase();
    } else if (nombreCompleto && nombreCompleto !== "Sin nombre registrado") {
      iniciales = nombreCompleto.substring(0, 2).toUpperCase();
    }

    const rolNombre = row.rol_nombre || "Sin rol asignado";
    const cargoNombre = row.cargo_nombre || rolNombre;
    const empresaNombre = row.empresa_nombre || "Biker's Fort";

    const userPayload = {
      usuario_id: row.usuario_id,
      nombre,
      apellido,
      nombre_completo: nombreCompleto,
      correo: email,
      rol: rolNombre,
      rol_nombre: rolNombre,
      cargo_nombre: cargoNombre,
      empresa_nombre: empresaNombre,
      iniciales,
      foto_url: null
    };

    return NextResponse.json({
      success: true,
      data: userPayload,
      user: userPayload
    });
  } catch (error: any) {
    console.error("GET /api/auth/me error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
