import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const areaId = parseInt(id, 10);

    const rows = await query(
      `SELECT a.*, d.nombre AS departamento_nombre 
       FROM admin.area a
       LEFT JOIN admin.departamento d ON a.departamento_id = d.departamento_id
       WHERE a.area_id = $1 LIMIT 1`,
      [areaId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Área no encontrada" }, { status: 404 });
    }

    const r = rows[0];
    return NextResponse.json({
      id: r.area_id ?? r.id,
      area_id: r.area_id ?? r.id,
      departamento_id: r.departamento_id,
      departamento_nombre: r.departamento_nombre || 'Sin Departamento',
      nombre: r.nombre || '',
      estado: (r.estado || 'ACTIVO').toString().toUpperCase(),
      fecha_creacion: r.fecha_creacion ? String(r.fecha_creacion).substring(0, 10) : null,
      fecha_actualizacion: r.fecha_actualizacion ? String(r.fecha_actualizacion).substring(0, 10) : null
    });
  } catch (error: any) {
    console.error("Error in GET /api/areas/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const areaId = parseInt(id, 10);
    const body = await req.json();

    const departamento_id = body.departamento_id ? parseInt(body.departamento_id, 10) : null;
    const nombre = (body.nombre || '').trim();
    const estadoInput = (body.estado || 'ACTIVO').toString().trim().toUpperCase();
    const estado = (estadoInput === 'INACTIVO' || estadoInput === 'INACTIVOS') ? 'INACTIVO' : 'ACTIVO';

    if (!departamento_id || isNaN(departamento_id)) {
      return NextResponse.json({ error: "Debe seleccionar un Departamento válido." }, { status: 400 });
    }
    if (!nombre) {
      return NextResponse.json({ error: "El Nombre del Área es obligatorio." }, { status: 400 });
    }
    if (nombre.length > 100) {
      return NextResponse.json({ error: "El Nombre no puede exceder los 100 caracteres." }, { status: 400 });
    }

    // Try 1: Standard UPDATE with RETURNING *
    try {
      const sql1 = `
        UPDATE admin.area
        SET 
          departamento_id = $1,
          nombre = $2,
          estado = $3,
          fecha_actualizacion = NOW()
        WHERE area_id = $4
        RETURNING *
      `;
      const res1 = await query(sql1, [departamento_id, nombre, estado, areaId]);
      if (!res1 || res1.length === 0) {
        return NextResponse.json({ error: "No se encontró el registro para actualizar." }, { status: 404 });
      }
      return NextResponse.json({ success: true, item: res1[0] });
    } catch (err1: any) {
      console.warn("PUT Try 1 failed:", err1?.message);
      
      // Try 2: UPDATE without RETURNING *
      try {
        const sql2 = `
          UPDATE admin.area
          SET 
            departamento_id = $1,
            nombre = $2,
            estado = $3,
            fecha_actualizacion = NOW()
          WHERE area_id = $4
        `;
        await query(sql2, [departamento_id, nombre, estado, areaId]);
        return NextResponse.json({ success: true });
      } catch (err2: any) {
        console.error("PUT Try 2 failed:", err2);
        return NextResponse.json({ error: "Error al actualizar área en PostgreSQL: " + (err2?.message || err1?.message) }, { status: 500 });
      }
    }
  } catch (error: any) {
    console.error("Error in PUT /api/areas/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const areaId = parseInt(id, 10);

    await query(
      `DELETE FROM admin.area WHERE area_id = $1`,
      [areaId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE /api/areas/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
