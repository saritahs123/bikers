import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("SEGURIDAD", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para realizar esta acción." }, { status: 403 });
    }

    const { id } = await context.params;
    const cargoId = parseInt(id, 10);

    const rows = await query(
      `SELECT * FROM admin.cargo WHERE cargo_id = $1 LIMIT 1`,
      [cargoId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Cargo no encontrado" }, { status: 404 });
    }

    const r = rows[0];
    return NextResponse.json({
      id: r.cargo_id ?? r.id,
      cargo_id: r.cargo_id ?? r.id,
      nombre: r.nombre || '',
      estado: (r.estado || 'ACTIVO').toString().toUpperCase(),
      fecha_creacion: r.fecha_creacion ? String(r.fecha_creacion).substring(0, 10) : null,
      fecha_actualizacion: r.fecha_actualizacion ? String(r.fecha_actualizacion).substring(0, 10) : null
    });
  } catch (error: any) {
    console.error("Error in GET /api/cargos/[id]:", error);
    return NextResponse.json({ success: false, error: "SERVER_ERROR", message: "Error al obtener el cargo." }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("SEGURIDAD", session.usuario_id);
    if (!perms.puede_editar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para realizar esta acción." }, { status: 403 });
    }

    const { id } = await context.params;
    const cargoId = parseInt(id, 10);
    const body = await req.json();

    const nombre = (body.nombre || '').trim();
    const estadoInput = (body.estado || 'ACTIVO').toString().trim().toUpperCase();
    const estado = (estadoInput === 'INACTIVO' || estadoInput === 'INACTIVOS') ? 'INACTIVO' : 'ACTIVO';

    if (!nombre) {
      return NextResponse.json({ error: "El Nombre del Cargo es obligatorio." }, { status: 400 });
    }
    if (nombre.length > 100) {
      return NextResponse.json({ error: "El Nombre no puede exceder los 100 caracteres." }, { status: 400 });
    }

    // Try 1: Standard UPDATE with RETURNING *
    try {
      const sql1 = `
        UPDATE admin.cargo
        SET 
          nombre = $1,
          estado = $2,
          fecha_actualizacion = NOW()
        WHERE cargo_id = $3
        RETURNING *
      `;
      const res1 = await query(sql1, [nombre, estado, cargoId]);
      if (!res1 || res1.length === 0) {
        return NextResponse.json({ error: "No se encontró el registro para actualizar." }, { status: 404 });
      }
      return NextResponse.json({ success: true, item: res1[0] });
    } catch (err1: any) {
      console.warn("PUT Try 1 failed:", err1?.message);
      
      // Try 2: UPDATE without RETURNING *
      try {
        const sql2 = `
          UPDATE admin.cargo
          SET 
            nombre = $1,
            estado = $2,
            fecha_actualizacion = NOW()
          WHERE cargo_id = $3
        `;
        await query(sql2, [nombre, estado, cargoId]);
        return NextResponse.json({ success: true });
      } catch (err2: any) {
        console.error("PUT Try 2 failed:", err2);
        return NextResponse.json({ success: false, error: "SERVER_ERROR", message: "Error al actualizar el cargo." }, { status: 500 });
      }
    }
  } catch (error: any) {
    console.error("Error in PUT /api/cargos/[id]:", error);
    return NextResponse.json({ success: false, error: "SERVER_ERROR", message: "Error al procesar la actualización del cargo." }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("SEGURIDAD", session.usuario_id);
    if (!perms.puede_eliminar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para realizar esta acción." }, { status: 403 });
    }

    const { id } = await context.params;
    const cargoId = parseInt(id, 10);

    await query(
      `DELETE FROM admin.cargo WHERE cargo_id = $1`,
      [cargoId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE /api/cargos/[id]:", error);
    return NextResponse.json({ success: false, error: "SERVER_ERROR", message: "Error al eliminar el cargo." }, { status: 500 });
  }
}
