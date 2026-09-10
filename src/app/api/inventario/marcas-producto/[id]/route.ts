import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

// GET /api/inventario/marcas-producto/[id]
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

    const rows = await query(`SELECT * FROM admin.marca_producto WHERE marca_producto_id = $1 LIMIT 1`, [itemId]);
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Marca de producto no encontrada." }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: rows[0] });
  } catch (error: any) {
    console.error("Error in GET /api/inventario/marcas-producto/[id]:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al consultar marca de producto." }, { status: 500 });
  }
}

// PUT /api/inventario/marcas-producto/[id]
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
        message: "No posee permisos de administrador para modificar marcas de producto."
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
    const pais_origen = body.pais_origen !== undefined ? (body.pais_origen ? String(body.pais_origen).trim() : null) : undefined;
    const sitio_web = body.sitio_web !== undefined ? (body.sitio_web ? String(body.sitio_web).trim() : null) : undefined;
    const estado = body.estado !== undefined ? (String(body.estado).trim().toUpperCase() === "INACTIVO" ? "INACTIVO" : "ACTIVO") : undefined;

    if (!codigo || !nombre) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "Código y Nombre son obligatorios." }, { status: 400 });
    }

    // Check unique duplicate
    const dupCheck = await query(
      `SELECT marca_producto_id, codigo, nombre
       FROM admin.marca_producto
       WHERE (UPPER(codigo) = $1 OR UPPER(nombre) = $2) AND marca_producto_id != $3
       LIMIT 1`,
      [codigo, nombre.toUpperCase(), itemId]
    );
    if (dupCheck && dupCheck.length > 0) {
      const dup = dupCheck[0];
      if (dup.codigo.toUpperCase() === codigo) {
        return NextResponse.json({ error: "DUPLICATE_CODE", message: `Ya existe otra marca con el código '${codigo}'.` }, { status: 409 });
      }
      return NextResponse.json({ error: "DUPLICATE_NAME", message: `Ya existe otra marca con el nombre '${nombre}'.` }, { status: 409 });
    }

    const updateRes = await query(
      `UPDATE admin.marca_producto
       SET
         codigo = $1,
         nombre = $2,
         descripcion = COALESCE($3, descripcion),
         pais_origen = COALESCE($4, pais_origen),
         sitio_web = COALESCE($5, sitio_web),
         estado = COALESCE($6, estado),
         fecha_actualizacion = NOW(),
         usuario_actualizacion = $7
       WHERE marca_producto_id = $8
       RETURNING *`,
      [codigo, nombre, descripcion, pais_origen, sitio_web, estado, session.usuario_id, itemId]
    );

    if (!updateRes || updateRes.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Marca de producto no encontrada." }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: updateRes[0] });
  } catch (error: any) {
    console.error("Error in PUT /api/inventario/marcas-producto/[id]:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al actualizar marca de producto." }, { status: 500 });
  }
}

// DELETE /api/inventario/marcas-producto/[id]
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
        message: "No posee permisos de administrador para eliminar marcas de producto."
      }, { status: 403 });
    }

    const { id } = await context.params;
    const itemId = parseInt(id, 10);
    if (isNaN(itemId)) {
      return NextResponse.json({ error: "INVALID_ID", message: "ID inválido." }, { status: 400 });
    }

    // Check if products exist with this brand
    const prodCountRes = await query(
      `SELECT COUNT(*)::int as count FROM admin.productos WHERE marca_producto_id = $1`,
      [itemId]
    );
    const hasProducts = Number(prodCountRes[0]?.count || 0) > 0;

    if (hasProducts) {
      return NextResponse.json({
        success: false,
        error: "CATALOG_IN_USE",
        message: "No es posible eliminar esta marca de producto porque posee productos asociados. En su lugar, puede desactivarla."
      }, { status: 409 });
    }

    // Physical deletion
    await query(
      `DELETE FROM admin.marca_producto WHERE marca_producto_id = $1`,
      [itemId]
    );

    return NextResponse.json({
      success: true,
      message: "Marca de producto eliminada permanentemente con éxito."
    });
  } catch (error: any) {
    console.error("Error in DELETE /api/inventario/marcas-producto/[id]:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al procesar la eliminación de la marca." }, { status: 500 });
  }
}
