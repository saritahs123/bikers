import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getWorkshopSession } from "@/lib/workshop-session";
import { recalculateWorkOrderTotals } from "@/lib/workshop/recalculateWorkOrderTotals";
import { validateOrderInRepair } from "@/lib/workshop/validateOrderState";
import { recordUserActivity, recordUserAudit } from "@/lib/auditLogger";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const ordenId = parseInt(id, 10);
    if (isNaN(ordenId)) {
      return NextResponse.json(
        { success: false, error: "BAD_REQUEST", message: "ID de orden no válido." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const productoId = parseInt(body.producto_id, 10);
    const almacenId = parseInt(body.almacen_id, 10);
    const cantidad = parseFloat(body.cantidad);
    const observacion = body.observacion ? String(body.observacion).trim() : null;

    if (isNaN(productoId) || productoId <= 0) {
      return NextResponse.json(
        { success: false, error: "BAD_REQUEST", message: "Debes seleccionar un producto válido." },
        { status: 400 }
      );
    }

    if (isNaN(almacenId) || almacenId <= 0) {
      return NextResponse.json(
        { success: false, error: "BAD_REQUEST", message: "Debes seleccionar un almacén válido." },
        { status: 400 }
      );
    }

    if (isNaN(cantidad) || cantidad <= 0) {
      return NextResponse.json(
        { success: false, error: "BAD_REQUEST", message: "La cantidad debe ser mayor a 0." },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    // 1. Enforce order state machine check & tenant validation
    const orderStateCheck = await validateOrderInRepair(client, ordenId, session.empresa_id, "AGREGAR_PRODUCTO");
    if (!orderStateCheck.isValid) {
      await client.query("ROLLBACK");
      return orderStateCheck.response;
    }

    // 2. Validate warehouse: exists, belongs to session.empresa_id, and is ACTIVO
    const almRes = await client.query(
      `SELECT almacen_id, codigo, nombre, estado, empresa_id
       FROM admin.almacenes
       WHERE almacen_id = $1 AND empresa_id = $2`,
      [almacenId, session.empresa_id]
    );

    if (!almRes.rows || almRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "El almacén seleccionado no existe o no pertenece a su empresa." },
        { status: 404 }
      );
    }

    const alm = almRes.rows[0];
    if (String(alm.estado || "").toUpperCase() !== "ACTIVO") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, error: "ALMACEN_INACTIVO", message: "El almacén seleccionado se encuentra inactivo." },
        { status: 400 }
      );
    }

    // 3. Validate product: exists, usable by tenant, active, and check unit decimal policy
    const prodRes = await client.query(
      `SELECT p.producto_id, p.codigo_producto, p.nombre, p.precio_venta, p.estado, p.empresa_id,
              COALESCE(um.permite_decimales, false) AS permite_decimales,
              um.codigo AS unidad_medida
       FROM admin.productos p
       LEFT JOIN admin.unidad_medida um ON p.unidad_medida_id = um.unidad_medida_id
       WHERE p.producto_id = $1`,
      [productoId]
    );

    if (!prodRes.rows || prodRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "El producto seleccionado no existe." },
        { status: 404 }
      );
    }

    const prod = prodRes.rows[0];
    if (prod.empresa_id != null && Number(prod.empresa_id) !== Number(session.empresa_id)) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "El producto seleccionado no pertenece a su empresa." },
        { status: 404 }
      );
    }

    const isProdActive = String(prod.estado || "").toUpperCase() === "ACTIVO" || prod.estado === true || prod.estado === 1;
    if (!isProdActive) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, error: "BAD_REQUEST", message: "El producto seleccionado se encuentra inactivo." },
        { status: 400 }
      );
    }

    // Validate decimal allowance
    if (!prod.permite_decimales && !Number.isInteger(cantidad)) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          success: false,
          error: "BAD_REQUEST",
          message: `La unidad de medida (${prod.unidad_medida || "UND"}) no permite cantidades fraccionarias o decimales.`
        },
        { status: 400 }
      );
    }

    // 4. Lock existence row in existencias_producto with SELECT FOR UPDATE
    const exRes = await client.query(
      `SELECT existencia_producto_id, empresa_id, producto_id, almacen_id,
              cantidad_actual, cantidad_reservada,
              (cantidad_actual - cantidad_reservada) AS disponible, estado
       FROM admin.existencias_producto
       WHERE empresa_id = $1 AND producto_id = $2 AND almacen_id = $3
       FOR UPDATE`,
      [session.empresa_id, productoId, almacenId]
    );

    if (!exRes.rows || exRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          success: false,
          error: "STOCK_INSUFICIENTE",
          message: "No hay existencia disponible suficiente para reservar este producto.",
          stockActual: 0,
          cantidadReservada: 0,
          cantidadDisponible: 0,
          cantidadSolicitada: cantidad
        },
        { status: 409 }
      );
    }

    const ex = exRes.rows[0];
    const stockActual = parseFloat(ex.cantidad_actual || "0");
    const cantidadReservada = parseFloat(ex.cantidad_reservada || "0");
    const cantidadDisponible = stockActual - cantidadReservada;

    if (cantidad > cantidadDisponible) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          success: false,
          error: "STOCK_INSUFICIENTE",
          message: "No hay existencia disponible suficiente para reservar este producto.",
          stockActual,
          cantidadReservada,
          cantidadDisponible,
          cantidadSolicitada: cantidad
        },
        { status: 409 }
      );
    }

    const precioUnitario = parseFloat(prod.precio_venta || 0);
    const subtotal = Math.round(cantidad * precioUnitario * 100) / 100;

    // 5. Insert into admin.orden_productos directly linked to order with validated almacen_id
    const insertRes = await client.query(
      `
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
        observacion,
        fecha_registro,
        usuario_registro
      ) VALUES (
        $1, NULL, $2, $3, $4, $5, 0, 0, $6, 1, false, $7, NOW(), $8
      )
      RETURNING orden_producto_id, producto_id, almacen_id, cantidad, precio_unitario, subtotal
      `,
      [ordenId, productoId, almacenId, cantidad, precioUnitario, subtotal, observacion, session.usuario_id]
    );

    const newProd = insertRes.rows[0];

    // 6. Atomically increment cantidad_reservada in admin.existencias_producto (cantidad_actual is NEVER touched!)
    await client.query(
      `
      UPDATE admin.existencias_producto
      SET cantidad_reservada = cantidad_reservada + $1,
          fecha_actualizacion = CURRENT_TIMESTAMP,
          usuario_actualizacion = $2
      WHERE existencia_producto_id = $3
      `,
      [cantidad, session.usuario_id, ex.existencia_producto_id]
    );

    // 7. Recalculate order totals inside transaction
    await recalculateWorkOrderTotals(client, ordenId);

    // 8. Record history & audit inside transaction
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
        orderStateCheck.order.estado_orden_id,
        session.usuario_id,
        `Repuesto reservado y agregado a la orden: ${prod.nombre} (Cant: ${cantidad}, Almacén: ${alm.nombre}, Precio Unit: RD$ ${precioUnitario.toLocaleString("es-DO", { minimumFractionDigits: 2 })})`
      ]
    );

    await recordUserAudit({
      userId: session.usuario_id,
      accion: "AGREGAR_PRODUCTO_ORDEN",
      valorNuevo: {
        orden_producto_id: newProd.orden_producto_id,
        orden_trabajo_id: ordenId,
        producto_id: productoId,
        almacen_id: almacenId,
        cantidad,
        precio_unitario: precioUnitario,
        subtotal,
        cantidad_reservada_incremento: cantidad
      },
      motivo: `Repuesto reservado en orden #${ordenId}`,
      resultado: "COMPLETADO",
      client,
      throwOnError: true
    });

    await client.query("COMMIT");

    await recordUserActivity({
      userId: session.usuario_id,
      modulo: "TALLER_PRODUCTOS",
      evento: "ORDER_PRODUCT_ADDED",
      descripcion: `Producto #${productoId} (${prod.nombre}) reservado (${cantidad} und) en almacén #${almacenId} y agregado a orden #${ordenId}`,
      resultado: "Exitoso",
      req
    });

    const cantidadDisponiblePosterior = cantidadDisponible - cantidad;

    return NextResponse.json(
      {
        success: true,
        message: "Producto agregado y reservado correctamente en la orden de trabajo.",
        data: {
          ordenProductoId: newProd.orden_producto_id,
          productoId: newProd.producto_id,
          almacenId: newProd.almacen_id,
          cantidad: Number(newProd.cantidad),
          stockActual: stockActual,
          cantidadReservada: cantidadReservada + cantidad,
          cantidadDisponible: cantidadDisponible,
          cantidadDisponiblePosterior: cantidadDisponiblePosterior,
          codigo: prod.codigo_producto || `PRD-${String(productoId).padStart(3, "0")}`,
          nombre: prod.nombre,
          precio_unitario: Number(newProd.precio_unitario),
          subtotal: Number(newProd.subtotal)
        }
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /api/taller/ordenes/[id]/productos error:", err);
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: "Error al agregar el producto a la orden." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
