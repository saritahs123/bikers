import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

export async function GET() {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("SEGURIDAD", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para realizar esta acción." }, { status: 403 });
    }

    let departamentos: any[] = [];
    try {
      departamentos = await query(`
        SELECT 
          departamento_id,
          nombre
        FROM admin.departamento
        WHERE UPPER(estado) = 'ACTIVO'
        ORDER BY nombre ASC
      `);
    } catch (e) {
      console.warn("Fallback query for GET admin.departamento helpers:", e);
      try {
        departamentos = await query(`SELECT departamento_id, nombre FROM admin.departamento ORDER BY nombre ASC`);
      } catch (e2) {
        console.error("Could not fetch departamentos helpers:", e2);
      }
    }

    const mappedDepartamentos = (departamentos || []).map((d: any) => ({
      departamento_id: d.departamento_id,
      nombre: d.nombre
    }));

    return NextResponse.json({ departamentos: mappedDepartamentos });
  } catch (error: any) {
    console.error("Error in GET /api/areas/helpers:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
