import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { recalculateWorkOrderTotals } from "@/lib/workshop/recalculateWorkOrderTotals";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { validateOrderInRepair } from "@/lib/workshop/validateOrderState";

// POST /api/taller/ordenes/[id]/servicios/[servicioId]/productos
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
    return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso para modificar repuestos." }, { status: 403 });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    const body = await req.json();
    const { producto_id, cantidad, precio_unitario, porcentaje_descuento } = body;

    if (!producto_id) {
      client.release();
      return NextResponse.json({ error: "El producto es un campo obligatorio." }, { status: 400 });
    }

    await client.query("BEGIN");

    // Lock Order Row and enforce order state machine check
    const orderStateCheck = await validateOrderInRepair(client, ordenId, session.empresa_id, "AGREGAR_REPUESTO_SERVICIO");
    if (!orderStateCheck.isValid) {
      await client.query("ROLLBACK");
      return orderStateCheck.response;
    }

    // Verify product in catalog
    const prodCatalogRes = await client.query(`
      SELECT producto_id, nombre, precio_venta
      FROM admin.productos
      WHERE producto_id = $1
    `, [parseInt(producto_id, 10)]);

    if (prodCatalogRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "El repuesto especificado no existe en el catálogo." }, { status: 404 });
    }

    const prodInfo = prodCatalogRes.rows[0];
    const targetAlmacenId = body.almacen_id ? parseInt(body.almacen_id, 10) : 1;
    const qty = Math.max(1, parseInt(cantidad || "1", 10));
    const price = precio_unitario !== undefined ? Math.max(0, parseFloat(precio_unitario)) : parseFloat(prodInfo.precio_venta || 0);
    const descPct = Math.min(100, Math.max(0, parseFloat(porcentaje_descuento || "0")));
    const bruto = qty * price;
    const valorDesc = Math.min(bruto, Math.round((bruto * (descPct / 100.0)) * 100) / 100);
    const subtotal = Math.max(0, bruto - valorDesc);

    // Insert Product Row
    const insertProdSql = `
      INSERT INTO admin.orden_productos (
        orden_producto_id,
        orden_trabajo_id,
        orden_servicio_id,
        producto_id,
        almacen_id,
        cantidad,
        precio_unitario,
        porcentaje_descuento,
        valor_descuento,
        subtotal,
        estado_aprobacion_id,
        fecha_registro,
        usuario_registro
      ) VALUES (
        (SELECT COALESCE(MAX(orden_producto_id), 0) + 1 FROM admin.orden_productos),
        $1, $2, $3, $4, $5, $6, $7, $8, $9, 2, NOW(), $10
      )
      RETURNING orden_producto_id
    `;

    const newProdRes = await client.query(insertProdSql, [
      ordenId,
      servicioId,
      parseInt(producto_id, 10),
      targetAlmacenId,
      qty,
      price,
      descPct,
      valorDesc,
      subtotal,
      sessionUserId
    ]);

    // Recalculate Order Financial Totals
    await recalculateWorkOrderTotals(client, ordenId);

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      data: { orden_producto_id: newProdRes.rows[0].orden_producto_id },
      message: "Repuesto agregado exitosamente."
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /api/taller/ordenes/[id]/servicios/[servicioId]/productos Error:", err);
    return NextResponse.json({ error: "Error al agregar repuesto.", details: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE /api/taller/ordenes/[id]/servicios/[servicioId]/productos (Soft Deactivation)
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
  const ordenProductoId = parseInt(searchParams.get("orden_producto_id") || "0", 10);
  const motivoAnulacion = searchParams.get("motivo") || "Anulación de repuesto";

  if (isNaN(ordenProductoId) || ordenProductoId <= 0) {
    return NextResponse.json({ error: "Parámetros no válidos." }, { status: 400 });
  }

  const session = await getWorkshopSession();
  if (!session || !session.usuario_id) {
    return NextResponse.json({ error: "NO_SESSION", message: "Sesión no válida o expirada." }, { status: 401 });
  }
  const sessionUserId = session.usuario_id;

  const perms = await getModulePermissions("TALLER", session.usuario_id);
  if (!perms.puede_editar) {
    return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso para anular repuestos." }, { status: 403 });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock Order Row Exclusively
    const orderRes = await client.query(`
      SELECT orden_trabajo_id, estado_orden_id
      FROM admin.ordenes_trabajo
      WHERE orden_trabajo_id = $1 AND activo = true
      FOR UPDATE OF ordenes_trabajo
    `, [ordenId]);

    if (orderRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Orden de trabajo no encontrada." }, { status: 404 });
    }

    const estadoOrdenId = orderRes.rows[0].estado_orden_id;
    if (estadoOrdenId === 8 || estadoOrdenId === 7) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "ORDER_LOCKED", message: "No se pueden anular repuestos en el estado actual de la orden." }, { status: 409 });
    }

    // Lock Spare Part Row for Update
    const prodRes = await client.query(`
      SELECT orden_producto_id, producto_id, cantidad, precio_unitario, subtotal
      FROM admin.orden_productos
      WHERE orden_producto_id = $1 AND orden_servicio_id = $2 AND orden_trabajo_id = $3
      FOR UPDATE OF orden_productos
    `, [ordenProductoId, servicioId, ordenId]);

    if (prodRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Repuesto no encontrado en este servicio." }, { status: 404 });
    }

    // Perform soft deactivation / deletion
    await client.query(`
      DELETE FROM admin.orden_productos WHERE orden_producto_id = $1
    `, [ordenProductoId]);

    // Recalculate Order Financial Totals
    await recalculateWorkOrderTotals(client, ordenId);

    // History Record
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
      `Repuesto anulado de servicio #${servicioId}: ${motivoAnulacion}`
    ]);

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Repuesto desasociado exitosamente."
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("DELETE /api/taller/ordenes/[id]/servicios/[servicioId]/productos Error:", err);
    return NextResponse.json({ error: "Error al desasociar repuesto.", details: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// PUT /api/taller/ordenes/[id]/servicios/[servicioId]/productos
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

  const perms = await getModulePermissions("TALLER", session.usuario_id);
  if (!perms.puede_editar) {
    return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso para modificar repuestos." }, { status: 403 });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    const body = await req.json();
    const { orden_producto_id, cantidad, precio_unitario, porcentaje_descuento } = body;

    const opId = parseInt(orden_producto_id, 10);
    if (isNaN(opId) || opId <= 0) {
      client.release();
      return NextResponse.json({ error: "El orden_producto_id es obligatorio." }, { status: 400 });
    }

    await client.query("BEGIN");

    const orderRes = await client.query(`
      SELECT orden_trabajo_id, estado_orden_id
      FROM admin.ordenes_trabajo
      WHERE orden_trabajo_id = $1 AND activo = true
      FOR UPDATE OF ordenes_trabajo
    `, [ordenId]);

    if (orderRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Orden de trabajo no encontrada." }, { status: 404 });
    }

    const qty = Math.max(1, parseInt(cantidad || "1", 10));
    const price = Math.max(0, parseFloat(precio_unitario || "0"));
    const descPct = Math.min(100, Math.max(0, parseFloat(porcentaje_descuento || "0")));
    const bruto = qty * price;
    const valorDesc = Math.min(bruto, Math.round((bruto * (descPct / 100.0)) * 100) / 100);
    const subtotal = Math.max(0, bruto - valorDesc);

    await client.query(`
      UPDATE admin.orden_productos
      SET cantidad = $1,
          precio_unitario = $2,
          porcentaje_descuento = $3,
          valor_descuento = $4,
          subtotal = $5
      WHERE orden_producto_id = $6 AND orden_servicio_id = $7 AND orden_trabajo_id = $8
    `, [qty, price, descPct, valorDesc, subtotal, opId, servId, ordenId]);

    await recalculateWorkOrderTotals(client, ordenId);
    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Repuesto actualizado exitosamente."
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("PUT /api/taller/ordenes/[id]/servicios/[servicioId]/productos Error:", err);
    return NextResponse.json({ error: "Error al actualizar repuesto.", details: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
