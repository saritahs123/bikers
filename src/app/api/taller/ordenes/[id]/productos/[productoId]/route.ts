import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getWorkshopSession } from "@/lib/workshop-session";
import { recalculateWorkOrderTotals } from "@/lib/workshop/recalculateWorkOrderTotals";
import { validateOrderInRepair } from "@/lib/workshop/validateOrderState";
import { recordUserActivity, recordUserAudit } from "@/lib/auditLogger";


export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; productoId: string }> }
) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await getWorkshopSession();
    if (!session || !session.usuario_id) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    const { id, productoId } = await params;
    const ordenId = parseInt(id, 10);
    const ordenProductoId = parseInt(productoId, 10);

    if (isNaN(ordenId) || isNaN(ordenProductoId)) {
      return NextResponse.json(
        { success: false, error: "BAD_REQUEST", message: "IDs no válidos." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const cantidad = parseFloat(body.cantidad);
    const observacion = body.observacion ? String(body.observacion).trim() : null;

    if (isNaN(cantidad) || cantidad <= 0) {
      return NextResponse.json(
        { success: false, error: "BAD_REQUEST", message: "La cantidad debe ser mayor a 0." },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    // 1. Enforce order state machine check
    const orderStateCheck = await validateOrderInRepair(client, ordenId, session.empresa_id, "EDITAR_PRODUCTO");
    if (!orderStateCheck.isValid) {
      await client.query("ROLLBACK");
      return orderStateCheck.response;
    }

    // 2. Lock orden_productos record FIRST (FOR UPDATE)
    const opRes = await client.query(
      `
      SELECT op.orden_producto_id, op.orden_trabajo_id, op.producto_id, op.almacen_id, op.utilizado,
             op.precio_unitario, op.cantidad, p.nombre, p.precio_venta, ot.estado_orden_id,
             COALESCE(um.permite_decimales, false) AS permite_decimales,
             um.codigo AS unidad_medida
      FROM admin.orden_productos op
      JOIN admin.productos p ON op.producto_id = p.producto_id
      LEFT JOIN admin.unidad_medida um ON p.unidad_medida_id = um.unidad_medida_id
      JOIN admin.ordenes_trabajo ot ON op.orden_trabajo_id = ot.orden_trabajo_id
      WHERE op.orden_producto_id = $1 AND op.orden_trabajo_id = $2
      FOR UPDATE OF op
      `,
      [ordenProductoId, ordenId]
    );

    if (!opRes.rows || opRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "El producto no existe en esta orden." },
        { status: 404 }
      );
    }

    const item = opRes.rows[0];

    // 3. Prohibit changing product_id or almacen_id
    if (body.producto_id !== undefined && parseInt(String(body.producto_id), 10) !== item.producto_id) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          success: false,
          error: "CAMBIO_PRODUCTO_NO_PERMITIDO",
          message: "No está permitido cambiar el producto de una reserva existente. Si desea cambiar de producto, elimine la línea y agregue una nueva."
        },
        { status: 400 }
      );
    }

    if (body.almacen_id !== undefined && parseInt(String(body.almacen_id), 10) !== item.almacen_id) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          success: false,
          error: "CAMBIO_ALMACEN_NO_PERMITIDO",
          message: "No está permitido cambiar el almacén de una reserva existente. Si desea cambiar de almacén, elimine la línea y agregue una nueva."
        },
        { status: 400 }
      );
    }

    // 4. Validate consumed lines: strictly immutable
    if (item.utilizado === true) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          success: false,
          error: "PRODUCTO_YA_CONSUMIDO",
          message: "No se puede modificar un repuesto que ya ha sido marcado como consumido en la orden."
        },
        { status: 409 }
      );
    }

    // 5. Validate decimal allowance
    if (!item.permite_decimales && !Number.isInteger(cantidad)) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          success: false,
          error: "BAD_REQUEST",
          message: `La unidad de medida (${item.unidad_medida || "UND"}) no permite cantidades fraccionarias o decimales.`
        },
        { status: 400 }
      );
    }

    // 6. Calculate delta against LOCKED row quantity
    const prevCantidad = parseFloat(item.cantidad || "0");
    const delta = cantidad - prevCantidad;

    // 7. Adjust reservation if delta != 0 and item is not consumed
    if (delta !== 0) {
      const exRes = await client.query(
        `SELECT existencia_producto_id, cantidad_actual, cantidad_reservada,
                (cantidad_actual - cantidad_reservada) AS disponible
         FROM admin.existencias_producto
         WHERE empresa_id = $1 AND producto_id = $2 AND almacen_id = $3
         FOR UPDATE`,
        [session.empresa_id, item.producto_id, item.almacen_id]
      );

      if (!exRes.rows || exRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            success: false,
            error: delta > 0 ? "STOCK_INSUFICIENTE" : "INCONSISTENCIA_STOCK_RESERVADO",
            message: "No existe registro de existencias en el almacén para este producto.",
            stockActual: 0,
            cantidadReservada: 0,
            cantidadDisponible: 0,
            cantidadSolicitada: delta
          },
          { status: 409 }
        );
      }

      const ex = exRes.rows[0];
      const stockActual = parseFloat(ex.cantidad_actual || "0");
      const cantidadReservada = parseFloat(ex.cantidad_reservada || "0");
      const cantidadDisponible = stockActual - cantidadReservada;

      // Inconsistency check: cantidad_reservada > stockActual or negative
      if (cantidadReservada < 0 || cantidadReservada > stockActual) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            success: false,
            error: "INCONSISTENCIA_STOCK_RESERVADO",
            message: "Inconsistencia de inventario detectada: la cantidad reservada en almacén es inconsistente con el stock físico actual.",
            stockActual,
            cantidadReservada
          },
          { status: 409 }
        );
      }

      if (delta > 0) {
        // Increasing reservation: check availability
        if (delta > cantidadDisponible) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            {
              success: false,
              error: "STOCK_INSUFICIENTE",
              message: "No hay existencia disponible suficiente para aumentar la reserva de este producto.",
              stockActual,
              cantidadReservada,
              cantidadDisponible,
              cantidadSolicitada: delta
            },
            { status: 409 }
          );
        }

        // Increment reservation
        await client.query(
          `UPDATE admin.existencias_producto
           SET cantidad_reservada = cantidad_reservada + $1,
               fecha_actualizacion = CURRENT_TIMESTAMP,
               usuario_actualizacion = $2
           WHERE existencia_producto_id = $3`,
          [delta, session.usuario_id, ex.existencia_producto_id]
        );
      } else {
        // Reducing reservation: check that reserved stock is at least the amount to liberate
        const cantidadALiberar = Math.abs(delta);
        if (cantidadReservada < cantidadALiberar) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            {
              success: false,
              error: "INCONSISTENCIA_STOCK_RESERVADO",
              message: "Inconsistencia de inventario detectada: la cantidad a liberar supera la cantidad reservada registrada.",
              stockActual,
              cantidadReservada,
              cantidadALiberar
            },
            { status: 409 }
          );
        }

        // Decrement reservation without GREATEST
        await client.query(
          `UPDATE admin.existencias_producto
           SET cantidad_reservada = cantidad_reservada - $1,
               fecha_actualizacion = CURRENT_TIMESTAMP,
               usuario_actualizacion = $2
           WHERE existencia_producto_id = $3`,
          [cantidadALiberar, session.usuario_id, ex.existencia_producto_id]
        );
      }
    }

    // 8. Re-resolve catalog price or use catalog price
    const precioUnitario = parseFloat(item.precio_venta || item.precio_unitario || 0);
    const subtotal = Math.round(cantidad * precioUnitario * 100) / 100;

    await client.query(
      `
      UPDATE admin.orden_productos
      SET 
        cantidad = $1,
        precio_unitario = $2,
        subtotal = $3,
        observacion = $4,
        fecha_actualizacion = NOW(),
        usuario_actualizacion = $5
      WHERE orden_producto_id = $6
      `,
      [cantidad, precioUnitario, subtotal, observacion, session.usuario_id, ordenProductoId]
    );

    // 9. Recalculate order totals inside transaction
    await recalculateWorkOrderTotals(client, ordenId);

    // 10. Register history event using PostgreSQL sequence
    await client.query(
      `
      INSERT INTO admin.orden_historial_estado (
        orden_trabajo_id, estado_anterior_id, estado_nuevo_id,
        usuario_cambio, comentario, fecha_cambio, activo, fecha_registro
      ) VALUES (
        $1, $2, $2, $3, $4, NOW(), true, NOW()
      ) RETURNING orden_historial_estado_id
      `,
      [
        ordenId,
        item.estado_orden_id,
        session.usuario_id,
        `Producto editado en la orden: ${item.nombre} (Nueva Cantidad: ${cantidad})`
      ]
    );

    await recordUserAudit({
      userId: session.usuario_id,
      accion: "ACTUALIZAR_PRODUCTO_ORDEN",
      valorNuevo: {
        orden_producto_id: ordenProductoId,
        orden_trabajo_id: ordenId,
        cantidad,
        precio_unitario: precioUnitario,
        subtotal
      },
      motivo: "Actualización de producto en orden",
      resultado: "COMPLETADO",
      client,
      throwOnError: true
    });

    await client.query("COMMIT");

    await recordUserActivity({
      userId: session.usuario_id,
      modulo: "TALLER_PRODUCTOS",
      evento: "ORDER_PRODUCT_UPDATED",
      descripcion: `Producto #${item.producto_id} actualizado en orden #${ordenId}`,
      resultado: "Exitoso",
      req
    });

    return NextResponse.json({
      success: true,
      message: "Producto actualizado correctamente.",
      data: {
        orden_producto_id: ordenProductoId,
        cantidad,
        precio_unitario: precioUnitario,
        subtotal
      }
    });

  } catch (err: unknown) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("PUT /api/taller/ordenes/[id]/productos/[productoId] error:", err);
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: "Error al actualizar el producto de la orden." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; productoId: string }> }
) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await getWorkshopSession();
    if (!session || !session.usuario_id) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    const { id, productoId } = await params;
    const ordenId = parseInt(id, 10);
    const ordenProductoId = parseInt(productoId, 10);

    if (isNaN(ordenId) || isNaN(ordenProductoId)) {
      return NextResponse.json(
        { success: false, error: "BAD_REQUEST", message: "IDs no válidos." },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    // 1. Enforce order state machine check
    const orderStateCheck = await validateOrderInRepair(client, ordenId, session.empresa_id, "ELIMINAR_PRODUCTO");
    if (!orderStateCheck.isValid) {
      await client.query("ROLLBACK");
      return orderStateCheck.response;
    }

    // 2. Lock and verify orden_productos record
    const opRes = await client.query(
      `
      SELECT op.orden_producto_id, op.orden_trabajo_id, op.producto_id, op.almacen_id, op.cantidad, op.utilizado, p.nombre, ot.estado_orden_id
      FROM admin.orden_productos op
      JOIN admin.productos p ON op.producto_id = p.producto_id
      JOIN admin.ordenes_trabajo ot ON op.orden_trabajo_id = ot.orden_trabajo_id
      WHERE op.orden_producto_id = $1 AND op.orden_trabajo_id = $2
      FOR UPDATE OF op
      `,
      [ordenProductoId, ordenId]
    );

    if (!opRes.rows || opRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "El producto no existe en esta orden." },
        { status: 404 }
      );
    }

    const item = opRes.rows[0];

    // 3. Reject deletion if product is already consumed
    if (item.utilizado === true) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          success: false,
          error: "PRODUCTO_YA_CONSUMIDO",
          message: "No se puede eliminar un repuesto que ya ha sido marcado como consumido en la orden."
        },
        { status: 409 }
      );
    }

    // 4. Release reservation if product was not physically consumed
    if (item.utilizado === false && item.almacen_id) {
      const cantidadALiberar = parseFloat(item.cantidad || "0");
      if (cantidadALiberar > 0) {
        const exRes = await client.query(
          `SELECT existencia_producto_id, cantidad_actual, cantidad_reservada,
                  (cantidad_actual - cantidad_reservada) AS disponible
           FROM admin.existencias_producto
           WHERE empresa_id = $1 AND producto_id = $2 AND almacen_id = $3
           FOR UPDATE`,
          [session.empresa_id, item.producto_id, item.almacen_id]
        );

        if (!exRes.rows || exRes.rows.length === 0) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            {
              success: false,
              error: "INCONSISTENCIA_STOCK_RESERVADO",
              message: "Inconsistencia de inventario: no existe registro de existencia para liberar la reserva del producto."
            },
            { status: 409 }
          );
        }

        const ex = exRes.rows[0];
        const stockActual = parseFloat(ex.cantidad_actual || "0");
        const cantidadReservada = parseFloat(ex.cantidad_reservada || "0");

        if (cantidadReservada < cantidadALiberar || cantidadReservada > stockActual) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            {
              success: false,
              error: "INCONSISTENCIA_STOCK_RESERVADO",
              message: "Inconsistencia de inventario: la cantidad a liberar supera la cantidad reservada o la reserva es inválida frente al stock actual.",
              stockActual,
              cantidadReservada,
              cantidadALiberar
            },
            { status: 409 }
          );
        }

        // Decrement reservation without GREATEST
        await client.query(
          `UPDATE admin.existencias_producto
           SET cantidad_reservada = cantidad_reservada - $1,
               fecha_actualizacion = CURRENT_TIMESTAMP,
               usuario_actualizacion = $2
           WHERE existencia_producto_id = $3`,
          [cantidadALiberar, session.usuario_id, ex.existencia_producto_id]
        );
      }
    }

    // 5. Delete record from admin.orden_productos
    await client.query(
      `DELETE FROM admin.orden_productos WHERE orden_producto_id = $1`,
      [ordenProductoId]
    );

    // 6. Recalculate order totals
    await recalculateWorkOrderTotals(client, ordenId);

    // 7. Register history event using PostgreSQL sequence
    await client.query(
      `
      INSERT INTO admin.orden_historial_estado (
        orden_trabajo_id, estado_anterior_id, estado_nuevo_id,
        usuario_cambio, comentario, fecha_cambio, activo, fecha_registro
      ) VALUES (
        $1, $2, $2, $3, $4, NOW(), true, NOW()
      ) RETURNING orden_historial_estado_id
      `,
      [
        ordenId,
        item.estado_orden_id,
        session.usuario_id,
        `Producto eliminado de la orden: ${item.nombre}`
      ]
    );

    await recordUserAudit({
      userId: session.usuario_id,
      accion: "ELIMINAR_PRODUCTO_ORDEN",
      valorAnterior: { orden_producto_id: ordenProductoId, orden_trabajo_id: ordenId },
      valorNuevo: null,
      motivo: "Eliminación de producto de orden",
      resultado: "COMPLETADO",
      client,
      throwOnError: true
    });

    await client.query("COMMIT");

    await recordUserActivity({
      userId: session.usuario_id,
      modulo: "TALLER_PRODUCTOS",
      evento: "ORDER_PRODUCT_DELETED",
      descripcion: `Producto #${ordenProductoId} (${item.nombre}) eliminado de la orden #${ordenId}`,
      resultado: "Exitoso",
      req
    });

    return NextResponse.json({
      success: true,
      message: "Producto eliminado correctamente de la orden."
    });

  } catch (err: unknown) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("DELETE /api/taller/ordenes/[id]/productos/[productoId] error:", err);
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: "Error al eliminar el producto de la orden." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export { POST } from "./consumir/route";
