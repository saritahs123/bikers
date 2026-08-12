import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// Helper to check if service is completed
async function isServiceCompleted(servicioId: number): Promise<boolean> {
  const res = await query(
    `SELECT estado_orden_servicio_id FROM admin.orden_servicios WHERE orden_servicio_id = $1`,
    [servicioId]
  );
  return res[0]?.estado_orden_servicio_id === 3;
}

// POST /api/taller/ordenes/[id]/servicios/[servicioId]/mano-obra
export async function POST(
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
    const svcCheck = await query(
      `SELECT orden_servicio_id, estado_orden_servicio_id, usuario_id FROM admin.orden_servicios WHERE orden_servicio_id = $1 AND orden_trabajo_id = $2`,
      [sId, ordenId]
    );
    if (!svcCheck || svcCheck.length === 0) {
      await query("ROLLBACK");
      return NextResponse.json({ error: "El servicio no existe en esta orden de trabajo." }, { status: 404 });
    }

    if (svcCheck[0].estado_orden_servicio_id === 3) {
      await query("ROLLBACK");
      return NextResponse.json({ error: "No se puede agregar mano de obra a un servicio completado." }, { status: 400 });
    }

    const body = await req.json();
    const { mecanico_usuario_id, usuario_id, descripcion, observacion, horas_estimadas, horas_reales, costo_hora } = body;

    // Get assigned mechanic for service if not passed
    let userId = usuario_id || mecanico_usuario_id || svcCheck[0].usuario_id || 2;
    userId = parseInt(userId, 10);

    const rawHours = horas_reales !== undefined ? horas_reales : horas_estimadas;
    const parsedHours = rawHours !== undefined ? parseFloat(rawHours) : 1;
    if (isNaN(parsedHours) || parsedHours <= 0) {
      await query("ROLLBACK");
      return NextResponse.json(
        { success: false, error: "Las horas trabajadas deben ser un número positivo mayor a 0." },
        { status: 400 }
      );
    }
    const validHours = parsedHours;
    const minutos = Math.round(validHours * 60);

    const parsedCostoHora = costo_hora !== undefined ? parseFloat(costo_hora) : 0;
    if (isNaN(parsedCostoHora) || parsedCostoHora < 0) {
      await query("ROLLBACK");
      return NextResponse.json(
        { success: false, error: "El costo por hora no puede ser un monto negativo." },
        { status: 400 }
      );
    }
    const validCostoHora = parsedCostoHora;
    const costoTotal = (minutos / 60) * validCostoHora;

    const obsText = observacion || descripcion || "Registro de mano de obra";

    const sql = `
      INSERT INTO admin.orden_servicio_mano_obra (
        orden_servicio_mano_obra_id,
        orden_servicio_id,
        usuario_id,
        fecha_inicio,
        fecha_finalizacion,
        minutos_trabajados,
        minutos_facturables,
        costo_hora,
        costo_total,
        observacion,
        activo,
        fecha_registro
      ) VALUES (
        (SELECT COALESCE(MAX(orden_servicio_mano_obra_id), 0) + 1 FROM admin.orden_servicio_mano_obra),
        $1,
        $2,
        NOW() - INTERVAL '1 minute' * $3,
        NOW(),
        $3,
        $4,
        $5,
        $6,
        $7,
        true,
        NOW()
      )
      RETURNING orden_servicio_mano_obra_id
    `;

    const res = await query(sql, [
      sId,
      userId,
      minutos,
      minutos,
      validCostoHora,
      costoTotal,
      obsText
    ]);

    // Automatically transition service status to EN_PROCESO (ID 2) when labor is registered
    await query(
      `UPDATE admin.orden_servicios
       SET estado_orden_servicio_id = 2,
           fecha_actualizacion = NOW()
       WHERE orden_servicio_id = $1 AND orden_trabajo_id = $2 AND (estado_orden_servicio_id IS NULL OR estado_orden_servicio_id = 1)`,
      [sId, ordenId]
    );

    await query("COMMIT");

    return NextResponse.json({
      success: true,
      data: res[0],
      message: "Registro de mano de obra agregado exitosamente."
    });
  } catch (err: any) {
    await query("ROLLBACK").catch(() => {});
    console.error("POST mano-obra Error:", err);
    return NextResponse.json({ error: err.message || "Error al registrar mano de obra." }, { status: 500 });
  }
}

