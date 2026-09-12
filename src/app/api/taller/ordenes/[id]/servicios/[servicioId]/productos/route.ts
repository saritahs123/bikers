import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { recalculateWorkOrderTotals } from "@/lib/workshop/recalculateWorkOrderTotals";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { validateOrderInRepair } from "@/lib/workshop/validateOrderState";
import { recordUserActivity, recordUserAudit } from "@/lib/auditLogger";
import { resolveDefaultWarehouse } from "@/lib/workshop/workshopInventoryReservationService";

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

    // Verify service belongs to this order
    const servCheckRes = await client.query(`
      SELECT orden_servicio_id FROM admin.orden_servicios WHERE orden_servicio_id = $1 AND orden_trabajo_id = $2 AND (activo IS DISTINCT FROM false)
    `, [servId, ordenId]);

    if (servCheckRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "NOT_FOUND", message: "Servicio no encontrado en esta orden de trabajo." }, { status: 404 });
    }

    // Verify product in catalog
    // Verify product in catalog with decimal check
    const pId = parseInt(producto_id, 10);
    const prodCatalogRes = await client.query(`
      SELECT p.producto_id, p.nombre, p.precio_venta, p.estado, p.empresa_id,
             COALESCE(um.permite_decimales, false) AS permite_decimales,
             um.codigo AS unidad_medida
      FROM admin.productos p
      LEFT JOIN admin.unidad_medida um ON p.unidad_medida_id = um.unidad_medida_id
      WHERE p.producto_id = $1
    `, [pId]);

    if (prodCatalogRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ success: false, error: "PRODUCT_NOT_FOUND", message: "El repuesto especificado no existe en el catálogo." }, { status: 404 });
    }

    const prodInfo = prodCatalogRes.rows[0];
    if (prodInfo.empresa_id != null && Number(prodInfo.empresa_id) !== Number(session.empresa_id)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ success: false, error: "PRODUCT_NOT_FOUND", message: "El producto no pertenece a su empresa." }, { status: 404 });
    }

    // Resolve warehouse strictly
    let targetAlmacenId: number;
    if (body.almacen_id !== undefined && body.almacen_id !== null && String(body.almacen_id).trim() !== "") {
      const explicitAlmId = parseInt(String(body.almacen_id), 10);
      const valAlmRes = await client.query(
        `SELECT almacen_id, estado FROM admin.almacenes WHERE almacen_id = $1 AND empresa_id = $2`,
        [explicitAlmId, session.empresa_id]
      );
      if (!valAlmRes.rows.length) {
        await client.query("ROLLBACK");
        return NextResponse.json({ success: false, error: "ALMACEN_NOT_FOUND", message: "El almacén no existe o no pertenece a su empresa." }, { status: 404 });
      }
      if (String(valAlmRes.rows[0].estado || "").toUpperCase() !== "ACTIVO") {
        await client.query("ROLLBACK");
        return NextResponse.json({ success: false, error: "ALMACEN_INACTIVO", message: "El almacén se encuentra inactivo." }, { status: 400 });
      }
      targetAlmacenId = explicitAlmId;
    } else {
      try {
        const defAlm = await resolveDefaultWarehouse(client, session.empresa_id, prodInfo.nombre || pId);
        targetAlmacenId = defAlm.almacen_id;
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string; status?: number };
        await client.query("ROLLBACK");
        return NextResponse.json({ success: false, error: err.code || "ALMACEN_ERROR", message: err.message || "Error al resolver almacén" }, { status: err.status || 400 });
      }
    }

    const qty = parseFloat(String(cantidad || "1"));
    if (isNaN(qty) || qty <= 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ success: false, error: "INVALID_QUANTITY", message: "La cantidad debe ser mayor a 0." }, { status: 400 });
    }
    if (!prodInfo.permite_decimales && !Number.isInteger(qty)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ success: false, error: "DECIMALS_NOT_ALLOWED", message: "La unidad de medida no permite decimales." }, { status: 400 });
    }

    // Lock existence FOR UPDATE
    const exRes = await client.query(`
      SELECT existencia_producto_id, cantidad_actual, cantidad_reservada
      FROM admin.existencias_producto
      WHERE empresa_id = $1 AND producto_id = $2 AND almacen_id = $3
      FOR UPDATE
    `, [session.empresa_id, pId, targetAlmacenId]);

    if (exRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({
        success: false,
        error: "STOCK_INSUFICIENTE",
        message: `No existe registro de inventario para "${prodInfo.nombre}" en el almacén seleccionado.`,
        stockActual: 0,
        cantidadReservada: 0,
        cantidadDisponible: 0,
        cantidadSolicitada: qty
      }, { status: 409 });
    }

    const ex = exRes.rows[0];
    const stockActual = parseFloat(ex.cantidad_actual || "0");
    const cantRes = parseFloat(ex.cantidad_reservada || "0");
    const disponible = Math.round((stockActual - cantRes) * 100) / 100;

    if (qty > disponible) {
      await client.query("ROLLBACK");
      return NextResponse.json({
        success: false,
        error: "STOCK_INSUFICIENTE",
        message: `Stock insuficiente para "${prodInfo.nombre}". Disponible: ${disponible}, Solicitado: ${qty}.`,
        stockActual,
        cantidadReservada: cantRes,
        cantidadDisponible: disponible,
        cantidadSolicitada: qty
      }, { status: 409 });
    }

    // Update reservation
    const newRes = Math.round((cantRes + qty) * 100) / 100;
    await client.query(`
      UPDATE admin.existencias_producto
      SET cantidad_reservada = $1, fecha_actualizacion = NOW()
      WHERE existencia_producto_id = $2
    `, [newRes, ex.existencia_producto_id]);

    const price = precio_unitario !== undefined ? Math.max(0, parseFloat(precio_unitario)) : parseFloat(prodInfo.precio_venta || 0);
    const descPct = Math.min(100, Math.max(0, parseFloat(porcentaje_descuento || "0")));
    const bruto = qty * price;
    const valorDesc = Math.min(bruto, Math.round((bruto * (descPct / 100.0)) * 100) / 100);
    const subtotal = Math.max(0, bruto - valorDesc);

    // Insert Product Row using PostgreSQL sequence
    const insertProdSql = `
      INSERT INTO admin.orden_productos (
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
        utilizado,
        fecha_registro,
        usuario_registro
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, 2, false, NOW(), $10
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

    const newOpId = newProdRes.rows[0].orden_producto_id;

    await recordUserAudit({
      userId: sessionUserId,
      accion: "AGREGAR_PRODUCTO_SERVICIO",
      valorNuevo: {
        orden_producto_id: newOpId,
        producto_id: parseInt(producto_id, 10),
        orden_servicio_id: servId,
        orden_trabajo_id: ordenId,
        cantidad: qty,
        precio_unitario: price,
        subtotal
      },
      motivo: "Repuesto asignado a servicio",
      resultado: "COMPLETADO",
      client,
      throwOnError: true
    });

    await client.query("COMMIT");

    await recordUserActivity({
      userId: sessionUserId,
      modulo: "TALLER_PRODUCTOS",
      evento: "ORDER_PRODUCT_ADDED",
      descripcion: `Repuesto #${producto_id} agregado a servicio #${servId} (Orden #${ordenId})`,
      resultado: "Exitoso",
      req
    });

    return NextResponse.json({
      success: true,
      data: { orden_producto_id: newOpId },
      message: "Repuesto agregado exitosamente."
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /api/taller/ordenes/[id]/servicios/[servicioId]/productos Error:", err);
    return NextResponse.json({ success: false, error: "SERVER_ERROR", message: "Error al agregar repuesto." }, { status: 500 });
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
      return NextResponse.json({ error: "ORDER_LOCKED", message: "No se pueden anular repuestos en el estado actual de la orden." }, { status: 409 });
    }

    // Lock Spare Part Row for Update
    const prodRes = await client.query(`
      SELECT orden_producto_id, producto_id, almacen_id, cantidad, precio_unitario, subtotal, utilizado
      FROM admin.orden_productos
      WHERE orden_producto_id = $1 AND orden_servicio_id = $2 AND orden_trabajo_id = $3
      FOR UPDATE OF orden_productos
    `, [ordenProductoId, servicioId, ordenId]);

    if (prodRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Repuesto no encontrado en este servicio." }, { status: 404 });
    }

    const prodToDel = prodRes.rows[0];
    if (prodToDel.utilizado) {
      await client.query("ROLLBACK");
      return NextResponse.json({
        success: false,
        error: "PRODUCTO_YA_CONSUMIDO",
        message: "No se puede anular un repuesto que ya ha sido consumido en taller. Revierta el consumo primero."
      }, { status: 400 });
    }

    // Release reservation from existencias
    if (prodToDel.almacen_id) {
      const exRes = await client.query(`
        SELECT existencia_producto_id, cantidad_reservada
        FROM admin.existencias_producto
        WHERE empresa_id = $1 AND producto_id = $2 AND almacen_id = $3
        FOR UPDATE
      `, [session.empresa_id, prodToDel.producto_id, prodToDel.almacen_id]);

      if (exRes.rows.length > 0) {
        const curRes = parseFloat(exRes.rows[0].cantidad_reservada || "0");
        const qty = parseFloat(prodToDel.cantidad || "0");
        const newRes = Math.max(0, Math.round((curRes - qty) * 100) / 100);
        await client.query(`
          UPDATE admin.existencias_producto
          SET cantidad_reservada = $1, fecha_actualizacion = NOW()
          WHERE existencia_producto_id = $2
        `, [newRes, exRes.rows[0].existencia_producto_id]);
      }
    }

    // Perform soft deactivation / deletion
    await client.query(`
      DELETE FROM admin.orden_productos WHERE orden_producto_id = $1
    `, [ordenProductoId]);

    await recalculateWorkOrderTotals(client, ordenId);

    // History Record using PostgreSQL sequence
    await client.query(`
      INSERT INTO admin.orden_historial_estado (
        orden_trabajo_id, estado_anterior_id, estado_nuevo_id, usuario_cambio, comentario, fecha_cambio, activo, fecha_registro
      ) VALUES (
        $1, $2, $2, $3, $4, NOW(), true, NOW()
      ) RETURNING orden_historial_estado_id
    `, [
      ordenId,
      estadoOrdenId,
      sessionUserId,
      `Repuesto anulado de servicio #${servicioId}: ${motivoAnulacion}`
    ]);

    await recordUserAudit({
      userId: sessionUserId,
      accion: "ELIMINAR_PRODUCTO_SERVICIO",
      valorAnterior: {
        orden_producto_id: ordenProductoId,
        orden_servicio_id: servId,
        orden_trabajo_id: ordenId
      },
      valorNuevo: null,
      motivo: motivoAnulacion,
      resultado: "COMPLETADO",
      client,
      throwOnError: true
    });

    await client.query("COMMIT");

    await recordUserActivity({
      userId: sessionUserId,
      modulo: "TALLER_PRODUCTOS",
      evento: "ORDER_PRODUCT_DELETED",
      descripcion: `Repuesto #${ordenProductoId} eliminado de servicio #${servId} (Orden #${ordenId})`,
      resultado: "Exitoso",
      req
    });

    return NextResponse.json({
      success: true,
      message: "Repuesto desasociado exitosamente."
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("DELETE /api/taller/ordenes/[id]/servicios/[servicioId]/productos Error:", err);
    return NextResponse.json({ success: false, error: "SERVER_ERROR", message: "Error al desasociar repuesto." }, { status: 500 });
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
  const sessionUserId = session.usuario_id;

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

    // Lock Spare Part Row for Update
    const prodRes = await client.query(`
      SELECT orden_producto_id, producto_id, almacen_id, cantidad, precio_unitario, utilizado
      FROM admin.orden_productos
      WHERE orden_producto_id = $1 AND orden_servicio_id = $2 AND orden_trabajo_id = $3
      FOR UPDATE OF orden_productos
    `, [opId, servId, ordenId]);

    if (prodRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Repuesto no encontrado en este servicio." }, { status: 404 });
    }

    const currentLine = prodRes.rows[0];
    const oldQty = parseFloat(currentLine.cantidad || "0");
    const qty = parseFloat(String(cantidad || "1"));

    if (currentLine.utilizado) {
      if (Math.abs(qty - oldQty) > 0.0001) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          success: false,
          error: "PRODUCTO_YA_CONSUMIDO",
          message: "No se puede modificar la cantidad de un repuesto que ya ha sido consumido en taller."
        }, { status: 400 });
      }
    } else {
      const delta = Math.round((qty - oldQty) * 100) / 100;
      if (delta !== 0 && currentLine.almacen_id) {
        const exRes = await client.query(`
          SELECT existencia_producto_id, cantidad_actual, cantidad_reservada
          FROM admin.existencias_producto
          WHERE empresa_id = $1 AND producto_id = $2 AND almacen_id = $3
          FOR UPDATE
        `, [session.empresa_id, currentLine.producto_id, currentLine.almacen_id]);

        if (exRes.rows.length === 0) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            success: false,
            error: "STOCK_INSUFICIENTE",
            message: "No existe existencia registrada para este producto."
          }, { status: 409 });
        }

        const curStock = parseFloat(exRes.rows[0].cantidad_actual || "0");
        const curRes = parseFloat(exRes.rows[0].cantidad_reservada || "0");
        const curDisp = Math.round((curStock - curRes) * 100) / 100;

        if (delta > 0 && delta > curDisp) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            success: false,
            error: "STOCK_INSUFICIENTE",
            message: `Stock insuficiente para aumentar la cantidad. Disponible: ${curDisp}, Adicional requerido: ${delta}.`
          }, { status: 409 });
        }

        const newRes = Math.round((curRes + delta) * 100) / 100;
        await client.query(`
          UPDATE admin.existencias_producto
          SET cantidad_reservada = $1, fecha_actualizacion = NOW()
          WHERE existencia_producto_id = $2
        `, [newRes, exRes.rows[0].existencia_producto_id]);
      }
    }

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

    await recordUserAudit({
      userId: sessionUserId,
      accion: "ACTUALIZAR_PRODUCTO_SERVICIO",
      valorNuevo: {
        orden_producto_id: opId,
        orden_servicio_id: servId,
        orden_trabajo_id: ordenId,
        cantidad: qty,
        precio_unitario: price,
        subtotal
      },
      motivo: "Actualización de repuesto en servicio",
      resultado: "COMPLETADO",
      client,
      throwOnError: true
    });

    await client.query("COMMIT");

    await recordUserActivity({
      userId: sessionUserId,
      modulo: "TALLER_PRODUCTOS",
      evento: "ORDER_PRODUCT_UPDATED",
      descripcion: `Repuesto #${opId} actualizado en servicio #${servId} (Orden #${ordenId})`,
      resultado: "Exitoso",
      req
    });

    return NextResponse.json({
      success: true,
      message: "Repuesto actualizado exitosamente."
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("PUT /api/taller/ordenes/[id]/servicios/[servicioId]/productos Error:", err);
    return NextResponse.json({ success: false, error: "SERVER_ERROR", message: "Error al actualizar repuesto." }, { status: 500 });
  } finally {
    client.release();
  }
}
