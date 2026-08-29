import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { recordUserActivity, recordUserAudit, computeDiff, sanitizeAuditPayload } from "@/lib/auditLogger";

// GET /api/crm/component-categories/[id]
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const permsBici = await getModulePermissions("BICICLETA", session.usuario_id);
    const permsCrm = await getModulePermissions("CRM", session.usuario_id);
    if (!permsBici.puede_ver && !permsCrm.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para ver categorías de componentes." }, { status: 403 });
    }

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
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("CRM", session.usuario_id);
    if (!perms.puede_editar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para modificar categorías de componentes." }, { status: 403 });
    }

    const { id } = await context.params;
    const categoryId = parseInt(id, 10);

    if (isNaN(categoryId)) {
      return NextResponse.json({ error: "ID de categoría inválido." }, { status: 400 });
    }

    const beforeRows = await query(`
      SELECT * FROM admin.categoria_componente
      WHERE categoria_componente_id = $1 AND fecha_eliminacion IS NULL
    `, [categoryId]);

    if (!beforeRows || beforeRows.length === 0) {
      return NextResponse.json({ error: "Categoría de componente no encontrada." }, { status: 404 });
    }

    const beforeCategory = beforeRows[0];
    const body = await req.json();
    const codigo = (body.codigo || '').trim().toUpperCase();
    const nombre = (body.nombre || '').trim();
    const descripcion = (body.descripcion || '').trim();
    const orden_visual = body.orden_visual !== undefined && body.orden_visual !== null && body.orden_visual !== '' ? parseInt(body.orden_visual, 10) : 0;
    const activo = body.activo !== undefined ? Boolean(body.activo) : true;

    // Validations
    if (!codigo) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Código de la categoría es obligatorio." }, { status: 400 });
    }
    if (codigo.length > 50) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Código no puede exceder los 50 caracteres." }, { status: 400 });
    }
    if (!nombre) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Nombre de la categoría es obligatorio." }, { status: 400 });
    }
    if (nombre.length > 100) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Nombre no puede exceder los 100 caracteres." }, { status: 400 });
    }
    if (descripcion.length > 300) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "La Descripción no puede exceder los 300 caracteres." }, { status: 400 });
    }
    if (isNaN(orden_visual) || orden_visual < 0) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Orden Visual debe ser un número entero mayor o igual a cero." }, { status: 400 });
    }

    // Unique check for codigo
    const checkCodigo = await query(`
      SELECT categoria_componente_id FROM admin.categoria_componente
      WHERE UPPER(codigo) = $1 AND categoria_componente_id <> $2 AND fecha_eliminacion IS NULL
    `, [codigo, categoryId]);
    if (checkCodigo && checkCodigo.length > 0) {
      return NextResponse.json({ error: "CATEGORY_ALREADY_EXISTS", message: "Ya existe otra categoría registrada con este Código." }, { status: 400 });
    }

    // Unique check for nombre
    const checkNombre = await query(`
      SELECT categoria_componente_id FROM admin.categoria_componente
      WHERE LOWER(nombre) = $1 AND categoria_componente_id <> $2 AND fecha_eliminacion IS NULL
    `, [nombre.toLowerCase(), categoryId]);
    if (checkNombre && checkNombre.length > 0) {
      return NextResponse.json({ error: "CATEGORY_ALREADY_EXISTS", message: "Ya existe otra categoría registrada con este Nombre." }, { status: 400 });
    }

    const sql = `
      UPDATE admin.categoria_componente SET
        codigo = $1,
        nombre = $2,
        descripcion = $3,
        orden_visual = $4,
        activo = $5,
        fecha_modificacion = NOW(),
        usuario_modificacion = $6
      WHERE categoria_componente_id = $7 AND fecha_eliminacion IS NULL
      RETURNING *
    `;

    const result = await query(sql, [codigo, nombre, descripcion || null, orden_visual, activo, session.usuario_id, categoryId]);
    if (!result || result.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "No se pudo actualizar la categoría de componente." }, { status: 404 });
    }

    const updatedCategory = result[0];
    const diff = computeDiff(beforeCategory, updatedCategory);

    if (diff.hasChanges) {
      await recordUserActivity({
        userId: session.usuario_id,
        modulo: "CRM",
        evento: "COMPONENT_CATEGORY_UPDATED",
        descripcion: `Modificación de categoría de componentes ${updatedCategory.nombre} (ID: ${categoryId})`,
        req
      });

      await recordUserAudit({
        userId: session.usuario_id,
        adminId: session.usuario_id,
        accion: "CRM_CATALOG_CATEGORY_UPDATED",
        valorAnterior: diff.valorAnterior,
        valorNuevo: diff.valorNuevo,
        motivo: `Modificación de categoría de componente ID ${categoryId}`,
        req
      });
    }

    return NextResponse.json(updatedCategory);

  } catch (error: any) {
    console.error("Error in PUT /api/crm/component-categories/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/crm/component-categories/[id]
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("CRM", session.usuario_id);
    if (!perms.puede_eliminar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para eliminar categorías de componentes." }, { status: 403 });
    }

    const { id } = await context.params;
    const categoryId = parseInt(id, 10);

    if (isNaN(categoryId)) {
      return NextResponse.json({ error: "INVALID_ID", message: "ID de categoría inválido." }, { status: 400 });
    }

    const beforeRows = await query(`
      SELECT * FROM admin.categoria_componente
      WHERE categoria_componente_id = $1 AND fecha_eliminacion IS NULL
    `, [categoryId]);

    if (!beforeRows || beforeRows.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Categoría de componente no encontrada." }, { status: 404 });
    }

    const beforeCategory = beforeRows[0];

    // Check if any bicycle component is currently using this category
    const usageCheck = await query(`
      SELECT COUNT(*)::int as count FROM admin.bicicleta_componentes
      WHERE categoria_componente_id = $1 AND fecha_eliminacion IS NULL
    `, [categoryId]);

    const compCount = Number(usageCheck[0]?.count || 0);
    if (compCount > 0) {
      // Forensic log for blocked deletion attempt
      await recordUserActivity({
        userId: session.usuario_id,
        modulo: "CRM",
        evento: "COMPONENT_CATEGORY_DELETE_BLOCKED",
        descripcion: `Intento bloqueado de eliminar categoría ${beforeCategory.nombre} (ID: ${categoryId}) por tener ${compCount} componente(s) vinculado(s)`,
        resultado: "DENEGADO",
        req
      });

      return NextResponse.json({
        error: "CATEGORY_IN_USE",
        code: "CATEGORY_IN_USE",
        message: "No puedes eliminar esta categoría porque está siendo utilizada por componentes de bicicletas. Puedes desactivarla en su lugar.",
        dependencies: {
          componentes: compCount
        }
      }, { status: 409 });
    }

    const sql = `
      UPDATE admin.categoria_componente SET
        activo = false,
        fecha_eliminacion = NOW(),
        usuario_eliminacion = $2
      WHERE categoria_componente_id = $1
      RETURNING *
    `;

    const result = await query(sql, [categoryId, session.usuario_id]);
    if (!result || result.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Categoría de componente no encontrada." }, { status: 404 });
    }

    // Forensic logging on success
    await recordUserActivity({
      userId: session.usuario_id,
      modulo: "CRM",
      evento: "COMPONENT_CATEGORY_DELETED",
      descripcion: `Eliminación de categoría de componentes ${beforeCategory.nombre} (ID: ${categoryId})`,
      req
    });

    await recordUserAudit({
      userId: session.usuario_id,
      adminId: session.usuario_id,
      accion: "CRM_CATALOG_CATEGORY_DELETED",
      valorAnterior: JSON.stringify(sanitizeAuditPayload({
        categoria_componente_id: categoryId,
        codigo: beforeCategory.codigo,
        nombre: beforeCategory.nombre
      })),
      valorNuevo: null,
      motivo: `Eliminación de categoría de componente ID ${categoryId}`,
      req
    });

    return NextResponse.json({
      message: "Categoría de componente eliminada correctamente.",
      id: categoryId
    });

  } catch (error: any) {
    console.error("Error in DELETE /api/crm/component-categories/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
