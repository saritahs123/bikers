import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

// GET /api/inventario/tipos-producto/[id]
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

    const rows = await query(`SELECT * FROM admin.tipo_producto WHERE tipo_producto_id = $1 LIMIT 1`, [itemId]);
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Tipo de producto no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: rows[0] });
  } catch (error: any) {
    console.error("Error in GET /api/inventario/tipos-producto/[id]:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al consultar tipo de producto." }, { status: 500 });
  }
}

// PUT /api/inventario/tipos-producto/[id]
export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const permsSeg = await getModulePermissions("SEGURIDAD", session.usuario_id);
    if (!permsSeg.puede_editar) {
      return NextResponse.json({
        error: "FORBIDDEN",
        message: "No posee permisos de administrador para modificar tipos de producto."
      }, { status: 403 });
    }

    const { id } = await context.params;
    const itemId = parseInt(id, 10);
    if (isNaN(itemId)) {
      return NextResponse.json({ error: "INVALID_ID", message: "ID inválido." }, { status: 400 });
    }

    const body = await req.json();
    const codigo = String(body.codigo || "").trim().toUpperCase();
    const nombre = String(body.nombre || "").trim();
    const descripcion = body.descripcion !== undefined ? (body.descripcion ? String(body.descripcion).trim() : null) : undefined;
    const estado = body.estado !== undefined ? (String(body.estado).trim().toUpperCase() === "INACTIVO" ? "INACTIVO" : "ACTIVO") : undefined;

    if (!codigo || !nombre) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "Código y Nombre son obligatorios." }, { status: 400 });
    }

    // Check unique duplicate excluding current id
    const dupCheck = await query(
      `SELECT tipo_producto_id, codigo, nombre
       FROM admin.tipo_producto
       WHERE (UPPER(codigo) = $1 OR UPPER(nombre) = $2) AND tipo_producto_id != $3
       LIMIT 1`,
      [codigo, nombre.toUpperCase(), itemId]
    );
    if (dupCheck && dupCheck.length > 0) {
      const dup = dupCheck[0];
      if (dup.codigo.toUpperCase() === codigo) {
        return NextResponse.json({ error: "DUPLICATE_CODE", message: `Ya existe otro tipo de producto con el código '${codigo}'.` }, { status: 409 });
      }
      return NextResponse.json({ error: "DUPLICATE_NAME", message: `Ya existe otro tipo de producto con el nombre '${nombre}'.` }, { status: 409 });
    }

    const updateRes = await query(
      `UPDATE admin.tipo_producto
       SET
         codigo = $1,
         nombre = $2,
         descripcion = COALESCE($3, descripcion),
         estado = COALESCE($4, estado),
         fecha_actualizacion = NOW(),
         usuario_actualizacion = $5
       WHERE tipo_producto_id = $6
       RETURNING *`,
      [codigo, nombre, descripcion, estado, session.usuario_id, itemId]
    );

    if (!updateRes || updateRes.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Tipo de producto no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: updateRes[0] });
  } catch (error: any) {
    console.error("Error in PUT /api/inventario/tipos-producto/[id]:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al actualizar tipo de producto." }, { status: 500 });
  }
}

// DELETE /api/inventario/tipos-producto/[id]
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const permsSeg = await getModulePermissions("SEGURIDAD", session.usuario_id);
    if (!permsSeg.puede_eliminar) {
      return NextResponse.json({
        error: "FORBIDDEN",
        message: "No posee permisos de administrador para eliminar tipos de producto."
      }, { status: 403 });
    }

    const { id } = await context.params;
    const itemId = parseInt(id, 10);
    if (isNaN(itemId)) {
      return NextResponse.json({ error: "INVALID_ID", message: "ID inválido." }, { status: 400 });
    }

    // Check if products exist with this type
    const prodCountRes = await query(
      `SELECT COUNT(*)::int as count FROM admin.productos WHERE tipo_producto_id = $1`,
      [itemId]
    );
    const hasProducts = Number(prodCountRes[0]?.count || 0) > 0;

    if (hasProducts) {
      return NextResponse.json({
        success: false,
        error: "CATALOG_IN_USE",
        message: "No es posible eliminar este tipo de producto porque posee productos asociados. En su lugar, puede desactivarlo."
      }, { status: 409 });
    }

    // Physical deletion when no dependencies exist
    await query(
      `DELETE FROM admin.tipo_producto WHERE tipo_producto_id = $1`,
      [itemId]
    );

    return NextResponse.json({
      success: true,
      message: "Tipo de producto eliminado permanentemente con éxito."
    });
  } catch (error: any) {
    console.error("Error in DELETE /api/inventario/tipos-producto/[id]:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al procesar la eliminación del tipo de producto." }, { status: 500 });
  }
}
