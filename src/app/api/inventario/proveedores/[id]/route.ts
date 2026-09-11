import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

// GET /api/inventario/proveedores/[id]
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const { id } = await context.params;
    const itemId = parseInt(id, 10);
    if (isNaN(itemId)) {
      return NextResponse.json({ error: "INVALID_ID", message: "ID inválido." }, { status: 400 });
    }

    const empresaId = session.empresa_id;

    const rows = await query(
      `SELECT * FROM admin.proveedores WHERE proveedor_id = $1 AND empresa_id = $2 LIMIT 1`,
      [itemId, empresaId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Proveedor no encontrado en su empresa." }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: rows[0] });
  } catch (error: any) {
    console.error("Error in GET /api/inventario/proveedores/[id]:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al consultar proveedor." }, { status: 500 });
  }
}

// PUT /api/inventario/proveedores/[id]
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
    if (!perms.puede_editar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para editar proveedores." }, { status: 403 });
    }

    const empresaId = session.empresa_id;
    const { id } = await context.params;
    const itemId = parseInt(id, 10);
    if (isNaN(itemId)) {
      return NextResponse.json({ error: "INVALID_ID", message: "ID inválido." }, { status: 400 });
    }

    const body = await req.json();
    const codigo_proveedor = String(body.codigo_proveedor || "").trim().toUpperCase();
    const nombre_comercial = String(body.nombre_comercial || "").trim();
    const nombre_contacto = body.nombre_contacto !== undefined ? (body.nombre_contacto ? String(body.nombre_contacto).trim() : null) : undefined;
    const telefono = body.telefono !== undefined ? (body.telefono ? String(body.telefono).trim() : null) : undefined;
    const correo = body.correo !== undefined ? (body.correo ? String(body.correo).trim() : null) : undefined;
    const direccion = body.direccion !== undefined ? (body.direccion ? String(body.direccion).trim() : null) : undefined;
    const rnc = body.rnc !== undefined ? (body.rnc ? String(body.rnc).trim() : null) : undefined;
    const sitio_web = body.sitio_web !== undefined ? (body.sitio_web ? String(body.sitio_web).trim() : null) : undefined;
    const estado = body.estado !== undefined ? (String(body.estado).trim().toUpperCase() === "INACTIVO" ? "INACTIVO" : "ACTIVO") : undefined;
    const observacion = body.observacion !== undefined ? (body.observacion ? String(body.observacion).trim() : null) : undefined;

    if (!codigo_proveedor || !nombre_comercial) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "Código y Nombre Comercial son obligatorios." }, { status: 400 });
    }

    // Check duplicate in same empresa excluding current id
    const dupCheck = await query(
      `SELECT proveedor_id, codigo_proveedor, nombre_comercial
       FROM admin.proveedores
       WHERE empresa_id = $1
         AND (UPPER(codigo_proveedor) = $2 OR UPPER(nombre_comercial) = $3)
         AND proveedor_id != $4
       LIMIT 1`,
      [empresaId, codigo_proveedor, nombre_comercial.toUpperCase(), itemId]
    );

    if (dupCheck && dupCheck.length > 0) {
      const dup = dupCheck[0];
      if (dup.codigo_proveedor.toUpperCase() === codigo_proveedor) {
        return NextResponse.json({ error: "DUPLICATE_CODE", message: `Ya existe otro proveedor con el código '${codigo_proveedor}'.` }, { status: 409 });
      }
      return NextResponse.json({ error: "DUPLICATE_NAME", message: `Ya existe otro proveedor con el nombre '${nombre_comercial}'.` }, { status: 409 });
    }

    const updateRes = await query(
      `UPDATE admin.proveedores
       SET
         codigo_proveedor = $1,
         nombre_comercial = $2,
         nombre_contacto = COALESCE($3, nombre_contacto),
         telefono = COALESCE($4, telefono),
         correo = COALESCE($5, correo),
         direccion = COALESCE($6, direccion),
         rnc = COALESCE($7, rnc),
         sitio_web = COALESCE($8, sitio_web),
         estado = COALESCE($9, estado),
         observacion = COALESCE($10, observacion),
         fecha_actualizacion = NOW(),
         usuario_actualizacion = $11
       WHERE proveedor_id = $12 AND empresa_id = $13
       RETURNING *`,
      [
        codigo_proveedor,
        nombre_comercial,
        nombre_contacto,
        telefono,
        correo,
        direccion,
        rnc,
        sitio_web,
        estado,
        observacion,
        session.usuario_id,
        itemId,
        empresaId
      ]
    );

    if (!updateRes || updateRes.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Proveedor no encontrado o no pertenece a su empresa." }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: updateRes[0] });
  } catch (error: any) {
    console.error("Error in PUT /api/inventario/proveedores/[id]:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al actualizar proveedor." }, { status: 500 });
  }
}

// DELETE /api/inventario/proveedores/[id] -> Eliminación inteligente (física si no tiene compras, lógica si tiene historial)
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
    if (!perms.puede_eliminar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para eliminar proveedores." }, { status: 403 });
    }

    const empresaId = session.empresa_id;
    const { id } = await context.params;
    const itemId = parseInt(id, 10);
    if (isNaN(itemId)) {
      return NextResponse.json({ error: "INVALID_ID", message: "ID inválido." }, { status: 400 });
    }

    // Verificar que el proveedor existe y pertenece a la empresa de la sesión
    const provCheck = await query(
      `SELECT proveedor_id FROM admin.proveedores WHERE proveedor_id = $1 AND empresa_id = $2`,
      [itemId, empresaId]
    );
    if (!provCheck || provCheck.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Proveedor no encontrado o no pertenece a su empresa." }, { status: 404 });
    }

    // 1. Verificar si tiene órdenes de compra transaccionales
    const ocRows = await query(
      `SELECT COUNT(*)::int AS count
       FROM admin.orden_compra
       WHERE proveedor_id = $1`,
      [itemId]
    );
    const hasPurchaseOrders = Number(ocRows[0]?.count || 0) > 0;

    if (hasPurchaseOrders) {
      // Inactivación lógica por integridad contable
      await query(
        `UPDATE admin.proveedores
         SET estado = 'INACTIVO', fecha_actualizacion = NOW(), usuario_actualizacion = $1
         WHERE proveedor_id = $2 AND empresa_id = $3`,
        [session.usuario_id, itemId, empresaId]
      );

      return NextResponse.json({
        success: true,
        message: "El proveedor tiene órdenes de compra asociadas. Se ha marcado como INACTIVO para proteger el historial contable."
      });
    }

    // 2. Si no tiene órdenes de compra, eliminar relaciones con productos y luego eliminar proveedor
    await query(
      `DELETE FROM admin.producto_proveedor WHERE proveedor_id = $1`,
      [itemId]
    );

    const delRes = await query(
      `DELETE FROM admin.proveedores
       WHERE proveedor_id = $1 AND empresa_id = $2
       RETURNING proveedor_id`,
      [itemId, empresaId]
    );

    if (!delRes || delRes.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Proveedor no encontrado o no pertenece a su empresa." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Proveedor eliminado permanentemente con éxito."
    });
  } catch (error: any) {
    console.error("Error in DELETE /api/inventario/proveedores/[id]:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al eliminar proveedor." }, { status: 500 });
  }
}
