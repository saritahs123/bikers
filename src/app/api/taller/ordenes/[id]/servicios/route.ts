import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { recalculateWorkOrderTotals } from "@/lib/workshop/recalculateWorkOrderTotals";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

// POST /api/taller/ordenes/[id]/servicios
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Validaciones previas a la reserva de conexión del pool
  if (!id || typeof id !== "string" || !/^\d+$/.test(id.trim())) {
    return NextResponse.json({ error: "INVALID_ID", message: "Identificador de orden inválido." }, { status: 400 });
  }
  const ordenId = Number(id.trim());
  if (!Number.isSafeInteger(ordenId) || ordenId <= 0) {
    return NextResponse.json({ error: "INVALID_ID", message: "Identificador de orden inválido." }, { status: 400 });
  }

  const session = await getWorkshopSession();
  if (!session || !session.usuario_id) {
    return NextResponse.json({ error: "NO_SESSION", message: "Sesión no válida o expirada." }, { status: 401 });
  }
  const sessionUserId = session.usuario_id;

  const perms = await getModulePermissions("TALLER", session.usuario_id);
  if (!perms.puede_editar) {
    return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso para modificar servicios en las órdenes de trabajo." }, { status: 403 });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    const body = await req.json();
    const tipo_servicio_id = body.tipo_servicio_id;
    const mecanico_usuario_id = body.mecanico_usuario_id ?? body.usuario_id;
    const rawPrecio = body.precio_acordado ?? body.precio_unitario;
    const cantidad = body.cantidad;
    const porcentaje_descuento = body.porcentaje_descuento;
    const observaciones = body.observaciones ?? body.observacion_tecnica;
    const confirmar = body.confirmar ?? body.confirmar_servicio_adicional;
    const motivo = body.motivo ?? body.motivo_servicio_adicional;

    if (!tipo_servicio_id) {
      return NextResponse.json({ error: "El tipo de servicio es un campo obligatorio." }, { status: 400 });
    }

    await client.query("BEGIN");

    // Bloquear orden de trabajo FOR UPDATE
    const otCheck = await client.query(`
      SELECT estado_orden_id
      FROM admin.ordenes_trabajo
      WHERE orden_trabajo_id = $1 AND activo = true
      FOR UPDATE OF ordenes_trabajo
    `, [ordenId]);

    if (otCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Orden de trabajo no encontrada." }, { status: 404 });
    }

    const estadoOrdenId = otCheck.rows[0].estado_orden_id;

    if (estadoOrdenId === 8) {
      await client.query("ROLLBACK");
      return NextResponse.json({
        error: "READ_ONLY_ORDER",
        message: "La orden se encuentra en estado ENTREGADA. Está en modo de solo lectura permanente."
      }, { status: 409 });
    }

    // Regla de advertencia si la orden ya está en Reparación (5) o Lista para Entrega (7)
    if ((estadoOrdenId === 5 || estadoOrdenId === 7) && !confirmar) {
      await client.query("ROLLBACK");
      return NextResponse.json({
        warning: true,
        code: "REQUIRES_CONFIRMATION",
        message: "La orden de trabajo ya está en proceso. ¿Desea agregar este servicio adicional?",
        confirmRequired: true
      }, { status: 200 });
    }

    // Resolver estado_aprobacion_id dinámicamente desde el catálogo
    const appRes = await client.query(`
      SELECT estado_aprobacion_id
      FROM admin.estado_aprobacion
      WHERE UPPER(codigo) = 'APROBADO' AND (activo IS DISTINCT FROM false)
      LIMIT 1
    `);

    if (appRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({
        error: "APPROVAL_STATUS_NOT_CONFIGURED",
        message: "No fue posible agregar el servicio porque falta la configuración de aprobación."
      }, { status: 500 });
    }

    const estadoAprobacionId = appRes.rows[0].estado_aprobacion_id;

    // Generar secuencia de forma segura dentro de la transacción
    const seqRes = await client.query(`
      SELECT COALESCE(MAX(secuencia), 0) + 1 AS next_seq
      FROM admin.orden_servicios
      WHERE orden_trabajo_id = $1
    `, [ordenId]);
    const nextSecuencia = seqRes.rows[0].next_seq;

    // Obtener precio por defecto si no se especificó
    let finalPrecio = (rawPrecio !== undefined && rawPrecio !== null && rawPrecio !== "" && !isNaN(parseFloat(rawPrecio)))
      ? parseFloat(rawPrecio)
      : 0;

    if (rawPrecio === undefined || rawPrecio === null || rawPrecio === "") {
      const tsRes = await client.query(`
        SELECT precio_base FROM admin.tipo_servicio WHERE tipo_servicio_id = $1
      `, [tipo_servicio_id]);
      if (tsRes.rows.length > 0 && tsRes.rows[0].precio_base) {
        finalPrecio = parseFloat(tsRes.rows[0].precio_base);
      }
    }

    const finalCantidad = cantidad ? parseFloat(cantidad) : 1;
    const finalDescPct = porcentaje_descuento ? parseFloat(porcentaje_descuento) : 0;
    const grossTotal = finalCantidad * finalPrecio;
    const valDesc = (grossTotal * finalDescPct) / 100;
    const finalSubtotal = grossTotal - valDesc;

    // Asignar mecánico especificado o sessionUserId
    let mecUsuarioId = mecanico_usuario_id ? parseInt(mecanico_usuario_id, 10) : sessionUserId;

    // Insertar Servicio
    const nextServIdRes = await client.query(`
      SELECT COALESCE(MAX(orden_servicio_id), 0) + 1 AS next_id FROM admin.orden_servicios
    `);
    const newServId = nextServIdRes.rows[0].next_id;

    await client.query(`
      INSERT INTO admin.orden_servicios (
        orden_servicio_id,
        orden_trabajo_id,
        tipo_servicio_id,
        estado_orden_servicio_id,
        estado_aprobacion_id,
        secuencia,
        usuario_id,
        cantidad,
        precio_unitario,
        porcentaje_descuento,
        valor_descuento,
        subtotal,
        observacion_tecnica,
        activo,
        fecha_registro,
        usuario_registro
      ) VALUES (
        $1, $2, $3, 1, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, NOW(), $13
      )
    `, [
      newServId,
      ordenId,
      tipo_servicio_id,
      estadoAprobacionId,
      nextSecuencia,
      mecUsuarioId,
      finalCantidad,
      finalPrecio,
      finalDescPct,
      valDesc,
      finalSubtotal,
      motivo || observaciones || null,
      sessionUserId
    ]);

    // Registrar Historial
    await client.query(`
      INSERT INTO admin.orden_historial_estado (
        orden_historial_estado_id, orden_trabajo_id, estado_anterior_id, estado_nuevo_id, usuario_cambio, comentario, fecha_cambio, activo, fecha_registro
      ) VALUES (
        (SELECT COALESCE(MAX(orden_historial_estado_id), 0) + 1 FROM admin.orden_historial_estado),
        $1, $2, $2, $3, $4, NOW(), true, NOW()
      )
    `, [
      ordenId,
      estadoOrdenId,
      sessionUserId,
      `Servicio adicional agregado (ID #${newServId})${motivo ? `: ${motivo}` : ''}`
    ]);

    // Recalcular totales financieros en la transacción
    await recalculateWorkOrderTotals(client, ordenId);
    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      data: { servicio_id: newServId },
      message: "Servicio agregado exitosamente."
    }, { status: 201 });

  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /api/taller/ordenes/[id]/servicios Error:", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      constraint: err?.constraint,
      stack: err?.stack
    });

    return NextResponse.json({
      success: false,
      error: "SERVICE_ADD_FAILED",
      message: err.message || "Error al agregar servicio.",
      ...(process.env.NODE_ENV === "development" ? {
        debug: {
          phase: "POST_SERVICE_INSERT",
          pgCode: err?.code,
          pgMessage: err?.message,
          detail: err?.detail,
          constraint: err?.constraint
        }
      } : {})
    }, { status: 500 });
  } finally {
    client.release();
  }
}
