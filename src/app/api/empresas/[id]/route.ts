import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const empresaId = parseInt(id, 10);

    if (isNaN(empresaId)) {
      return NextResponse.json({ error: "ID de empresa inválido." }, { status: 400 });
    }

    const rows = await query(`
      SELECT 
        e.*,
        te.nombre AS tipo_empresa_nombre,
        p.nombre_comercial AS empresa_padre_nombre
      FROM admin.empresa e
      LEFT JOIN admin.tipo_empresa te ON e.tipo_empresa_id = te.tipo_empresa_id
      LEFT JOIN admin.empresa p ON e.empresa_padre_id = p.empresa_id
      WHERE e.empresa_id = $1
    `, [empresaId]);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    console.error("Error in GET /api/empresas/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const empresaId = parseInt(id, 10);

    if (isNaN(empresaId)) {
      return NextResponse.json({ error: "ID de empresa inválido." }, { status: 400 });
    }

    const body = await req.json();
    const rnc = (body.rnc || '').trim();
    const codigo = (body.codigo || '').trim();
    const nombre_comercial = (body.nombre_comercial || '').trim();
    const alias = (body.alias || '').trim();
    const tipo_empresa_id = body.tipo_empresa_id ? parseInt(body.tipo_empresa_id, 10) : null;
    const empresa_padre_id = body.empresa_padre_id ? parseInt(body.empresa_padre_id, 10) : null;
    const logotipo_url = (body.logotipo_url || '').trim();
    const estado = body.estado || 'Activo';
    const color_identificador = body.color_identificador || '#bfce7f';
    const direccion = (body.direccion || '').trim();
    const telefono = (body.telefono || '').trim();
    const email = (body.email || '').trim();
    const descripcion = (body.descripcion || '').trim();

    // Validations
    if (!rnc) {
      return NextResponse.json({ error: "El RNC es obligatorio." }, { status: 400 });
    }
    if (!nombre_comercial) {
      return NextResponse.json({ error: "El Nombre Comercial es obligatorio." }, { status: 400 });
    }
    if (!tipo_empresa_id) {
      return NextResponse.json({ error: "Debe seleccionar un Tipo de Empresa." }, { status: 400 });
    }
    if (empresa_padre_id && empresa_padre_id === empresaId) {
      return NextResponse.json({ error: "Una empresa no puede ser empresa padre de sí misma." }, { status: 400 });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "El correo electrónico no tiene un formato válido." }, { status: 400 });
    }

    // Check RNC uniqueness for other records
    try {
      const rncCheck = await query(
        `SELECT 1 FROM admin.empresa WHERE LOWER(rnc) = LOWER($1) AND empresa_id != $2 LIMIT 1`,
        [rnc, empresaId]
      );
      if (rncCheck && rncCheck.length > 0) {
        return NextResponse.json(
          { error: `El RNC "${rnc}" ya pertenece a otra empresa en el sistema.` },
          { status: 400 }
        );
      }
    } catch (e) {
      console.warn("RNC uniqueness update check error:", e);
    }

    // Check Codigo uniqueness for other records if provided
    if (codigo) {
      try {
        const codCheck = await query(
          `SELECT 1 FROM admin.empresa WHERE LOWER(codigo) = LOWER($1) AND empresa_id != $2 LIMIT 1`,
          [codigo, empresaId]
        );
        if (codCheck && codCheck.length > 0) {
          return NextResponse.json(
            { error: `El código "${codigo}" ya pertenece a otra empresa.` },
            { status: 400 }
          );
        }
      } catch (e) {
        console.warn("Codigo uniqueness update check error:", e);
      }
    }

    // Try 1: UPDATE with all fields + fecha_actualizacion = NOW()
    try {
      await query(
        `UPDATE admin.empresa
         SET rnc = $1,
             codigo = $2,
             nombre_comercial = $3,
             alias = $4,
             tipo_empresa_id = $5,
             empresa_padre_id = $6,
             logotipo_url = $7,
             estado = $8,
             color_identificador = $9,
             direccion = $10,
             telefono = $11,
             email = $12,
             descripcion = $13,
             fecha_actualizacion = NOW()
         WHERE empresa_id = $14`,
        [
          rnc, codigo || null, nombre_comercial, alias || null, tipo_empresa_id, empresa_padre_id || null,
          logotipo_url || null, estado, color_identificador, direccion || null, telefono || null, email || null, descripcion || null, empresaId
        ]
      );
      return NextResponse.json({ success: true, message: "Empresa actualizada correctamente." });
    } catch (err1: any) {
      console.warn("PUT Try 1 failed:", err1?.message);

      // Try 2: UPDATE without fecha_actualizacion
      try {
        await query(
          `UPDATE admin.empresa
           SET rnc = $1,
               codigo = $2,
               nombre_comercial = $3,
               alias = $4,
               tipo_empresa_id = $5,
               empresa_padre_id = $6,
               logotipo_url = $7,
               estado = $8,
               color_identificador = $9,
               direccion = $10,
               telefono = $11,
               email = $12,
               descripcion = $13
           WHERE empresa_id = $14`,
          [
            rnc, codigo || null, nombre_comercial, alias || null, tipo_empresa_id, empresa_padre_id || null,
            logotipo_url || null, estado, color_identificador, direccion || null, telefono || null, email || null, descripcion || null, empresaId
          ]
        );
        return NextResponse.json({ success: true, message: "Empresa actualizada correctamente." });
      } catch (err2: any) {
        console.warn("PUT Try 2 failed:", err2?.message);

        // Try 3: Core fields update
        try {
          await query(
            `UPDATE admin.empresa
             SET rnc = $1,
                 nombre_comercial = $2,
                 tipo_empresa_id = $3,
                 estado = $4
             WHERE empresa_id = $5`,
            [rnc, nombre_comercial, tipo_empresa_id, estado, empresaId]
          );
          return NextResponse.json({ success: true, message: "Empresa actualizada correctamente." });
        } catch (err3: any) {
          console.error("PUT Try 3 failed:", err3);
          return NextResponse.json({ error: "Error al actualizar en base de datos: " + (err3?.message || err1?.message) }, { status: 500 });
        }
      }
    }
  } catch (error: any) {
    console.error("Error in PUT /api/empresas/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const empresaId = parseInt(id, 10);

    if (isNaN(empresaId)) {
      return NextResponse.json({ error: "ID de empresa inválido." }, { status: 400 });
    }

    try {
      await query(`DELETE FROM admin.empresa WHERE empresa_id = $1`, [empresaId]);
    } catch (e: any) {
      console.error("Error deleting from admin.empresa:", e);
      return NextResponse.json({ error: "Error al eliminar la empresa de la base de datos: " + e.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Empresa eliminada correctamente." });
  } catch (error: any) {
    console.error("Error in DELETE /api/empresas/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
