import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import {
  getProductosByProveedor,
  upsertProductoProveedor,
  ProductSupplierError,
} from "@/lib/inventory/productSupplierService";

// GET /api/inventario/proveedores/[id]/productos
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("INVENTARIO", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para consultar productos del proveedor." }, { status: 403 });
    }

    const { id } = await context.params;
    const proveedorId = parseInt(id, 10);
    if (isNaN(proveedorId)) {
      return NextResponse.json({ error: "INVALID_ID", message: "ID de proveedor inválido." }, { status: 400 });
    }

    const empresaId = session.empresa_id;

    // 1. Fetch current associated products
    const productosAsociados = await getProductosByProveedor(empresaId, proveedorId);

    // 2. Fetch active catalog products available to associate for this tenant
    const productosDisponibles = await query(
      `SELECT
         p.producto_id,
         p.codigo_producto,
         p.nombre,
         mp.nombre AS marca_nombre,
         um.codigo AS unidad_medida_codigo,
         COALESCE(p.costo_actual, 0)::numeric AS costo_actual,
         COALESCE(p.precio_venta, 0)::numeric AS precio_venta
       FROM admin.productos p
       LEFT JOIN admin.marca_producto mp ON p.marca_producto_id = mp.marca_producto_id
       LEFT JOIN admin.unidad_medida um ON p.unidad_medida_id = um.unidad_medida_id
       WHERE p.empresa_id = $1 AND (p.estado = 'ACTIVO' OR p.estado IS NULL)
       ORDER BY p.nombre ASC`,
      [empresaId]
    );

    return NextResponse.json({
      success: true,
      productos: productosAsociados,
      catalogo_productos: productosDisponibles.map((p: any) => ({
        ...p,
        costo_actual: Number(p.costo_actual || 0),
        precio_venta: Number(p.precio_venta || 0)
      }))
    });
  } catch (error: any) {
    console.error("Error in GET /api/inventario/proveedores/[id]/productos:", error);
    if (error instanceof ProductSupplierError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al consultar productos del proveedor." }, { status: 500 });
  }
}

// POST /api/inventario/proveedores/[id]/productos -> Asignar producto a proveedor
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("INVENTARIO", session.usuario_id);
    if (!perms.puede_crear && !perms.puede_editar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para asociar productos a proveedores." }, { status: 403 });
    }

    const { id } = await context.params;
    const proveedorId = parseInt(id, 10);
    if (isNaN(proveedorId)) {
      return NextResponse.json({ error: "INVALID_ID", message: "ID de proveedor inválido." }, { status: 400 });
    }

    const body = await req.json();
    const productoId = parseInt(body.producto_id, 10);
    if (isNaN(productoId)) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "Debe seleccionar un producto válido." }, { status: 400 });
    }

    const costoCompra = Number(body.costo_compra);
    if (isNaN(costoCompra) || costoCompra < 0) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El costo de compra debe ser mayor o igual a 0." }, { status: 400 });
    }

    const item = await upsertProductoProveedor({
      empresaId: session.empresa_id,
      usuarioId: session.usuario_id,
      productoId,
      proveedorId,
      codigoProductoProveedor: body.codigo_producto_proveedor,
      costoCompra,
      moneda: body.moneda || "DOP",
      tiempoEntregaDias: body.tiempo_entrega_dias !== undefined && body.tiempo_entrega_dias !== "" ? Number(body.tiempo_entrega_dias) : null,
      proveedorPrincipal: Boolean(body.proveedor_principal),
      estado: body.estado || "ACTIVO",
      observacion: body.observacion
    });

    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/inventario/proveedores/[id]/productos:", error);
    if (error instanceof ProductSupplierError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al asociar producto al proveedor." }, { status: 500 });
  }
}
