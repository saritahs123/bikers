import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// POST /api/taller/ordenes/[id]/servicios/[servicioId]/productos
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; servicioId: string }> }
) {
  try {
    const { id, servicioId } = await params;
    const ordenId = parseInt(id, 10);
    const sId = parseInt(servicioId, 10);

    if (isNaN(sId)) {
      return NextResponse.json({ error: "ID de servicio inválido." }, { status: 400 });
    }

    // Check if service is completed
    const svcRes = await query(
      `SELECT orden_trabajo_id, estado_orden_servicio_id FROM admin.orden_servicios WHERE orden_servicio_id = $1`,
      [sId]
    );

    if (svcRes.length === 0) {
      return NextResponse.json({ error: "Servicio no encontrado." }, { status: 404 });
    }

    if (svcRes[0].estado_orden_servicio_id === 3) {
      return NextResponse.json({ error: "No se puede asociar productos a un servicio completado." }, { status: 400 });
    }

    const otId = !isNaN(ordenId) ? ordenId : (svcRes[0].orden_trabajo_id || 1);

    const body = await req.json();
    const { producto_id, cantidad, precio_unitario } = body;

    if (!producto_id) {
      return NextResponse.json({ error: "El producto es obligatorio." }, { status: 400 });
    }

    const pId = parseInt(producto_id, 10);
    const qty = cantidad ? parseFloat(cantidad) : 1;

    // Get unit price if not specified
    let finalPrecio = precio_unitario;
    if (finalPrecio === undefined || finalPrecio === null || finalPrecio === "") {
      const pRes = await query(`SELECT precio_venta FROM admin.productos WHERE producto_id = $1`, [pId]);
      if (pRes.length > 0) {
        finalPrecio = pRes[0].precio_venta;
      } else {
        finalPrecio = 0;
      }
    }
    const unitPrice = parseFloat(finalPrecio || 0);
    const subtotal = qty * unitPrice;

    const sql = `
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
        fecha_registro
      ) VALUES (
        (SELECT COALESCE(MAX(orden_producto_id), 0) + 1 FROM admin.orden_productos),
        $1,
        $2,
        $3,
        1,
        $4,
        $5,
        0,
        0,
        $6,
        1,
        false,
        'Asociación de producto a servicio',
        NOW()
      )
      RETURNING orden_producto_id
    `;

    const res = await query(sql, [
      otId,
      sId,
      pId,
      qty,
      unitPrice,
      subtotal
    ]);

    return NextResponse.json({
      success: true,
      data: res[0],
      message: "Producto asociado al servicio exitosamente."
    });
  } catch (err: any) {
    console.error("POST productos Error:", err);
    return NextResponse.json({ error: err.message || "Error al asociar producto al servicio." }, { status: 500 });
  }
}

// DELETE /api/taller/ordenes/[id]/servicios/[servicioId]/productos
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; servicioId: string }> }
) {
  try {
    const { servicioId } = await params;
    const sId = parseInt(servicioId, 10);

    if (isNaN(sId)) {
      return NextResponse.json({ error: "ID de servicio inválido." }, { status: 400 });
    }

    // Check if service is completed
    const svcRes = await query(
      `SELECT estado_orden_servicio_id FROM admin.orden_servicios WHERE orden_servicio_id = $1`,
      [sId]
    );

    if (svcRes[0]?.estado_orden_servicio_id === 3) {
      return NextResponse.json({ error: "No se puede eliminar productos de un servicio completado." }, { status: 400 });
    }

    const url = new URL(req.url);
    const pIdParam = url.searchParams.get("orden_producto_id") || url.searchParams.get("id");

    if (!pIdParam) {
      return NextResponse.json({ error: "ID de producto de la orden es requerido." }, { status: 400 });
    }

    const opId = parseInt(pIdParam, 10);

    await query(
      `DELETE FROM admin.orden_productos WHERE orden_producto_id = $1 AND orden_servicio_id = $2`,
      [opId, sId]
    );

    return NextResponse.json({
      success: true,
      message: "Producto desasociado del servicio exitosamente."
    });
  } catch (err: any) {
    console.error("DELETE productos Error:", err);
    return NextResponse.json({ error: err.message || "Error al eliminar producto del servicio." }, { status: 500 });
  }
}
