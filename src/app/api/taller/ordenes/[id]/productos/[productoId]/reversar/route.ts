import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { recordUserActivity } from "@/lib/auditLogger";
import {
  INVENTORY_SYSTEM_CODES,
  generarCodigoMovimiento
} from "@/lib/inventory/inventoryConstants";
import { calcularNuevoPMP } from "@/lib/inventory/inventoryMovementService";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; productoId: string }> }
) {
  const { id, productoId } = await context.params;
  const ordenId = parseInt(id, 10);
  const ordenProductoId = parseInt(productoId, 10);

  if (isNaN(ordenId) || isNaN(ordenProductoId)) {
    return NextResponse.json(
      { error: "INVALID_ID", message: "Identificador de orden o producto inválido." },
      { status: 400 }
    );
  }

  // 1. Validar sesión
  const session = await getWorkshopSession();
  if (!session || !session.empresa_id) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Sesión inválida o expirada." },
      { status: 401 }
    );
  }

  // 2. Validar permisos de taller
  const perms = await getModulePermissions("TALLER_ORDENES", session.usuario_id);
  if (!perms.puede_editar && !perms.puede_crear && session.rol_principal_id !== 1) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "No tienes permisos para modificar órdenes de trabajo." },
      { status: 403 }
    );
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 3. Bloquear y validar la Orden de Trabajo con multitenancy
    const otRes = await client.query(`
      SELECT 
        ot.orden_trabajo_id,
        ot.codigo_orden,
        ot.estado_orden_id,
        c.empresa_id,
        eot.codigo AS codigo_estado,
        eot.nombre AS nombre_estado
      FROM admin.ordenes_trabajo ot
      JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
      JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
      WHERE ot.orden_trabajo_id = $1
      FOR UPDATE OF ot
    `, [ordenId]);

    if (otRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "NOT_FOUND", message: "La orden de trabajo no existe." },
        { status: 404 }
      );
    }

    const ot = otRes.rows[0];

    // 4. Validar tenant
    if (Number(ot.empresa_id) !== Number(session.empresa_id)) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes acceso a órdenes de otra empresa." },
        { status: 403 }
      );
    }

    // 5. Validar estado operativo de la OT: Solo permitido en estado EN_REPARACION
    const codigoEstado = (ot.codigo_estado || "").toUpperCase();
    const nombreEstado = (ot.nombre_estado || "").toUpperCase();
    const esEnReparacion = codigoEstado === "REPARACION" || nombreEstado === "EN REPARACION";

    if (!esEnReparacion) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "ESTADO_ORDEN_INVALIDO",
          message: `Solo se pueden reversar consumos de repuestos en órdenes en estado 'EN REPARACION'. Estado actual: ${ot.nombre_estado || ot.codigo_estado}.`
        },
        { status: 409 }
      );
    }

    // 6. Bloquear y obtener la línea en admin.orden_productos
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

    // 7. Validar que la línea esté consumida (utilizado === true)
    if (item.utilizado !== true) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "PRODUCTO_NO_CONSUMIDO",
          message: "El repuesto no se encuentra en estado consumido. No es posible reversar."
        },
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

    // 8. Localizar el movimiento SAL_ORDEN origen activo (no reversado)
    const movOrigenRes = await client.query(`
      SELECT
        mi.movimiento_inventario_id,
        mi.empresa_id,
        mi.producto_id,
        mi.almacen_id,
        mi.tipo_movimiento_id,
        mi.cantidad,
        mi.costo_unitario,
        mi.costo_total,
        mi.codigo_movimiento,
        tm.codigo AS tipo_movimiento_codigo,
        tm.naturaleza
      FROM admin.movimientos_inventario mi
      JOIN admin.tipo_movimiento_inventario tm ON mi.tipo_movimiento_id = tm.tipo_movimiento_id
      WHERE mi.orden_producto_id = $1
        AND mi.orden_trabajo_id = $2
        AND mi.empresa_id = $3
        AND mi.producto_id = $4
        AND tm.codigo = 'SAL_ORDEN'
        AND tm.naturaleza = 'SALIDA'
        AND NOT EXISTS (
          SELECT 1
          FROM admin.movimientos_inventario rev
          WHERE rev.movimiento_origen_id = mi.movimiento_inventario_id
        )
      ORDER BY mi.movimiento_inventario_id DESC
      LIMIT 1
      FOR UPDATE OF mi
    `, [ordenProductoId, ordenId, session.empresa_id, item.producto_id]);

    if (movOrigenRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "CONSUMO_NO_ENCONTRADO_O_YA_REVERSADO",
          message: "No se encontró un consumo activo de este repuesto para reversar o ya fue reversado previamente."
        },
        { status: 409 }
      );
    }

    const movOrigen = movOrigenRes.rows[0];
    const almacenId = item.almacen_id || movOrigen.almacen_id;

    if (!almacenId) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "ALMACEN_REQUERIDO", message: "La línea no tiene asignado un almacén válido." },
        { status: 409 }
      );
    }

    // Validar almacén compatible
    if (item.almacen_id && movOrigen.almacen_id && Number(item.almacen_id) !== Number(movOrigen.almacen_id)) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "ALMACEN_CONSUMO_INCOMPATIBLE",
          message: "El almacén de la línea no coincide con el almacén del movimiento de consumo original."
        },
        { status: 409 }
      );
    }

    // Validar cantidad compatible con la línea consumida
    const movCantidad = parseFloat(movOrigen.cantidad || "0");
    if (Math.abs(movCantidad - cantidadLinea) > 0.0001) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "CANTIDAD_CONSUMO_INCOMPATIBLE",
          message: `La cantidad consumida originalmente (${movCantidad}) no coincide con la cantidad de la línea (${cantidadLinea}).`
        },
        { status: 409 }
      );
    }

    // 9. Costos históricos exactos del movimiento SAL_ORDEN
    const costoUnitarioHistorico = parseFloat(movOrigen.costo_unitario || "0");
    const costoTotalHistorico = Number((cantidadLinea * costoUnitarioHistorico).toFixed(2));

    // 10. Bloquear existencia FOR UPDATE y validar invariantes
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
    `, [session.empresa_id, item.producto_id, almacenId]);

    if (exRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "INCONSISTENCIA_STOCK",
          message: "No existe registro de inventario para este producto y almacén en la empresa."
        },
        { status: 409 }
      );
    }

    const ex = exRes.rows[0];
    const stockActual = parseFloat(ex.cantidad_actual || "0");
    const stockReservado = parseFloat(ex.cantidad_reservada || "0");
    const costoPromedioActual = parseFloat(ex.costo_promedio || "0");

    // Validar invariantes pre-reverso
    if (stockActual < 0 || stockReservado < 0 || stockReservado > stockActual) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "INCONSISTENCIA_INVENTARIO_PREVIA",
          message: `Inconsistencia en existencias previas al reverso: Stock actual: ${stockActual}, Reservado: ${stockReservado}.`
        },
        { status: 409 }
      );
    }

    // 11. Calcular balances post-reverso:
    // stockActual += cantidadLinea
    // stockReservado += cantidadLinea
    // disponible (stockActual - stockReservado) permanece constante
    const nuevoStockActual = Number((stockActual + cantidadLinea).toFixed(4));
    const nuevoStockReservado = Number((stockReservado + cantidadLinea).toFixed(4));

    // Validar invariantes post-reverso
    if (nuevoStockActual < 0 || nuevoStockReservado < 0 || nuevoStockReservado > nuevoStockActual) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "INCONSISTENCIA_STOCK_RESULTANTE",
          message: `El stock resultante tras el reverso es inconsistente: Actual: ${nuevoStockActual}, Reservado: ${nuevoStockReservado}.`
        },
        { status: 409 }
      );
    }

    // Validar invariante de disponible intacto antes y después
    const disponibleAntes = Number((stockActual - stockReservado).toFixed(4));
    const disponibleDespues = Number((nuevoStockActual - nuevoStockReservado).toFixed(4));

    if (Math.abs(disponibleAntes - disponibleDespues) > 0.0001) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "INVARIANTE_DISPONIBLE_VIOLADA",
          message: `El stock disponible antes (${disponibleAntes}) difiere del disponible después (${disponibleDespues}).`
        },
        { status: 409 }
      );
    }

    // 12. Calcular nuevo PMP según motor canónico de inventario
    const nuevoPMP = calcularNuevoPMP(
      stockActual,
      costoPromedioActual,
      cantidadLinea,
      costoUnitarioHistorico
    );

    // 13. Generar código de movimiento DRT mediante la secuencia de sistema (ID 13)
    const codigoMovimiento = await generarCodigoMovimiento(
      client,
      session.empresa_id,
      INVENTORY_SYSTEM_CODES.DEVOLUCION_TALLER
    );

    // 14. Actualizar existencias_producto: UNA SOLA AUTORIDAD por transacción
    await client.query(`
      UPDATE admin.existencias_producto
      SET
        cantidad_actual = $1,
        cantidad_reservada = $2,
        costo_promedio = $3,
        fecha_ultimo_movimiento = NOW(),
        fecha_actualizacion = NOW(),
        usuario_actualizacion = $4
      WHERE existencia_producto_id = $5
    `, [nuevoStockActual, nuevoStockReservado, nuevoPMP, session.usuario_id, ex.existencia_producto_id]);

    // 15. Insertar movimiento físico DEV_TALLER en admin.movimientos_inventario
    const observacionMov = `Devolución de repuesto: ${item.producto_nombre} (${item.codigo_producto || `PRD-${item.producto_id}`}) en OT #${ot.codigo_orden || ordenId} [Línea #${ordenProductoId}] [Reverso de ${movOrigen.codigo_movimiento}]`;

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
        movimiento_origen_id,
        referencia,
        observacion,
        codigo_movimiento,
        fecha_movimiento,
        usuario_movimiento,
        fecha_registro,
        usuario_registro
      ) VALUES (
        $1, $2, $3, 11, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), $16, NOW(), $16
      ) RETURNING movimiento_inventario_id, fecha_movimiento
    `, [
      session.empresa_id,
      item.producto_id,
      almacenId,
      cantidadLinea,
      costoUnitarioHistorico,
      costoTotalHistorico,
      stockActual,
      nuevoStockActual,
      ordenId,
      item.orden_servicio_id || null,
      ordenProductoId,
      movOrigen.movimiento_inventario_id,
      ot.codigo_orden || `OT-${ordenId}`,
      observacionMov,
      codigoMovimiento,
      session.usuario_id
    ]);

    const movimientoId = insMovRes.rows[0]?.movimiento_inventario_id;

    // 16. Marcar orden_producto.utilizado = false
    await client.query(`
      UPDATE admin.orden_productos
      SET
        utilizado = false,
        fecha_actualizacion = NOW(),
        usuario_actualizacion = $1
      WHERE orden_producto_id = $2
    `, [session.usuario_id, ordenProductoId]);

    await client.query("COMMIT");

    // 17. Registro de actividad / auditoría
    await recordUserActivity({
      userId: session.usuario_id,
      modulo: "TALLER_ORDENES",
      evento: "WORK_ORDER_PRODUCT_CONSUMPTION_REVERSED",
      descripcion: `Consumo de repuesto #${item.producto_id} (${item.producto_nombre}, ${cantidadLinea} u.) reversado en OT #${ot.codigo_orden || ordenId}. Movimiento reverso: ${codigoMovimiento}, Origen: ${movOrigen.codigo_movimiento}`,
      resultado: "Exitoso",
      req
    });

    return NextResponse.json({
      success: true,
      message: "Consumo de repuesto revertido correctamente. El stock físico y la reserva fueron restaurados.",
      data: {
        orden_producto_id: ordenProductoId,
        utilizado: false,
        cantidad_reversada: cantidadLinea,
        stock_actual: nuevoStockActual,
        stock_reservado: nuevoStockReservado,
        disponible: nuevoStockActual - nuevoStockReservado,
        codigo_movimiento: codigoMovimiento,
        movimiento_inventario_id: movimientoId,
        movimiento_origen_id: movOrigen.movimiento_inventario_id,
        movimiento_origen_codigo: movOrigen.codigo_movimiento,
        costo_unitario: costoUnitarioHistorico,
        nuevo_pmp: nuevoPMP
      }
    }, { status: 200 });

  } catch (error: unknown) {
    await client.query("ROLLBACK").catch(() => {});

    const dbError = error as { code?: string; constraint?: string };
    // Manejar carrera concurrente mediante violación de índice UNIQUE parcial
    if (dbError?.code === "23505" && dbError?.constraint === "idx_movimientos_movimiento_origen_unique") {
      return NextResponse.json(
        {
          error: "CONSUMO_YA_REVERSADO",
          message: "Este consumo ya fue reversado por otra solicitud simultánea."
        },
        { status: 409 }
      );
    }

    console.error("POST /api/taller/ordenes/[id]/productos/[productoId]/reversar error:", error);
    const msg = error instanceof Error ? error.message : "Ocurrió un error inesperado al reversar el consumo del repuesto.";
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
