import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { recalculateWorkOrderTotals } from "@/lib/workshop/recalculateWorkOrderTotals";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { validateOrderInRepair } from "@/lib/workshop/validateOrderState";
import { recordUserActivity, recordUserAudit } from "@/lib/auditLogger";

// GET /api/taller/ordenes/[id]/servicios/[servicioId]/mano-obra
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; servicioId: string }> }
) {
  const { id, servicioId } = await params;

  if (!id || !servicioId || !/^\d+$/.test(id.trim()) || !/^\d+$/.test(servicioId.trim())) {
    return NextResponse.json({ error: "INVALID_ID", message: "IDs no válidos." }, { status: 400 });
  }
  const ordenId = Number(id.trim());
  const servId = Number(servicioId.trim());

  const session = await getWorkshopSession();
  if (!session || !session.usuario_id) {
    return NextResponse.json({ error: "NO_SESSION", message: "Sesión no válida o expirada." }, { status: 401 });
  }

  const perms = await getModulePermissions("TALLER", session.usuario_id);
  if (!perms.puede_ver) {
    return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso para ver mano de obra." }, { status: 403 });
  }

  const pool = getPool();
  try {
    const res = await pool.query(`
      SELECT 
        mo.orden_servicio_mano_obra_id AS mano_obra_id,
        mo.orden_servicio_mano_obra_id AS id,
        mo.orden_servicio_id,
        mo.usuario_id AS mecanico_usuario_id,
        mo.usuario_id,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), ui.correo_electronico, u.usuario_id::text) AS mecanico_nombre,
        mo.fecha_inicio,
        mo.fecha_finalizacion,
        mo.minutos_trabajados,
        ROUND(mo.minutos_trabajados / 60.0, 2) AS horas_trabajadas,
        ROUND(mo.minutos_trabajados / 60.0, 2) AS horas_reales,
        mo.costo_hora,
        mo.costo_total AS subtotal,
        COALESCE(mo.detalle_mano_obra, mo.observacion) AS detalle_mano_obra,
        mo.observacion AS descripcion,
        mo.observacion AS observaciones,
        (mo.fecha_finalizacion IS NULL) AS es_abierta
      FROM admin.orden_servicio_mano_obra mo
      JOIN admin.orden_servicios os ON mo.orden_servicio_id = os.orden_servicio_id
      JOIN admin.ordenes_trabajo ot ON os.orden_trabajo_id = ot.orden_trabajo_id
      JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
      LEFT JOIN admin.usuario u ON mo.usuario_id = u.usuario_id
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      WHERE mo.orden_servicio_id = $1 
        AND os.orden_trabajo_id = $2
        AND c.empresa_id = $3
        AND (mo.activo IS DISTINCT FROM false)
        AND (os.activo IS DISTINCT FROM false)
        AND (ot.activo IS DISTINCT FROM false)
        AND mo.detalle_mano_obra IS NOT NULL
        AND BTRIM(mo.detalle_mano_obra) <> ''
      ORDER BY mo.orden_servicio_mano_obra_id ASC
    `, [servId, ordenId, session.empresa_id]);

    return NextResponse.json({
      success: true,
      data: res.rows || []
    });
  } catch (err: any) {
    console.error("GET /api/taller/ordenes/[id]/servicios/[servicioId]/mano-obra Error:", err);
    return NextResponse.json({ error: "Error al consultar mano de obra.", details: err.message }, { status: 500 });
  }
}

