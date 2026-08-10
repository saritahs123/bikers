import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

function parseStrictPositiveInteger(val: any): { isValidFormat: boolean; parsedValue: number | null } {
  if (val === null || val === undefined || val === "") {
    return { isValidFormat: false, parsedValue: null };
  }
  if (typeof val === "number") {
    if (Number.isInteger(val) && Number.isSafeInteger(val) && val > 0 && val <= 2147483647) {
      return { isValidFormat: true, parsedValue: val };
    }
    return { isValidFormat: false, parsedValue: null };
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (/^[1-9]\d*$/.test(trimmed)) {
      const num = Number(trimmed);
      if (Number.isSafeInteger(num) && num > 0 && num <= 2147483647) {
        return { isValidFormat: true, parsedValue: num };
      }
    }
    return { isValidFormat: false, parsedValue: null };
  }
  return { isValidFormat: false, parsedValue: null };
}

// PUT /api/taller/ordenes/[id]/servicios/[servicioId]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; servicioId: string }> }
) {
  try {
    const { id, servicioId } = await params;
    const ordenId = parseInt(id, 10);
    const sId = parseInt(servicioId, 10);

    if (isNaN(ordenId) || isNaN(sId)) {
      return NextResponse.json({ error: "IDs inválidos." }, { status: 400 });
    }

    const body = await req.json();
    const { estado_servicio_id, estado_aprobacion_id, precio_acordado, observaciones, mecanico_usuario_id, usuario_id } = body;

    const hasUsuarioId = Object.prototype.hasOwnProperty.call(body, "usuario_id") || Object.prototype.hasOwnProperty.call(body, "mecanico_usuario_id");
    const rawAssignedUser = body.usuario_id !== undefined ? body.usuario_id : body.mecanico_usuario_id;
    
    let mecIdToUpdate: number | null = null;

    if (hasUsuarioId) {
      if (rawAssignedUser === null || rawAssignedUser === "") {
        mecIdToUpdate = null;
      } else {
        const { isValidFormat, parsedValue } = parseStrictPositiveInteger(rawAssignedUser);
        if (!isValidFormat || parsedValue === null) {
          return NextResponse.json(
            { success: false, error: "El identificador del mecánico es inválido. Debe ser un entero positivo o nulo." },
            { status: 400 }
          );
        }

        // Check user existence first
        const userExists = await query(`SELECT usuario_id FROM admin.usuario WHERE usuario_id = $1`, [parsedValue]);
        if (!userExists || userExists.length === 0) {
          return NextResponse.json(
            { success: false, error: "El usuario especificado no existe." },
            { status: 404 }
          );
        }

        // Check active mechanic role
        const valRes = await query(
          `SELECT EXISTS (
             SELECT 1 FROM admin.usuario u
             JOIN admin.tipo_usuario tu ON tu.tipo_usuario_id = u.tipo_usuario_id
             WHERE u.usuario_id = $1 AND tu.codigo = 'MECANICO' AND u.estado = 'ACTIVO'
           ) AS is_valid`,
          [parsedValue]
        );
        if (!valRes[0]?.is_valid) {
          return NextResponse.json(
            { success: false, error: "El usuario seleccionado no es un mecánico activo válido." },
            { status: 400 }
          );
        }
        mecIdToUpdate = parsedValue;
      }
    }

    await query("BEGIN");

    // Lock Parent Order Row
    const lockRes = await query(
      `SELECT orden_trabajo_id FROM admin.ordenes_trabajo WHERE orden_trabajo_id = $1 FOR UPDATE`,
      [ordenId]
    );
    if (!lockRes || lockRes.length === 0) {
      await query("ROLLBACK");
      return NextResponse.json({ error: "Orden de trabajo no encontrada." }, { status: 404 });
    }

    // Verify service belongs to order
    const svcExists = await query(
      `SELECT orden_servicio_id FROM admin.orden_servicios WHERE orden_servicio_id = $1 AND orden_trabajo_id = $2`,
      [sId, ordenId]
    );
    if (!svcExists || svcExists.length === 0) {
      await query("ROLLBACK");
      return NextResponse.json({ error: "El servicio no existe en esta orden de trabajo." }, { status: 404 });
    }

    const updateFields: string[] = [];
    const paramsList: any[] = [];
    let pIdx = 1;

    if (estado_servicio_id !== undefined) {
      updateFields.push(`estado_orden_servicio_id = $${pIdx++}`);
      paramsList.push(parseInt(estado_servicio_id, 10));
    }
    if (estado_aprobacion_id !== undefined) {
      updateFields.push(`estado_aprobacion_id = $${pIdx++}`);
      paramsList.push(parseInt(estado_aprobacion_id, 10));
    }
    if (precio_acordado !== undefined && precio_acordado !== null) {
      updateFields.push(`precio_unitario = $${pIdx++}`);
      paramsList.push(parseFloat(precio_acordado));
    }
    if (observaciones !== undefined) {
      updateFields.push(`observacion_tecnica = $${pIdx++}`);
      paramsList.push(observaciones);
    }
    if (hasUsuarioId) {
      updateFields.push(`usuario_id = $${pIdx++}`);
      paramsList.push(mecIdToUpdate);
    }

    updateFields.push(`fecha_actualizacion = NOW()`);

    paramsList.push(sId);
    paramsList.push(ordenId);

    const updateSql = `
      UPDATE admin.orden_servicios
      SET ${updateFields.join(", ")}
      WHERE orden_servicio_id = $${pIdx++} AND orden_trabajo_id = $${pIdx++}
    `;

    await query(updateSql, paramsList);

    await query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Servicio actualizado exitosamente."
    });
  } catch (err: any) {
    await query("ROLLBACK").catch(() => {});
    console.error("PUT /api/taller/ordenes/[id]/servicios/[servicioId] Error:", err);
    return NextResponse.json({ error: "Error al actualizar el servicio." }, { status: 500 });
  }
}

