import { NextResponse } from "next/server";
import { getPool, query } from "@/lib/db";
import { getWorkshopSession } from "@/lib/workshop-session";
import { recalculateWorkOrderTotals } from "@/lib/workshop/recalculateWorkOrderTotals";
import { validateOrderInRepair } from "@/lib/workshop/validateOrderState";

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
    const cantidad = parseFloat(body.cantidad);
    const observacion = body.observacion ? String(body.observacion).trim() : null;

    if (isNaN(productoId) || productoId <= 0) {
      return NextResponse.json(
        { success: false, error: "BAD_REQUEST", message: "Debes seleccionar un producto válido." },
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

    // Enforce order state machine check
    const orderStateCheck = await validateOrderInRepair(client, ordenId, session.empresa_id, "AGREGAR_PRODUCTO");
    if (!orderStateCheck.isValid) {
      await client.query("ROLLBACK");
      // Mapear el helper response al formato exacto del endpoint si difiere, pero el helper ya retorna NextResponse.json compatible
      return orderStateCheck.response;
    }

    // Resolve catalog price from DB (ignore client sent price)
    const prodRes = await client.query(
      `SELECT producto_id, codigo_producto, nombre, precio_venta, estado FROM admin.productos WHERE producto_id = $1`,
      [productoId]
    );

    if (!prodRes.rows || prodRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "El producto seleccionado no existe o está inactivo." },
        { status: 404 }
      );
    }

    const prod = prodRes.rows[0];
    if (prod.estado === false || prod.estado === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, error: "BAD_REQUEST", message: "El producto seleccionado se encuentra inactivo." },
        { status: 400 }
      );
    }

    const precioUnitario = parseFloat(prod.precio_venta || 0);
    const subtotal = Math.round(cantidad * precioUnitario * 100) / 100;

    // Check stock in existencias_producto
    const stockRes = await client.query(
      `SELECT COALESCE(SUM(cantidad_actual), 0) AS stock_total FROM admin.existencias_producto WHERE producto_id = $1`,
      [productoId]
    );
    const stockTotal = parseFloat(stockRes.rows[0]?.stock_total || "0");
    if (stockTotal < cantidad) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          success: false,
          error: "INSUFFICIENT_STOCK",
          message: `Stock insuficiente. Stock disponible: ${stockTotal}, solicitado: ${cantidad}.`
        },
        { status: 400 }
      );
    }

    // Insert into admin.orden_productos directly linked to order
    const insertRes = await client.query(
      `
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
        utilizado,
        observacion,
        fecha_registro,
        usuario_registro
      ) VALUES (
        (SELECT COALESCE(MAX(orden_producto_id), 0) + 1 FROM admin.orden_productos),
        $1, NULL, $2, 1, $3, $4, 0, 0, $5, 1, false, $6, NOW(), $7
      )
      RETURNING orden_producto_id, producto_id, cantidad, precio_unitario, subtotal
      `,
      [ordenId, productoId, cantidad, precioUnitario, subtotal, observacion, session.usuario_id]
    );

    const newProd = insertRes.rows[0];

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
        orderStateCheck.order.estado_orden_id,
        session.usuario_id,
        `Producto agregado a la orden: ${prod.nombre} (Cant: ${cantidad}, Precio Unit: RD$ ${precioUnitario.toLocaleString("es-DO", { minimumFractionDigits: 2 })})`
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        message: "Producto agregado correctamente a la orden.",
        data: {
          orden_producto_id: newProd.orden_producto_id,
          producto_id: newProd.producto_id,
          codigo: prod.codigo_producto || `PRD-${String(productoId).padStart(3, "0")}`,
          nombre: prod.nombre,
          cantidad: Number(newProd.cantidad),
          precio_unitario: Number(newProd.precio_unitario),
          subtotal: Number(newProd.subtotal)
        }
      },
      { status: 201 }
    );
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /api/taller/ordenes/[id]/productos error:", err);
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: err.message || "Error al agregar el producto." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
