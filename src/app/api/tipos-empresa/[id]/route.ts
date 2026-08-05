import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const typeId = parseInt(id, 10);

    if (isNaN(typeId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json();
    const nombre = (body.nombre || body.name || '').trim();
    const descripcion = (body.descripcion || body.description || '').trim();
    const estadoStr = (body.estado || body.status || 'Activo').trim();
    const isActivo = estadoStr.toUpperCase() === 'ACTIVO';

    // Try 1: UPDATE with tipo_empresa_id and estado
    try {
      await query(
        `UPDATE admin.tipo_empresa 
         SET nombre = $1, descripcion = $2, estado = $3 
         WHERE tipo_empresa_id = $4`,
        [nombre, descripcion, estadoStr, typeId]
      );
      return NextResponse.json({ success: true, message: "Actualizado correctamente" });
    } catch (err1: any) {
      console.warn("PUT Try 1 failed:", err1?.message);
      
      // Try 2: UPDATE with id column
      try {
        await query(
          `UPDATE admin.tipo_empresa 
           SET nombre = $1, descripcion = $2, estado = $3 
           WHERE id = $4`,
          [nombre, descripcion, estadoStr, typeId]
        );
        return NextResponse.json({ success: true, message: "Actualizado correctamente" });
      } catch (err2: any) {
        console.warn("PUT Try 2 failed:", err2?.message);

        // Try 3: UPDATE with boolean activo column
        try {
          await query(
            `UPDATE admin.tipo_empresa 
             SET nombre = $1, descripcion = $2, activo = $3 
             WHERE tipo_empresa_id = $4 OR id = $4`,
            [nombre, descripcion, isActivo, typeId]
          );
          return NextResponse.json({ success: true, message: "Actualizado correctamente" });
        } catch (err3: any) {
          console.warn("PUT Try 3 failed:", err3?.message);

          // Try 4: UPDATE just nombre and descripcion
          await query(
            `UPDATE admin.tipo_empresa 
             SET nombre = $1, descripcion = $2 
             WHERE tipo_empresa_id = $3 OR id = $3`,
            [nombre, descripcion, typeId]
          );
          return NextResponse.json({ success: true, message: "Actualizado correctamente" });
        }
      }
    }
  } catch (error: any) {
    console.error("Error in PUT /api/tipos-empresa/[id]:", error);
    return NextResponse.json({ error: error.message || "Error al actualizar en base de datos" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const typeId = parseInt(id, 10);

    if (isNaN(typeId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    try {
      await query(`DELETE FROM admin.tipo_empresa WHERE tipo_empresa_id = $1`, [typeId]);
    } catch (e) {
      try {
        await query(`DELETE FROM admin.tipo_empresa WHERE id = $1`, [typeId]);
      } catch (e2: any) {
        console.error("Error deleting from admin.tipo_empresa:", e2);
        return NextResponse.json({ error: "Error al eliminar de la base de datos." }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: "Tipo de empresa eliminado correctamente" });
  } catch (error: any) {
    console.error("Error in DELETE /api/tipos-empresa/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
