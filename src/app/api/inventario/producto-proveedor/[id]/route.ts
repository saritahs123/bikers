import { NextResponse } from "next/server";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import {
  updateProductoProveedor,
  inactivateProductoProveedor,
  ProductSupplierError,
} from "@/lib/inventory/productSupplierService";

// PUT /api/inventario/producto-proveedor/[id] -> Editar relación
export async function PUT(
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
    const canEdit = perms.puede_editar || permsTaller.puede_editar;
    if (!canEdit) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para modificar relaciones comerciales." }, { status: 403 });
    }

    const { id } = await context.params;
    const relId = parseInt(id, 10);
    if (isNaN(relId)) {
      return NextResponse.json({ error: "INVALID_ID", message: "ID inválido." }, { status: 400 });
    }

    const body = await req.json();

    const item = await updateProductoProveedor({
      empresaId: session.empresa_id,
      usuarioId: session.usuario_id,
      productoProveedorId: relId,
      codigoProductoProveedor: body.codigo_producto_proveedor,
      costoCompra: body.costo_compra !== undefined ? Number(body.costo_compra) : undefined,
      moneda: body.moneda,
      tiempoEntregaDias: body.tiempo_entrega_dias !== undefined && body.tiempo_entrega_dias !== "" ? Number(body.tiempo_entrega_dias) : (body.tiempo_entrega_dias === null ? null : undefined),
      proveedorPrincipal: body.proveedor_principal !== undefined ? Boolean(body.proveedor_principal) : undefined,
      estado: body.estado,
      observacion: body.observacion
    });

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    console.error("Error in PUT /api/inventario/producto-proveedor/[id]:", error);
    if (error instanceof ProductSupplierError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al actualizar relación producto-proveedor." }, { status: 500 });
  }
}

// DELETE /api/inventario/producto-proveedor/[id] -> Inactivar lógicamente
export async function DELETE(
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
    const canDelete = perms.puede_eliminar || permsTaller.puede_eliminar || perms.puede_editar;
    if (!canDelete) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para inactivar relaciones comerciales." }, { status: 403 });
    }

    const { id } = await context.params;
    const relId = parseInt(id, 10);
    if (isNaN(relId)) {
      return NextResponse.json({ error: "INVALID_ID", message: "ID inválido." }, { status: 400 });
    }

    await inactivateProductoProveedor(session.empresa_id, session.usuario_id, relId);

    return NextResponse.json({ success: true, message: "Relación producto-proveedor inactivada correctamente." });
  } catch (error: any) {
    console.error("Error in DELETE /api/inventario/producto-proveedor/[id]:", error);
    if (error instanceof ProductSupplierError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al inactivar relación producto-proveedor." }, { status: 500 });
  }
}
