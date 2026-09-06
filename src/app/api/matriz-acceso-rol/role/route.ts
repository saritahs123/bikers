import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

export async function POST(req: Request) {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("SEGURIDAD", session.usuario_id);
    if (!perms.puede_crear) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para realizar esta acción." }, { status: 403 });
    }

    const { nombre } = await req.json();
    const maxRes = await query("SELECT COALESCE(MAX(rol_funcional_id), 0) + 1 AS next_id FROM admin.rol_funcional");
    const nextId = (maxRes as any[])[0].next_id;
    await query("INSERT INTO admin.rol_funcional (rol_funcional_id, nombre, estado) VALUES ($1, $2, 'ACTIVO')", [nextId, nombre]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in POST /api/matriz-acceso-rol/role:", error);
    return NextResponse.json({ success: false, error: "SERVER_ERROR", message: "Error al crear el rol funcional." }, { status: 500 });
  }
}
