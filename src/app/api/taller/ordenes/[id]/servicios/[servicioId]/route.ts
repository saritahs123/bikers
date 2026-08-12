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
    const { estado_servicio_id, estado_aprobacion_id, precio_acordado, observaciones, motivo_reapertura, mecanico_usuario_id, usuario_id } = body;

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

        const userExists = await query(`SELECT usuario_id FROM admin.usuario WHERE usuario_id = $1`, [parsedValue]);
        if (!userExists || userExists.length === 0) {
          return NextResponse.json(
            { success: false, error: "El usuario especificado no existe." },
            { status: 404 }
          );
        }

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

    // Lock Parent Order Row and check state
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

    // Block modifications if order is in LISTA_ENTREGA (7) or ENTREGADA (8)
    if (parentStateId === 7 || parentStateId === 8) {
      await query("ROLLBACK");
      return NextResponse.json({
        error: `No se pueden modificar servicios de una orden en estado ${parentOrder.estado_nombre || 'de solo lectura'}.`
      }, { status: 409 });
    }

    // Verify service belongs to order
    const svcExists = await query(
      `SELECT os.orden_servicio_id, os.estado_orden_servicio_id, eos.codigo AS estado_codigo, ts.nombre AS tipo_servicio_nombre
       FROM admin.orden_servicios os
       LEFT JOIN admin.tipo_servicio ts ON os.tipo_servicio_id = ts.tipo_servicio_id
       LEFT JOIN admin.estado_orden_servicio eos ON os.estado_orden_servicio_id = eos.estado_orden_servicio_id
       WHERE os.orden_servicio_id = $1 AND os.orden_trabajo_id = $2`,
      [sId, ordenId]
    );
    if (!svcExists || svcExists.length === 0) {
      await query("ROLLBACK");
      return NextResponse.json({ error: "El servicio no existe en esta orden de trabajo." }, { status: 404 });
    }

    const currentSvc = svcExists[0];
    const currentSvcStateId = currentSvc.estado_orden_servicio_id;
    const targetSvcStateId = estado_servicio_id !== undefined ? parseInt(estado_servicio_id, 10) : currentSvcStateId;

    // Rule: In RECIBIDA (1), service state CANNOT be changed to EN_PROCESO (2) or COMPLETADO (3)
    if (parentStateId === 1 && targetSvcStateId !== currentSvcStateId) {
      await query("ROLLBACK");
      return NextResponse.json({
        error: "No se pueden iniciar ni completar servicios mientras la orden esté en estado Recibida. Pasa la orden a Reparación primero."
      }, { status: 409 });
    }

    // Rule: Service State Transitions in REPARACION (5)
    if (targetSvcStateId !== currentSvcStateId) {
      // Reopening a COMPLETADO (3) service -> EN_PROCESO (2)
      if (currentSvcStateId === 3) {
        if (targetSvcStateId !== 2) {
          await query("ROLLBACK");
          return NextResponse.json({
            error: "Un servicio completado solo puede reabrirse al estado En Proceso."
          }, { status: 409 });
        }

        const reason = motivo_reapertura || observaciones;
        if (!reason || !reason.trim()) {
          await query("ROLLBACK");
          return NextResponse.json({
            error: "Debes ingresar un motivo obligatorio para reabrir un servicio completado."
          }, { status: 400 });
        }

        // Log audit history for service reopening
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
        `, [ordenId, `Reapertura de servicio '${currentSvc.tipo_servicio_nombre}': ${reason}`]);
      } else {
        // Normal transitions:
        // PENDIENTE (1) -> EN_PROCESO (2)
        // EN_PROCESO (2) -> PAUSADO (5) / SUSPENDIDO
        // PAUSADO (5) -> EN_PROCESO (2)
        // EN_PROCESO (2) -> COMPLETADO (3)
        const validNextStates: Record<number, number[]> = {
          1: [2, 4],    // PENDIENTE -> EN_PROCESO, CANCELADO
          2: [3, 4, 5], // EN_PROCESO -> COMPLETADO, CANCELADO, SUSPENDIDO/PAUSADO
          5: [2, 4],    // SUSPENDIDO/PAUSADO -> EN_PROCESO, CANCELADO
          4: []
        };

        const allowedNext = validNextStates[currentSvcStateId] || [];
        if (!allowedNext.includes(targetSvcStateId)) {
          await query("ROLLBACK");
          return NextResponse.json({
            error: "Transición no permitida para el servicio. Debe pasar a En Proceso antes de ser Completado."
          }, { status: 409 });
        }
      }
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

    // Lock Parent Order Row and check state
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

    if (parentStateId === 7 || parentStateId === 8) {
      await query("ROLLBACK");
      return NextResponse.json({
        error: `No se pueden eliminar servicios de una orden en estado ${parentOrder.estado_nombre || 'de solo lectura'}.`
      }, { status: 409 });
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

    // Check if labor or products exist for this service
    const laborCheck = await query(`SELECT COUNT(*)::int AS count FROM admin.orden_servicio_mano_obra WHERE orden_servicio_id = $1`, [sId]);
    const prodCheck = await query(`SELECT COUNT(*)::int AS count FROM admin.orden_productos WHERE orden_servicio_id = $1`, [sId]);

    const hasLabor = (laborCheck[0]?.count || 0) > 0;
    const hasProducts = (prodCheck[0]?.count || 0) > 0;

    if (hasLabor || hasProducts) {
      await query("ROLLBACK");
      return NextResponse.json({
        error: "No se puede eliminar un servicio que ya tiene mano de obra o repuestos registrados."
      }, { status: 409 });
    }

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