// PUT /api/taller/ordenes/[id]/servicios/[servicioId]/mano-obra
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
    const svcCheck = await query(
      `SELECT orden_servicio_id, estado_orden_servicio_id FROM admin.orden_servicios WHERE orden_servicio_id = $1 AND orden_trabajo_id = $2`,
      [sId, ordenId]
    );
    if (!svcCheck || svcCheck.length === 0) {
      await query("ROLLBACK");
      return NextResponse.json({ error: "El servicio no existe en esta orden de trabajo." }, { status: 404 });
    }

    if (svcCheck[0].estado_orden_servicio_id === 3) {
      await query("ROLLBACK");
      return NextResponse.json({ error: "No se puede editar la mano de obra de un servicio completado." }, { status: 400 });
    }

    const body = await req.json();
    const { mano_obra_id, orden_servicio_mano_obra_id, descripcion, observacion, horas_reales, horas_estimadas, costo_hora } = body;

    const mId = parseInt(mano_obra_id || orden_servicio_mano_obra_id, 10);
    if (isNaN(mId)) {
      await query("ROLLBACK");
      return NextResponse.json({ error: "ID de mano de obra inválido." }, { status: 400 });
    }

    // Check labor belongs to service
    const laborCheck = await query(
      `SELECT orden_servicio_mano_obra_id FROM admin.orden_servicio_mano_obra WHERE orden_servicio_mano_obra_id = $1 AND orden_servicio_id = $2`,
      [mId, sId]
    );
    if (!laborCheck || laborCheck.length === 0) {
      await query("ROLLBACK");
      return NextResponse.json({ error: "El registro de mano de obra no pertenece al servicio especificado." }, { status: 404 });
    }

    const parsedHours = parseFloat(horas_reales || horas_estimadas || 1);
    const validHours = isNaN(parsedHours) || parsedHours <= 0 ? 1 : parsedHours;
    const minutos = Math.round(validHours * 60);

    const parsedCostoHora = parseFloat(costo_hora || 0);
    const validCostoHora = isNaN(parsedCostoHora) || parsedCostoHora < 0 ? 0 : parsedCostoHora;
    const costoTotal = (minutos / 60) * validCostoHora;

    const obsText = observacion || descripcion || "Registro de mano de obra";

    const updateSql = `
      UPDATE admin.orden_servicio_mano_obra
      SET
        observacion = $1,
        minutos_trabajados = $2,
        minutos_facturables = $2,
        costo_hora = $3,
        costo_total = $4,
        fecha_actualizacion = NOW()
      WHERE orden_servicio_mano_obra_id = $5 AND orden_servicio_id = $6
    `;

    await query(updateSql, [obsText, minutos, validCostoHora, costoTotal, mId, sId]);

    await query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Mano de obra actualizada exitosamente."
    });
  } catch (err: any) {
    await query("ROLLBACK").catch(() => {});
    console.error("PUT mano-obra Error:", err);
    return NextResponse.json({ error: err.message || "Error al actualizar mano de obra." }, { status: 500 });
  }
}

// DELETE /api/taller/ordenes/[id]/servicios/[servicioId]/mano-obra
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
    const svcCheck = await query(
      `SELECT orden_servicio_id, estado_orden_servicio_id FROM admin.orden_servicios WHERE orden_servicio_id = $1 AND orden_trabajo_id = $2`,
      [sId, ordenId]
    );
    if (!svcCheck || svcCheck.length === 0) {
      await query("ROLLBACK");
      return NextResponse.json({ error: "El servicio no existe en esta orden de trabajo." }, { status: 404 });
    }

    if (svcCheck[0].estado_orden_servicio_id === 3) {
      await query("ROLLBACK");
      return NextResponse.json({ error: "No se puede eliminar mano de obra de un servicio completado." }, { status: 400 });
    }

    const url = new URL(req.url);
    const mIdParam = url.searchParams.get("mano_obra_id") || url.searchParams.get("orden_servicio_mano_obra_id") || url.searchParams.get("id");
    if (!mIdParam) {
      await query("ROLLBACK");
      return NextResponse.json({ error: "ID de mano de obra es requerido." }, { status: 400 });
    }
    const mId = parseInt(mIdParam, 10);

    // Check labor belongs to service
    const laborCheck = await query(
      `SELECT orden_servicio_mano_obra_id FROM admin.orden_servicio_mano_obra WHERE orden_servicio_mano_obra_id = $1 AND orden_servicio_id = $2`,
      [mId, sId]
    );
    if (!laborCheck || laborCheck.length === 0) {
      await query("ROLLBACK");
      return NextResponse.json({ error: "El registro de mano de obra no pertenece al servicio especificado." }, { status: 404 });
    }

    await query(
      `DELETE FROM admin.orden_servicio_mano_obra WHERE orden_servicio_mano_obra_id = $1 AND orden_servicio_id = $2`,
      [mId, sId]
    );

    await query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Registro de mano de obra eliminado."
    });
  } catch (err: any) {
    await query("ROLLBACK").catch(() => {});
    console.error("DELETE mano-obra Error:", err);
    return NextResponse.json({ error: err.message || "Error al eliminar mano de obra." }, { status: 500 });
  }
}