// POST /api/taller/ordenes/[id]/servicios/[servicioId]/mano-obra
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; servicioId: string }> }
) {
  const { id, servicioId } = await params;

  if (!id || !servicioId || !/^\d+$/.test(id.trim()) || !/^\d+$/.test(servicioId.trim())) {
    return NextResponse.json({ error: "INVALID_ID", message: "IDs no válidos." }, { status: 400 });
  }
  const ordenId = Number(id.trim());
  const servId = Number(servicioId.trim());

  const session = await getWorkshopSession();
  if (!session || !session.usuario_id) {
    return NextResponse.json({ error: "NO_SESSION", message: "Sesión no válida o expirada." }, { status: 401 });
  }
  const sessionUserId = session.usuario_id;

  const perms = await getModulePermissions("TALLER", session.usuario_id);
  if (!perms.puede_editar) {
    return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso para modificar la mano de obra." }, { status: 403 });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    const body = await req.json();
    const { mecanico_usuario_id, minutos_trabajados, costo_hora_personalizado, horas_reales, costo_hora } = body;
    const rawDetail = body.detalle_mano_obra ?? body.descripcion ?? body.observacion;
    const detailText = typeof rawDetail === "string" ? rawDetail.trim() : "";

    if (!detailText) {
      return NextResponse.json({
        error: "LABOR_DETAIL_REQUIRED",
        message: "Describe el trabajo realizado."
      }, { status: 400 });
    }

    await client.query("BEGIN");

    // Lock Order Row and enforce order state machine check
    const orderStateCheck = await validateOrderInRepair(client, ordenId, session.empresa_id, "AGREGAR_MANO_OBRA");
    if (!orderStateCheck.isValid) {
      await client.query("ROLLBACK");
      return orderStateCheck.response;
    }

    // Verify service exists
    const servRes = await client.query(`
      SELECT orden_servicio_id, tipo_servicio_id, usuario_id
      FROM admin.orden_servicios
      WHERE orden_servicio_id = $1 AND orden_trabajo_id = $2 AND (activo IS DISTINCT FROM false)
    `, [servicioId, ordenId]);

    if (servRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Servicio no encontrado." }, { status: 404 });
    }

    const serv = servRes.rows[0];
    let mecUserId = sessionUserId;
    if (mecanico_usuario_id) {
      const parsedMecId = parseInt(mecanico_usuario_id, 10);
      if (!isNaN(parsedMecId) && parsedMecId > 0) {
        const mecCheck = await client.query(
          `SELECT usuario_id FROM admin.usuario WHERE usuario_id = $1 AND empresa_id = $2 AND (estado = 'ACTIVO' OR estado IS NULL) LIMIT 1`,
          [parsedMecId, session.empresa_id]
        );
        if (!mecCheck.rows.length) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            error: "INVALID_MECHANIC",
            message: "El mecánico asignado no pertenece a su empresa o está inactivo."
          }, { status: 400 });
        }
        mecUserId = parsedMecId;
      }
    } else if (serv.usuario_id) {
      mecUserId = serv.usuario_id;
    }
    
    const rawHours = horas_reales ?? body.horas_trabajadas;
    const mins = (rawHours !== undefined && rawHours !== null && rawHours !== "" && !isNaN(parseFloat(rawHours)))
      ? Math.max(1, Math.round(parseFloat(rawHours) * 60))
      : Math.max(1, parseInt(minutos_trabajados || "60", 10));

    // Determine hourly rate safely
    let rate = 0.00;
    const customRate = costo_hora_personalizado ?? costo_hora;
    if (customRate !== undefined && customRate !== null && customRate !== "") {
      const parsedRate = parseFloat(customRate);
      rate = isNaN(parsedRate) || parsedRate <= 0 ? 0.00 : parsedRate;
    } else {
      const tsRes = await client.query(`SELECT precio_base, duracion_estimada_horas FROM admin.tipo_servicio WHERE tipo_servicio_id = $1`, [serv.tipo_servicio_id]);
      if (tsRes.rows.length > 0) {
        const pb = parseFloat(tsRes.rows[0].precio_base || 0);
        const dur = parseFloat(tsRes.rows[0]?.duracion_estimada_horas || 1);
        rate = dur > 0 ? Math.round((pb / dur) * 100) / 100 : pb;
      }
    }

    const costoTotal = Math.round(((mins / 60.0) * rate) * 100) / 100;

    // Insert Manual Closed Labor Session with detalle_mano_obra AND observacion using PostgreSQL sequence
    const insertLaborSql = `
      INSERT INTO admin.orden_servicio_mano_obra (
        orden_servicio_id,
        usuario_id,
        fecha_inicio,
        fecha_finalizacion,
        minutos_trabajados,
        minutos_facturables,
        costo_hora,
        costo_total,
        observacion,
        detalle_mano_obra,
        activo,
        fecha_registro,
        usuario_registro
      ) VALUES (
        $1, $2, NOW() - ($3::integer || ' minutes')::interval, NOW(), $3::integer, $3::integer, $4, $5, $7::text, $8::text, true, NOW(), $6
      )
      RETURNING 
        orden_servicio_mano_obra_id AS mano_obra_id,
        orden_servicio_mano_obra_id AS id,
        orden_servicio_id,
        usuario_id AS mecanico_usuario_id,
        minutos_trabajados,
        ROUND(minutos_trabajados / 60.0, 2) AS horas_trabajadas,
        ROUND(minutos_trabajados / 60.0, 2) AS horas_reales,
        costo_hora,
        costo_total AS subtotal,
        COALESCE(detalle_mano_obra, observacion) AS detalle_mano_obra,
        observacion AS descripcion,
        observacion
    `;

    const laborRes = await client.query(insertLaborSql, [
      servicioId,
      mecUserId,
      mins,
      rate,
      costoTotal,
      sessionUserId,
      detailText || null,
      detailText || null
    ]);

    await recalculateWorkOrderTotals(client, ordenId);

    const insertedLabor = laborRes.rows[0];

    await recordUserAudit({
      userId: sessionUserId,
      accion: "REGISTRAR_MANO_OBRA_MANUAL",
      valorNuevo: {
        orden_servicio_mano_obra_id: insertedLabor.mano_obra_id,
        orden_servicio_id: servId,
        minutos_trabajados: mins,
        costo_total: costoTotal,
        detalle: detailText
      },
      motivo: "Registro de mano de obra manual",
      resultado: "COMPLETADO",
      client,
      throwOnError: true
    });

    await client.query("COMMIT");

    await recordUserActivity({
      userId: sessionUserId,
      modulo: "TALLER_MANO_OBRA",
      evento: "LABOR_MANUAL_REGISTERED",
      descripcion: `Mano de obra registrada en servicio #${servId} (${mins} min, total $${costoTotal})`,
      resultado: "Exitoso",
      req
    });

    return NextResponse.json({
      success: true,
      data: insertedLabor,
      message: "Registro de mano de obra añadido exitosamente."
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /api/taller/ordenes/[id]/servicios/[servicioId]/mano-obra Error:", err);
    return NextResponse.json({ error: "Error al registrar mano de obra.", details: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// PUT /api/taller/ordenes/[id]/servicios/[servicioId]/mano-obra
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; servicioId: string }> }
) {
  const { id, servicioId } = await params;

  if (!id || !servicioId || !/^\d+$/.test(id.trim()) || !/^\d+$/.test(servicioId.trim())) {
    return NextResponse.json({ error: "INVALID_ID", message: "IDs no válidos." }, { status: 400 });
  }
  const ordenId = Number(id.trim());
  const servId = Number(servicioId.trim());

  const session = await getWorkshopSession();
  if (!session || !session.usuario_id) {
    return NextResponse.json({ error: "NO_SESSION", message: "Sesión no válida o expirada." }, { status: 401 });
  }
  const sessionUserId = session.usuario_id;

  const perms = await getModulePermissions("TALLER", session.usuario_id);
  if (!perms.puede_editar) {
    return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso para modificar la mano de obra." }, { status: 403 });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    const body = await req.json();
    const manoObraId = Number(body.mano_obra_id || body.orden_servicio_mano_obra_id || body.id);
    if (!Number.isInteger(manoObraId) || manoObraId <= 0) {
      return NextResponse.json({ error: "INVALID_MANO_OBRA_ID", message: "ID de mano de obra no válido." }, { status: 400 });
    }

    const detailText = (body.detalle_mano_obra || body.descripcion || body.observacion || "").trim();
    const rawHours = body.horas_reales ?? body.horas_trabajadas;
    const mins = (rawHours !== undefined && rawHours !== null && rawHours !== "" && !isNaN(parseFloat(rawHours)))
      ? Math.max(1, Math.round(parseFloat(rawHours) * 60))
      : 60;
    const rate = (body.costo_hora !== undefined && body.costo_hora !== null && !isNaN(parseFloat(body.costo_hora)))
      ? Math.max(0, parseFloat(body.costo_hora))
      : 0.00;
    const costoTotal = Math.round(((mins / 60.0) * rate) * 100) / 100;

    await client.query("BEGIN");

    // Lock Order Row Exclusively with canonical client company check
    const orderRes = await client.query(`
      SELECT ot.orden_trabajo_id, ot.estado_orden_id, c.empresa_id
      FROM admin.ordenes_trabajo ot
      JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
      WHERE ot.orden_trabajo_id = $1 AND ot.activo = true
      FOR UPDATE OF ot
    `, [ordenId]);

    if (orderRes.rows.length === 0 || Number(orderRes.rows[0].empresa_id) !== Number(session.empresa_id)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "NOT_FOUND", message: "Orden de trabajo no encontrada." }, { status: 404 });
    }

    const estadoOrdenId = orderRes.rows[0].estado_orden_id;
    if (estadoOrdenId === 8 || estadoOrdenId === 7) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "ORDER_LOCKED", message: "No se puede modificar mano de obra en el estado actual de la orden." }, { status: 409 });
    }

    const updateLaborSql = `
      UPDATE admin.orden_servicio_mano_obra
      SET 
        detalle_mano_obra = $1::text,
        observacion = $2::text,
        minutos_trabajados = $3,
        minutos_facturables = $3,
        costo_hora = $4,
        costo_total = $5,
        fecha_actualizacion = NOW(),
        usuario_actualizacion = $6
      WHERE orden_servicio_mano_obra_id = $7 AND orden_servicio_id = $8
      RETURNING 
        orden_servicio_mano_obra_id AS mano_obra_id,
        orden_servicio_mano_obra_id AS id,
        orden_servicio_id,
        usuario_id AS mecanico_usuario_id,
        minutos_trabajados,
        ROUND(minutos_trabajados / 60.0, 2) AS horas_trabajadas,
        ROUND(minutos_trabajados / 60.0, 2) AS horas_reales,
        costo_hora,
        costo_total AS subtotal,
        COALESCE(detalle_mano_obra, observacion) AS detalle_mano_obra,
        observacion AS descripcion,
        observacion
    `;

    const laborRes = await client.query(updateLaborSql, [
      detailText || null,
      detailText || null,
      mins,
      rate,
      costoTotal,
      sessionUserId,
      manoObraId,
      servId
    ]);

    if (laborRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Registro de mano de obra no encontrado." }, { status: 404 });
    }

    await recalculateWorkOrderTotals(client, ordenId);

    const updatedLabor = laborRes.rows[0];

    await recordUserAudit({
      userId: sessionUserId,
      accion: "ACTUALIZAR_MANO_OBRA",
      valorNuevo: {
        orden_servicio_mano_obra_id: manoObraId,
        orden_servicio_id: servId,
        minutos_trabajados: mins,
        costo_total: costoTotal,
        detalle: detailText
      },
      motivo: "Actualización de mano de obra",
      resultado: "COMPLETADO",
      client,
      throwOnError: true
    });

    await client.query("COMMIT");

    await recordUserActivity({
      userId: sessionUserId,
      modulo: "TALLER_MANO_OBRA",
      evento: "LABOR_SESSION_UPDATED",
      descripcion: `Mano de obra #${manoObraId} actualizada en servicio #${servId}`,
      resultado: "Exitoso",
      req
    });

    return NextResponse.json({
      success: true,
      data: updatedLabor,
      message: "Mano de obra actualizada correctamente."
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("PUT /api/taller/ordenes/[id]/servicios/[servicioId]/mano-obra Error:", err);
    return NextResponse.json({ error: "Error al actualizar mano de obra.", details: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE /api/taller/ordenes/[id]/servicios/[servicioId]/mano-obra
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; servicioId: string }> }
) {
  const { id, servicioId } = await params;

  if (!id || !servicioId || !/^\d+$/.test(id.trim()) || !/^\d+$/.test(servicioId.trim())) {
    return NextResponse.json({ error: "INVALID_ID", message: "IDs no válidos." }, { status: 400 });
  }
  const ordenId = Number(id.trim());
  const servId = Number(servicioId.trim());

  const { searchParams } = new URL(req.url);
  const rawManoObraId = searchParams.get("mano_obra_id") || searchParams.get("orden_servicio_mano_obra_id");
  const manoObraId = parseInt(rawManoObraId || "0", 10);

  if (isNaN(manoObraId) || manoObraId <= 0) {
    return NextResponse.json({ error: "Parámetros no válidos." }, { status: 400 });
  }

  const session = await getWorkshopSession();
  if (!session || !session.usuario_id) {
    return NextResponse.json({ error: "NO_SESSION", message: "Sesión no válida o expirada." }, { status: 401 });
  }
  const sessionUserId = session.usuario_id;

  const perms = await getModulePermissions("TALLER", session.usuario_id);
  if (!perms.puede_editar) {
    return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso para eliminar mano de obra." }, { status: 403 });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock Order Row Exclusively with canonical client company check
    const orderRes = await client.query(`
      SELECT ot.orden_trabajo_id, ot.estado_orden_id, c.empresa_id
      FROM admin.ordenes_trabajo ot
      JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
      WHERE ot.orden_trabajo_id = $1 AND ot.activo = true
      FOR UPDATE OF ot
    `, [ordenId]);

    if (orderRes.rows.length === 0 || Number(orderRes.rows[0].empresa_id) !== Number(session.empresa_id)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "NOT_FOUND", message: "Orden de trabajo no encontrada." }, { status: 404 });
    }

    const estadoOrdenId = orderRes.rows[0].estado_orden_id;
    if (estadoOrdenId === 8 || estadoOrdenId === 7) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "ORDER_LOCKED", message: "No se puede eliminar mano de obra en el estado actual de la orden." }, { status: 409 });
    }

    // Delete Labor Record
    const deleteRes = await client.query(`
      DELETE FROM admin.orden_servicio_mano_obra
      WHERE orden_servicio_mano_obra_id = $1 AND orden_servicio_id = $2
    `, [manoObraId, servicioId]);

    if (deleteRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Registro de mano de obra no encontrado." }, { status: 404 });
    }

    await recalculateWorkOrderTotals(client, ordenId);

    await recordUserAudit({
      userId: sessionUserId,
      accion: "ELIMINAR_MANO_OBRA",
      valorAnterior: { orden_servicio_mano_obra_id: manoObraId, orden_servicio_id: servId },
      valorNuevo: null,
      motivo: "Eliminación de mano de obra",
      resultado: "COMPLETADO",
      client,
      throwOnError: true
    });

    await client.query("COMMIT");

    await recordUserActivity({
      userId: sessionUserId,
      modulo: "TALLER_MANO_OBRA",
      evento: "LABOR_SESSION_DELETED",
      descripcion: `Mano de obra #${manoObraId} eliminada de servicio #${servId}`,
      resultado: "Exitoso",
      req
    });

    return NextResponse.json({
      success: true,
      message: "Registro de mano de obra eliminado exitosamente."
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("DELETE /api/taller/ordenes/[id]/servicios/[servicioId]/mano-obra Error:", err);
    return NextResponse.json({ error: "Error al eliminar mano de obra.", details: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
