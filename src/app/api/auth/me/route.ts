import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { validateAndTouchSession } from "@/lib/sessionLifecycle";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get("session_token")?.value;
    const userIdCookie = cookieStore.get("session_user_id")?.value;

    if (!tokenCookie || !tokenCookie.trim()) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Sesión no válida o expirada. Token no proporcionado." },
        { status: 401 }
      );
    }

    const validation = await validateAndTouchSession(tokenCookie);
    if (!validation.valid) {
      const errorMap: Record<string, string> = {
        REVOKED: "Su sesión fue revocada. Por favor, vuelva a iniciar sesión.",
        CLOSED: "La sesión ha sido cerrada.",
        EXPIRED: "La sesión ha expirado por límite de tiempo.",
        NOT_FOUND: "Sesión no registrada o inactiva."
      };
      return NextResponse.json(
        {
          success: false,
          error: validation.reason === "REVOKED" ? "SESSION_REVOKED" : (validation.reason === "EXPIRED" ? "SESSION_EXPIRED" : "UNAUTHORIZED"),
          message: errorMap[validation.reason] || "Sesión inválida o expirada."
        },
        { status: 401 }
      );
    }

    const targetUserId = validation.userId;
    if (!targetUserId || isNaN(Number(targetUserId))) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Usuario de sesión no válido." },
        { status: 401 }
      );
    }

    if (userIdCookie) {
      const cookieParsedId = parseInt(userIdCookie, 10);
      if (!isNaN(cookieParsedId) && cookieParsedId !== targetUserId) {
        console.warn(`[SECURITY WARNING] Mismatch between session_user_id cookie (${cookieParsedId}) and DB session user_id (${targetUserId}). DB session prevails.`);
      }
    }

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

    let nombreCompleto = "";
    if (nombre && apellido) {
      nombreCompleto = `${nombre} ${apellido}`;
    } else if (nombre) {
      nombreCompleto = nombre;
    } else if (apellido) {
      nombreCompleto = apellido;
    } else if (row.identificador_principal) {
      nombreCompleto = row.identificador_principal;
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
      identificador_principal: row.identificador_principal || "",
      correo_acceso: row.correo_acceso || "",
      correo_electronico: row.correo_electronico || "",
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
