import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("SEGURIDAD", session.usuario_id);
    if (!perms.puede_editar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para realizar esta acción." }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    await query("UPDATE admin.rol_funcional SET nombre = $1, descripcion = $2, estado = $3 WHERE rol_funcional_id = $4", 
      [body.nombre, body.descripcion || null, body.estado || 'ACTIVO', id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in PUT /api/matriz-acceso-rol/role/[id]:", error);
    return NextResponse.json({ success: false, error: "SERVER_ERROR", message: "Error al actualizar el rol funcional." }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("SEGURIDAD", session.usuario_id);
    if (!perms.puede_eliminar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para realizar esta acción." }, { status: 403 });
    }

    const { id } = await params;
    await query("UPDATE admin.rol_funcional SET estado = 'INACTIVO' WHERE rol_funcional_id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE /api/matriz-acceso-rol/role/[id]:", error);
    return NextResponse.json({ success: false, error: "SERVER_ERROR", message: "Error al inactivar el rol funcional." }, { status: 500 });
  }
}
