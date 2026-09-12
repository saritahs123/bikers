import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { generarCodigoMovimiento, INVENTORY_SYSTEM_CODES } from "@/lib/inventory/inventoryConstants";
import { recordUserAudit, recordUserActivity } from "@/lib/auditLogger";

/**
 * POST /api/taller/ordenes/[id]/productos/[productoId]/consumir
 *
 * INV-TALLER-3: Consumo Físico Real de Repuestos en Orden de Trabajo
 * Transacción atómica:
 * 1. Lock OT FOR UPDATE (valida tenant y estado operativo REPARACION)
 * 2. Lock orden_producto FOR UPDATE (valida utilizado = false)
 * 3. Lock existencia FOR UPDATE
 * 4. Valida consistencias estrictas de reserva y stock físico
 * 5. Genera codigo_movimiento mediante secuencia oficial (CRT)
 * 6. Descuenta cantidad_actual y cantidad_reservada simultáneamente
 * 7. Inserta registro físico en admin.movimientos_inventario (SAL_ORDEN, ID 2)
 * 8. Marca orden_producto.utilizado = true
 * 9. Auditoría y COMMIT
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; productoId: string }> }
) {
  const { id, productoId } = await params;

  if (!id || !/^\d+$/.test(id.trim())) {
    return NextResponse.json(
      { error: "INVALID_ORDER_ID", message: "Identificador de orden inválido." },
      { status: 400 }
    );
  }
  if (!productoId || !/^\d+$/.test(productoId.trim())) {
    return NextResponse.json(
      { error: "INVALID_PRODUCT_LINE_ID", message: "Identificador de repuesto inválido." },
      { status: 400 }
    );
  }

  const ordenId = parseInt(id.trim(), 10);
  const ordenProductoId = parseInt(productoId.trim(), 10);

  // 1. Validar sesión
  const session = await getWorkshopSession();
  if (!session || !session.usuario_id || !session.empresa_id) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Sesión inválida o expirada." },
      { status: 401 }
    );
  }

  const perms = await getModulePermissions("TALLER", session.usuario_id);
  if (!perms.puede_editar) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "No tienes permisos para consumir repuestos en la orden." },
      { status: 403 }
    );
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 2 & 3. Lock OT y validar Tenant
    const otRes = await client.query(`
      SELECT
        ot.orden_trabajo_id,
        ot.codigo_orden,
        ot.estado_orden_id,
        eot.codigo AS estado_codigo,
        c.empresa_id
      FROM admin.ordenes_trabajo ot
      JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
      JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
      WHERE ot.orden_trabajo_id = $1 AND ot.activo = true
      FOR UPDATE OF ot
    `, [ordenId]);

    if (otRes.rows.length === 0 || Number(otRes.rows[0].empresa_id) !== Number(session.empresa_id)) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "NOT_FOUND", message: "La orden de trabajo no existe o no pertenece a su empresa." },
        { status: 404 }
      );
    }

    const ot = otRes.rows[0];

    // 4. Validar estado operativo de la OT: Solo permitido en REPARACION
    if (String(ot.estado_codigo).toUpperCase() !== "REPARACION") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "ESTADO_ORDEN_INVALIDO",
          message: `Solo se pueden consumir repuestos en órdenes en estado 'EN REPARACION'. Estado actual: ${ot.estado_codigo}.`
        },
        { status: 409 }
      );
    }

    // 5. Bloquear orden_producto FOR UPDATE
    const opRes = await client.query(`
      SELECT
        op.orden_producto_id,
        op.orden_trabajo_id,
        op.orden_servicio_id,
        op.producto_id,
        op.almacen_id,
        op.cantidad,
        op.precio_unitario,
        op.subtotal,
        op.utilizado,
        p.nombre AS producto_nombre,
        p.codigo_producto
      FROM admin.orden_productos op
      JOIN admin.productos p ON op.producto_id = p.producto_id
      WHERE op.orden_producto_id = $1 AND op.orden_trabajo_id = $2
      FOR UPDATE OF op
    `, [ordenProductoId, ordenId]);

    if (opRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "NOT_FOUND", message: "La línea de repuesto no existe en esta orden." },
        { status: 404 }
      );
    }

    const item = opRes.rows[0];

    // 6. Validar que no esté ya consumido
    if (item.utilizado === true) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "PRODUCTO_YA_CONSUMIDO", message: "El repuesto ya fue consumido previamente." },
        { status: 409 }
      );
    }

    const cantidadLinea = parseFloat(item.cantidad || "0");
    if (isNaN(cantidadLinea) || cantidadLinea <= 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "CANTIDAD_INVALIDA", message: "La cantidad del repuesto es inválida o menor o igual a cero." },
        { status: 400 }
      );
    }

    if (!item.almacen_id) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "ALMACEN_REQUERIDO", message: "La línea de repuesto no tiene asignado un almacén de procedencia." },
        { status: 409 }
      );
    }

    // 7. Bloquear existencia FOR UPDATE
    const exRes = await client.query(`
      SELECT
        existencia_producto_id,
        cantidad_actual,
        cantidad_reservada,
        costo_promedio,
        (cantidad_actual - cantidad_reservada) AS disponible
      FROM admin.existencias_producto
      WHERE empresa_id = $1 AND producto_id = $2 AND almacen_id = $3
      FOR UPDATE
    `, [session.empresa_id, item.producto_id, item.almacen_id]);

    if (exRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "INCONSISTENCIA_STOCK_RESERVADO",
          message: "No existe registro de inventario para este producto y almacén en la empresa."
        },
        { status: 409 }
      );
    }

    const ex = exRes.rows[0];
    const stockActual = parseFloat(ex.cantidad_actual || "0");
    const stockReservado = parseFloat(ex.cantidad_reservada || "0");
    const costoPromedio = parseFloat(ex.costo_promedio || "0");

    // 8. Validaciones estrictas de consistencia (sin GREATEST, sin parches silenciosos)
    if (stockReservado < cantidadLinea || stockReservado > stockActual || stockReservado < 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "INCONSISTENCIA_STOCK_RESERVADO",
          message: `Inconsistencia en stock reservado: Se intentan consumir ${cantidadLinea} unidades pero la reserva registrada es ${stockReservado} (Stock actual: ${stockActual}).`
        },
        { status: 409 }
      );
    }

    if (stockActual < cantidadLinea) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "INCONSISTENCIA_STOCK",
          message: `Inconsistencia de stock físico: La existencia cuenta con ${stockActual} unidades físicas, insuficiente para consumir ${cantidadLinea}.`
        },
        { status: 409 }
      );
    }

    // 9. Generar código de movimiento mediante la secuencia oficial de sistema (CRT)
    const codigoMovimiento = await generarCodigoMovimiento(
      client,
      session.empresa_id,
      INVENTORY_SYSTEM_CODES.CONSUMO_TALLER
    );

    // 10 & 11. Reducir simultáneamente cantidad_actual y cantidad_reservada
    const nuevoStockActual = Number((stockActual - cantidadLinea).toFixed(4));
    const nuevoStockReservado = Number((stockReservado - cantidadLinea).toFixed(4));

    await client.query(`
      UPDATE admin.existencias_producto
      SET
        cantidad_actual = $1,
        cantidad_reservada = $2,
        fecha_ultimo_movimiento = NOW(),
        fecha_actualizacion = NOW(),
        usuario_actualizacion = $3
      WHERE existencia_producto_id = $4
    `, [nuevoStockActual, nuevoStockReservado, session.usuario_id, ex.existencia_producto_id]);

    // 12. Insertar movimiento físico en admin.movimientos_inventario
    // tipo_movimiento_id = 2 ('SAL_ORDEN')
    const costoUnitarioMov = costoPromedio > 0 ? costoPromedio : 0;
    const costoTotalMov = Number((cantidadLinea * costoUnitarioMov).toFixed(2));
    const observacionMov = `Consumo de repuesto: ${item.producto_nombre} (${item.codigo_producto || `PRD-${item.producto_id}`}) en OT #${ot.codigo_orden || ordenId} [Línea #${ordenProductoId}]`;

    const insMovRes = await client.query(`
      INSERT INTO admin.movimientos_inventario (
        empresa_id,
        producto_id,
        almacen_id,
        tipo_movimiento_id,
        cantidad,
        costo_unitario,
        costo_total,
        stock_anterior,
        stock_nuevo,
        orden_trabajo_id,
        orden_servicio_id,
        orden_producto_id,
        referencia,
        observacion,
        codigo_movimiento,
        fecha_movimiento,
        usuario_movimiento,
        fecha_registro,
        usuario_registro
      ) VALUES (
        $1, $2, $3, 2, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), $15, NOW(), $15
      ) RETURNING movimiento_inventario_id, fecha_movimiento
    `, [
      session.empresa_id,
      item.producto_id,
      item.almacen_id,
      cantidadLinea,
      costoUnitarioMov,
      costoTotalMov,
      stockActual,
      nuevoStockActual,
      ordenId,
      item.orden_servicio_id || null,
      item.orden_producto_id,
      ot.codigo_orden || `OT-${ordenId}`,
      observacionMov,
      codigoMovimiento,
      session.usuario_id
    ]);

    const movimientoId = insMovRes.rows[0]?.movimiento_inventario_id;

    // 13. Marcar orden_producto.utilizado = true
    await client.query(`
      UPDATE admin.orden_productos
      SET
        utilizado = true,
        fecha_actualizacion = NOW(),
        usuario_actualizacion = $1
      WHERE orden_producto_id = $2
    `, [session.usuario_id, ordenProductoId]);

    // 14. Auditoría y actividad
    await recordUserAudit({
      userId: session.usuario_id,
      accion: "CONSUMIR_REPUESTO_ORDEN",
      valorAnterior: {
        orden_producto_id: ordenProductoId,
        utilizado: false,
        cantidad: cantidadLinea,
        stock_actual_anterior: stockActual,
        stock_reservado_anterior: stockReservado
      },
      valorNuevo: {
        orden_producto_id: ordenProductoId,
        utilizado: true,
        cantidad: cantidadLinea,
        stock_actual_nuevo: nuevoStockActual,
        stock_reservado_nuevo: nuevoStockReservado,
        codigo_movimiento: codigoMovimiento,
        movimiento_inventario_id: movimientoId
      },
      motivo: `Consumo físico de repuesto en OT #${ot.codigo_orden || ordenId}`,
      resultado: "COMPLETADO",
      client,
      throwOnError: true
    });

    await client.query("COMMIT");

    await recordUserActivity({
      userId: session.usuario_id,
      modulo: "TALLER_ORDENES",
      evento: "WORK_ORDER_PRODUCT_CONSUMED",
      descripcion: `Repuesto #${item.producto_id} (${item.producto_nombre}, ${cantidadLinea} u.) consumido físicamente en OT #${ot.codigo_orden || ordenId}. Movimiento: ${codigoMovimiento}`,
      resultado: "Exitoso",
      req
    });

    return NextResponse.json({
      success: true,
      message: "Repuesto consumido y descontado físicamente del inventario.",
      data: {
        orden_producto_id: ordenProductoId,
        utilizado: true,
        cantidad_consumida: cantidadLinea,
        stock_actual: nuevoStockActual,
        stock_reservado: nuevoStockReservado,
        disponible: nuevoStockActual - nuevoStockReservado,
        codigo_movimiento: codigoMovimiento,
        movimiento_inventario_id: movimientoId
      }
    }, { status: 200 });

  } catch (error: unknown) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /api/taller/ordenes/[id]/productos/[productoId]/consumir error:", error);
    const msg = error instanceof Error ? error.message : "Ocurrió un error inesperado al consumir el repuesto.";
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: msg
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
