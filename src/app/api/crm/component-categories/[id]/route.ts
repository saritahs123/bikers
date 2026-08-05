import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/crm/component-categories/[id]
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const categoryId = parseInt(id, 10);

    if (isNaN(categoryId)) {
      return NextResponse.json({ error: "ID de categoría inválido." }, { status: 400 });
    }

    const rows = await query(`
      SELECT * FROM admin.categoria_componente
      WHERE categoria_componente_id = $1 AND fecha_eliminacion IS NULL
    `, [categoryId]);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Categoría de componente no encontrada." }, { status: 404 });
    }

    const r = rows[0];
    return NextResponse.json({
      id: r.categoria_componente_id,
      ...r,
      estado: r.activo !== false ? 'ACTIVO' : 'INACTIVO'
    });

  } catch (error: any) {
    console.error("Error in GET /api/crm/component-categories/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/crm/component-categories/[id]
export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const categoryId = parseInt(id, 10);

    if (isNaN(categoryId)) {
      return NextResponse.json({ error: "ID de categoría inválido." }, { status: 400 });
    }

    const body = await req.json();
    const codigo = (body.codigo || '').trim().toUpperCase();
    const nombre = (body.nombre || '').trim();
    const descripcion = (body.descripcion || '').trim();
    const orden_visual = body.orden_visual !== undefined && body.orden_visual !== null && body.orden_visual !== '' ? parseInt(body.orden_visual, 10) : 0;
    const activo = body.activo !== undefined ? Boolean(body.activo) : true;

    // Validations
    if (!codigo) {
      return NextResponse.json({ error: "El Código de la categoría es obligatorio." }, { status: 400 });
    }
    if (codigo.length > 50) {
      return NextResponse.json({ error: "El Código no puede exceder los 50 caracteres." }, { status: 400 });
    }
    if (!nombre) {
      return NextResponse.json({ error: "El Nombre de la categoría es obligatorio." }, { status: 400 });
    }
    if (nombre.length > 100) {
      return NextResponse.json({ error: "El Nombre no puede exceder los 100 caracteres." }, { status: 400 });
    }
    if (descripcion.length > 300) {
      return NextResponse.json({ error: "La Descripción no puede exceder los 300 caracteres." }, { status: 400 });
    }
    if (isNaN(orden_visual) || orden_visual < 0) {
      return NextResponse.json({ error: "El Orden Visual debe ser un número entero mayor o igual a cero." }, { status: 400 });
    }

    // Unique check for codigo
    const checkCodigo = await query(`
      SELECT categoria_componente_id FROM admin.categoria_componente
      WHERE UPPER(codigo) = $1 AND categoria_componente_id <> $2 AND fecha_eliminacion IS NULL
    `, [codigo, categoryId]);
    if (checkCodigo && checkCodigo.length > 0) {
      return NextResponse.json({ error: "Ya existe otra categoría registrada con este Código." }, { status: 400 });
    }

    // Unique check for nombre
    const checkNombre = await query(`
      SELECT categoria_componente_id FROM admin.categoria_componente
      WHERE LOWER(nombre) = $1 AND categoria_componente_id <> $2 AND fecha_eliminacion IS NULL
    `, [nombre.toLowerCase(), categoryId]);
    if (checkNombre && checkNombre.length > 0) {
      return NextResponse.json({ error: "Ya existe otra categoría registrada con este Nombre." }, { status: 400 });
    }

    const sql = `
      UPDATE admin.categoria_componente SET
        codigo = $1,
        nombre = $2,
        descripcion = $3,
        orden_visual = $4,
        activo = $5,
        fecha_modificacion = NOW()
      WHERE categoria_componente_id = $6 AND fecha_eliminacion IS NULL
      RETURNING *
    `;

    const result = await query(sql, [codigo, nombre, descripcion || null, orden_visual, activo, categoryId]);
    if (!result || result.length === 0) {
      return NextResponse.json({ error: "No se pudo actualizar la categoría de componente." }, { status: 404 });
    }

    return NextResponse.json(result[0]);

  } catch (error: any) {
    console.error("Error in PUT /api/crm/component-categories/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/crm/component-categories/[id]
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const categoryId = parseInt(id, 10);

    if (isNaN(categoryId)) {
      return NextResponse.json({ error: "ID de categoría inválido." }, { status: 400 });
    }

    const sql = `
      UPDATE admin.categoria_componente SET
        activo = false,
        fecha_eliminacion = NOW()
      WHERE categoria_componente_id = $1
      RETURNING *
    `;

    const result = await query(sql, [categoryId]);
    if (!result || result.length === 0) {
      return NextResponse.json({ error: "Categoría de componente no encontrada." }, { status: 404 });
    }

    return NextResponse.json({ message: "Categoría de componente eliminada correctamente.", id: categoryId });

  } catch (error: any) {
    console.error("Error in DELETE /api/crm/component-categories/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
