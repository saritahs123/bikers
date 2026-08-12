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

// POST /api/taller/ordenes/[id]/servicios
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ordenId = parseInt(id, 10);

    if (isNaN(ordenId)) {
      return NextResponse.json({ error: "ID de orden inválido." }, { status: 400 });
    }

    const body = await req.json();
    const { tipo_servicio_id, mecanico_usuario_id, usuario_id, precio_acordado, observaciones } = body;

    if (!tipo_servicio_id) {
      return NextResponse.json({ error: "El tipo de servicio es obligatorio." }, { status: 400 });
    }

    const rawAssignedUser = usuario_id !== undefined ? usuario_id : mecanico_usuario_id;
    let mecId: number | null = null;

    if (rawAssignedUser !== null && rawAssignedUser !== undefined && rawAssignedUser !== "") {
      const { isValidFormat, parsedValue } = parseStrictPositiveInteger(rawAssignedUser);

      if (!isValidFormat || parsedValue === null) {
        return NextResponse.json(
          { success: false, error: "El identificador del mecánico es inválido. Debe ser un entero positivo o nulo." },
          { status: 400 }
        );
      }
      mecId = parsedValue;

      const valRes = await query(
        `SELECT EXISTS (
           SELECT 1 FROM admin.usuario u
           JOIN admin.tipo_usuario tu ON tu.tipo_usuario_id = u.tipo_usuario_id
           WHERE u.usuario_id = $1 AND tu.codigo = 'MECANICO' AND u.estado = 'ACTIVO'
         ) AS is_valid`,
        [mecId]
      );
      if (!valRes[0]?.is_valid) {
        return NextResponse.json(
          { success: false, error: "El usuario seleccionado no es un mecánico activo válido." },
          { status: 400 }
        );
      }
    }

    await query("BEGIN");

    // Lock Parent Order Row and check order state
    const lockRes = await query(
      `SELECT ot.orden_trabajo_id, ot.estado_orden_id, eot.nombre AS estado_nombre
       FROM admin.ordenes_trabajo ot
       LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
       WHERE ot.orden_trabajo_id = $1 FOR UPDATE OF ot`,
      [ordenId]
    );
    if (!lockRes || lockRes.length === 0) {
      await query("ROLLBACK");
      return NextResponse.json({ error: "Orden de trabajo no encontrada." }, { status: 404 });
    }

    const parentOrder = lockRes[0];
    const parentStateId = parentOrder.estado_orden_id;

    // Block adding services if order is in LISTA_ENTREGA (7) or ENTREGADA (8)
    if (parentStateId === 7 || parentStateId === 8) {
      await query("ROLLBACK");
      return NextResponse.json({
        error: `No se pueden agregar servicios a una orden en estado ${parentOrder.estado_nombre || 'de solo lectura'}.`
      }, { status: 409 });
    }

    // Get service info and price base if not specified
    const tsRes = await query(`SELECT nombre, precio_base FROM admin.tipo_servicio WHERE tipo_servicio_id = $1`, [parseInt(tipo_servicio_id, 10)]);
    if (tsRes.length === 0) {
      await query("ROLLBACK");
      return NextResponse.json({ error: "El tipo de servicio seleccionado no existe." }, { status: 400 });
    }

    let finalPrecio = precio_acordado;
    if (finalPrecio === undefined || finalPrecio === null || finalPrecio === "") {
      finalPrecio = tsRes[0].precio_base || 0;
    }

    const insertSql = `
      INSERT INTO admin.orden_servicios (
        orden_servicio_id,
        orden_trabajo_id,
        tipo_servicio_id,
        estado_orden_servicio_id,
        estado_aprobacion_id,
        usuario_id,
        precio_unitario,
        observacion_tecnica,
        fecha_registro,
        activo
      ) VALUES (
        (SELECT COALESCE(MAX(orden_servicio_id), 0) + 1 FROM admin.orden_servicios),
        $1, $2, 1, 2, $3, $4, $5, NOW(), true
      )
      RETURNING orden_servicio_id, orden_trabajo_id, tipo_servicio_id, usuario_id, precio_unitario, observacion_tecnica
    `;

    const res = await query(insertSql, [
      ordenId,
      parseInt(tipo_servicio_id, 10),
      mecId,
      parseFloat(finalPrecio || 0),
      observaciones || null
    ]);

    // If added during REPARACION (5), log an audit history record
    if (parentStateId === 5) {
      await query(`
        INSERT INTO admin.orden_historial_estado (
          orden_historial_estado_id,
          orden_trabajo_id,
          estado_anterior_id,
          estado_nuevo_id,
          usuario_cambio,
          comentario,
          fecha_cambio,
          activo,
          fecha_registro
        ) VALUES (
          (SELECT COALESCE(MAX(orden_historial_estado_id), 0) + 1 FROM admin.orden_historial_estado),
          $1, 5, 5, 1, $2, NOW(), true, NOW()
        )
      `, [ordenId, `Servicio adicional agregado durante reparación: ${tsRes[0].nombre}`]);
    }

    await query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        data: res[0],
        message: "Servicio agregado exitosamente a la Orden de Trabajo."
      },
      { status: 201 }
    );
  } catch (err: any) {
    await query("ROLLBACK").catch(() => {});
    console.error("POST /api/taller/ordenes/[id]/servicios Error:", err);
    return NextResponse.json({ error: "Error al agregar servicio a la orden." }, { status: 500 });
  }
}
