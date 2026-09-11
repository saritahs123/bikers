import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import {
  getProveedoresByProducto,
  upsertProductoProveedor,
  ProductSupplierError,
} from "@/lib/inventory/productSupplierService";

// GET /api/inventario/productos/[id]/proveedores
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
    const permsTaller = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver && !permsTaller.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para consultar proveedores del producto." }, { status: 403 });
    }

    const { id } = await context.params;
    const productoId = parseInt(id, 10);
    if (isNaN(productoId)) {
      return NextResponse.json({ error: "INVALID_ID", message: "ID de producto inválido." }, { status: 400 });
    }

    const empresaId = session.empresa_id;

    // 1. Fetch current associated suppliers
    const proveedoresAsociados = await getProveedoresByProducto(empresaId, productoId);

    // 2. Fetch active suppliers available to associate for this tenant
    const proveedoresDisponibles = await query(
      `SELECT
         pr.proveedor_id,
         pr.codigo_proveedor,
         pr.nombre_comercial,
         pr.nombre_contacto,
         pr.telefono,
         pr.correo,
         pr.rnc
       FROM admin.proveedores pr
       WHERE pr.empresa_id = $1 AND (pr.estado = 'ACTIVO' OR pr.estado IS NULL)
       ORDER BY pr.nombre_comercial ASC`,
      [empresaId]
    );

    return NextResponse.json({
      success: true,
      proveedores: proveedoresAsociados,
      catalogo_proveedores: proveedoresDisponibles
    });
  } catch (error: any) {
    console.error("Error in GET /api/inventario/productos/[id]/proveedores:", error);
    if (error instanceof ProductSupplierError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al consultar proveedores del producto." }, { status: 500 });
  }
}

// POST /api/inventario/productos/[id]/proveedores -> Asignar proveedor a producto
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
    const permsTaller = await getModulePermissions("TALLER", session.usuario_id);
    const canCreateOrEdit = perms.puede_crear || perms.puede_editar || permsTaller.puede_crear || permsTaller.puede_editar;
    if (!canCreateOrEdit) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para asociar proveedores al producto." }, { status: 403 });
    }

    const { id } = await context.params;
    const productoId = parseInt(id, 10);
    if (isNaN(productoId)) {
      return NextResponse.json({ error: "INVALID_ID", message: "ID de producto inválido." }, { status: 400 });
    }

    const body = await req.json();
    const proveedorId = parseInt(body.proveedor_id, 10);
    if (isNaN(proveedorId)) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "Debe seleccionar un proveedor válido." }, { status: 400 });
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
    console.error("Error in POST /api/inventario/productos/[id]/proveedores:", error);
    if (error instanceof ProductSupplierError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al asociar proveedor al producto." }, { status: 500 });
  }
}
