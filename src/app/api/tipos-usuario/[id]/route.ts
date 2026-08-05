import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const typeId = parseInt(id, 10);

    const rows = await query(
      `SELECT * FROM admin.tipo_usuario WHERE tipo_usuario_id = $1 LIMIT 1`,
      [typeId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Tipo de usuario no encontrado" }, { status: 404 });
    }

    const r = rows[0];
    return NextResponse.json({
      id: r.tipo_usuario_id ?? r.id,
      tipo_usuario_id: r.tipo_usuario_id ?? r.id,
      codigo: r.codigo || '',
      nombre: r.nombre || '',
      descripcion: r.descripcion || '',
      nivel_acceso: r.nivel_acceso !== undefined && r.nivel_acceso !== null ? Number(r.nivel_acceso) : 1,
      estado: (r.estado || 'ACTIVO').toString().toUpperCase(),
      fecha_creacion: r.fecha_creacion ? String(r.fecha_creacion).substring(0, 10) : null,
      fecha_actualizacion: r.fecha_actualizacion ? String(r.fecha_actualizacion).substring(0, 10) : null
    });
  } catch (error: any) {
    console.error("Error in GET /api/tipos-usuario/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const typeId = parseInt(id, 10);
    const body = await req.json();

    const codigo = (body.codigo || '').trim();
    const nombre = (body.nombre || '').trim();
    const descripcion = (body.descripcion || '').trim();
    const nivel_acceso = Math.max(1, parseInt(body.nivel_acceso || 1, 10));
    const estadoInput = (body.estado || 'ACTIVO').toString().trim().toUpperCase();
    const estado = (estadoInput === 'INACTIVO' || estadoInput === 'INACTIVOS') ? 'INACTIVO' : 'ACTIVO';

    if (!codigo) {
      return NextResponse.json({ error: "El Código del Tipo de Usuario es obligatorio." }, { status: 400 });
    }
    if (codigo.length > 50) {
      return NextResponse.json({ error: "El Código no puede exceder los 50 caracteres." }, { status: 400 });
    }
    if (!nombre) {
      return NextResponse.json({ error: "El Nombre del Tipo de Usuario es obligatorio." }, { status: 400 });
    }
    if (nombre.length > 100) {
      return NextResponse.json({ error: "El Nombre no puede exceder los 100 caracteres." }, { status: 400 });
    }
    if (descripcion.length > 500) {
      return NextResponse.json({ error: "La Descripción no puede exceder los 500 caracteres." }, { status: 400 });
    }

    // Try 1: Standard UPDATE with RETURNING *
    try {
      const sql1 = `
        UPDATE admin.tipo_usuario
        SET 
          codigo = $1,
          nombre = $2,
          descripcion = $3,
          nivel_acceso = $4,
          estado = $5,
          fecha_actualizacion = NOW()
        WHERE tipo_usuario_id = $6
        RETURNING *
      `;
      const res1 = await query(sql1, [codigo, nombre, descripcion, nivel_acceso, estado, typeId]);
      if (!res1 || res1.length === 0) {
        return NextResponse.json({ error: "No se encontró el registro para actualizar." }, { status: 404 });
      }
      return NextResponse.json({ success: true, item: res1[0] });
    } catch (err1: any) {
      console.warn("PUT Try 1 failed:", err1?.message);
      if (err1?.message?.includes("unique") || err1?.message?.includes("duplicate")) {
        if (err1?.message?.includes("codigo")) {
          return NextResponse.json({ error: "Ya existe un Tipo de Usuario con ese Código." }, { status: 400 });
        }
        return NextResponse.json({ error: "Ya existe un Tipo de Usuario con ese Nombre." }, { status: 400 });
      }

      // Try 2: UPDATE without RETURNING *
      try {
        const sql2 = `
          UPDATE admin.tipo_usuario
          SET 
            codigo = $1,
            nombre = $2,
            descripcion = $3,
            nivel_acceso = $4,
            estado = $5,
            fecha_actualizacion = NOW()
          WHERE tipo_usuario_id = $6
        `;
        await query(sql2, [codigo, nombre, descripcion, nivel_acceso, estado, typeId]);
        return NextResponse.json({ success: true });
      } catch (err2: any) {
        console.error("PUT Try 2 failed:", err2);
        return NextResponse.json({ error: "Error al actualizar tipo de usuario en PostgreSQL: " + (err2?.message || err1?.message) }, { status: 500 });
      }
    }
  } catch (error: any) {
    console.error("Error in PUT /api/tipos-usuario/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const typeId = parseInt(id, 10);

    await query(
      `DELETE FROM admin.tipo_usuario WHERE tipo_usuario_id = $1`,
      [typeId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE /api/tipos-usuario/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
