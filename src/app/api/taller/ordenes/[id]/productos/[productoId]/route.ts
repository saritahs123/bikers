import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getWorkshopSession } from "@/lib/workshop-session";
import { recalculateWorkOrderTotals } from "@/lib/workshop/recalculateWorkOrderTotals";

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

    // Lock orden_productos record
    const opRes = await client.query(
      `
      SELECT op.orden_producto_id, op.orden_trabajo_id, op.producto_id, op.precio_unitario, op.cantidad, p.nombre, p.precio_venta, ot.estado_orden_id
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
    // Re-resolve catalog price or use catalog price
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

    // Recalculate order totals inside transaction
    await recalculateWorkOrderTotals(client, ordenId);

    // Register history event
    await client.query(
      `
      INSERT INTO admin.orden_historial_estado (
        orden_historial_estado_id, orden_trabajo_id, estado_anterior_id, estado_nuevo_id,
        usuario_cambio, comentario, fecha_cambio, activo, fecha_registro
      ) VALUES (
        (SELECT COALESCE(MAX(orden_historial_estado_id), 0) + 1 FROM admin.orden_historial_estado),
        $1, $2, $2, $3, $4, NOW(), true, NOW()
      )
      `,
      [
        ordenId,
        item.estado_orden_id,
        session.usuario_id,
        `Producto editado en la orden: ${item.nombre} (Nueva Cantidad: ${cantidad})`
      ]
    );

    await client.query("COMMIT");

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

  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("PUT /api/taller/ordenes/[id]/productos/[productoId] error:", err);
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: err.message || "Error al actualizar el producto." },
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

    // Lock and verify
    const opRes = await client.query(
      `
      SELECT op.orden_producto_id, op.orden_trabajo_id, p.nombre, ot.estado_orden_id
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

    // Delete record from admin.orden_productos
    await client.query(
      `DELETE FROM admin.orden_productos WHERE orden_producto_id = $1`,
      [ordenProductoId]
    );

    // Recalculate order totals
    await recalculateWorkOrderTotals(client, ordenId);

    // Register history event
    await client.query(
      `
      INSERT INTO admin.orden_historial_estado (
        orden_historial_estado_id, orden_trabajo_id, estado_anterior_id, estado_nuevo_id,
        usuario_cambio, comentario, fecha_cambio, activo, fecha_registro
      ) VALUES (
        (SELECT COALESCE(MAX(orden_historial_estado_id), 0) + 1 FROM admin.orden_historial_estado),
        $1, $2, $2, $3, $4, NOW(), true, NOW()
      )
      `,
      [
        ordenId,
        item.estado_orden_id,
        session.usuario_id,
        `Producto eliminado de la orden: ${item.nombre}`
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Producto eliminado correctamente de la orden."
    });

  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("DELETE /api/taller/ordenes/[id]/productos/[productoId] error:", err);
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: err.message || "Error al eliminar el producto." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