// DELETE /api/taller/ordenes/[id]/servicios/[servicioId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; servicioId: string }> }
) {
  try {
    const { id, servicioId } = await params;
    const ordenId = parseInt(id, 10);
    const sId = parseInt(servicioId, 10);

    if (isNaN(ordenId) || isNaN(sId)) {
      return NextResponse.json({ error: "IDs inválidos." }, { status: 400 });
    }

    await query("BEGIN");

    // Lock Parent Order Row
    const lockRes = await query(
      `SELECT orden_trabajo_id FROM admin.ordenes_trabajo WHERE orden_trabajo_id = $1 FOR UPDATE`,
      [ordenId]
    );
    if (!lockRes || lockRes.length === 0) {
      await query("ROLLBACK");
      return NextResponse.json({ error: "Orden de trabajo no encontrada." }, { status: 404 });
    }

    // Verify service belongs to order
    const svcExists = await query(
      `SELECT orden_servicio_id FROM admin.orden_servicios WHERE orden_servicio_id = $1 AND orden_trabajo_id = $2`,
      [sId, ordenId]
    );
    if (!svcExists || svcExists.length === 0) {
      await query("ROLLBACK");
      return NextResponse.json({ error: "El servicio no existe en esta orden de trabajo." }, { status: 404 });
    }

    // Delete associated labor & products first
    await query(`DELETE FROM admin.orden_servicio_mano_obra WHERE orden_servicio_id = $1`, [sId]);
    await query(`DELETE FROM admin.orden_productos WHERE orden_servicio_id = $1`, [sId]);
    await query(`DELETE FROM admin.orden_servicios WHERE orden_servicio_id = $1 AND orden_trabajo_id = $2`, [sId, ordenId]);

    await query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Servicio eliminado de la orden."
    });
  } catch (err: any) {
    await query("ROLLBACK").catch(() => {});
    console.error("DELETE /api/taller/ordenes/[id]/servicios/[servicioId] Error:", err);
    return NextResponse.json({ error: "Error al eliminar el servicio." }, { status: 500 });
  }
}
