import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { recordUserActivity, recordUserAudit, computeDiff, sanitizeAuditPayload } from "@/lib/auditLogger";

// GET /api/crm/component-states/[id]
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const permsBici = await getModulePermissions("BICICLETA", session.usuario_id);
    const permsCrm = await getModulePermissions("CRM", session.usuario_id);
    if (!permsBici.puede_ver && !permsCrm.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para ver estados de componentes." }, { status: 403 });
    }

    const { id } = await context.params;
    const stateId = parseInt(id, 10);

    if (isNaN(stateId)) {
      return NextResponse.json({ error: "INVALID_ID", message: "ID de estado inválido." }, { status: 400 });
    }

    const rows = await query(`
      SELECT * FROM admin.estado_componente
      WHERE estado_componente_id = $1 AND fecha_eliminacion IS NULL
    `, [stateId]);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Estado de componente no encontrado." }, { status: 404 });
    }

    const r = rows[0];
    return NextResponse.json({
      id: r.estado_componente_id,
      ...r,
      nivel_desgaste: Number(r.nivel_desgaste || 0),
      requiere_revision: Boolean(r.requiere_revision),
      orden_visual: Number(r.orden_visual || 0),
      activo: r.activo !== false,
      estado: r.activo !== false ? 'ACTIVO' : 'INACTIVO'
    });

  } catch (error: any) {
    console.error("Error in GET /api/crm/component-states/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/crm/component-states/[id]
export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("CRM", session.usuario_id);
    if (!perms.puede_editar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para modificar estados de componentes." }, { status: 403 });
    }

    const { id } = await context.params;
    const stateId = parseInt(id, 10);

    if (isNaN(stateId)) {
      return NextResponse.json({ error: "INVALID_ID", message: "ID de estado inválido." }, { status: 400 });
    }

    const beforeRows = await query(`
      SELECT * FROM admin.estado_componente
      WHERE estado_componente_id = $1 AND fecha_eliminacion IS NULL
    `, [stateId]);

    if (!beforeRows || beforeRows.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Estado de componente no encontrado." }, { status: 404 });
    }

    const beforeState = beforeRows[0];
    const body = await req.json();
    const codigo = (body.codigo || '').trim().toUpperCase();
    const nombre = (body.nombre || '').trim();
    const descripcion = (body.descripcion || '').trim();
    const nivel_desgaste = body.nivel_desgaste !== undefined && body.nivel_desgaste !== null && body.nivel_desgaste !== '' ? parseInt(body.nivel_desgaste, 10) : 0;
    const requiere_revision = Boolean(body.requiere_revision);
    const orden_visual = body.orden_visual !== undefined && body.orden_visual !== null && body.orden_visual !== '' ? parseInt(body.orden_visual, 10) : 0;
    const activo = body.activo !== undefined ? Boolean(body.activo) : true;

    // Validations
    if (!codigo) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Código del estado es obligatorio." }, { status: 400 });
    }
    if (codigo.length > 50) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Código no puede exceder los 50 caracteres." }, { status: 400 });
    }
    if (!nombre) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Nombre del estado es obligatorio." }, { status: 400 });
    }
    if (nombre.length > 100) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Nombre no puede exceder los 100 caracteres." }, { status: 400 });
    }
    if (descripcion.length > 300) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "La Descripción no puede exceder los 300 caracteres." }, { status: 400 });
    }
    if (isNaN(nivel_desgaste) || nivel_desgaste < 0 || nivel_desgaste > 100) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Nivel de Desgaste es obligatorio y debe estar entre 0 y 100." }, { status: 400 });
    }
    if (isNaN(orden_visual) || orden_visual < 0) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Orden Visual es obligatorio y debe ser mayor o igual a cero." }, { status: 400 });
    }

    // Unique check for codigo
    const checkCodigo = await query(`
      SELECT estado_componente_id FROM admin.estado_componente
      WHERE UPPER(codigo) = $1 AND estado_componente_id <> $2 AND fecha_eliminacion IS NULL
    `, [codigo, stateId]);
    if (checkCodigo && checkCodigo.length > 0) {
      return NextResponse.json({ error: "STATE_ALREADY_EXISTS", message: "Ya existe otro estado registrado con este Código." }, { status: 400 });
    }

    // Unique check for nombre
    const checkNombre = await query(`
      SELECT estado_componente_id FROM admin.estado_componente
      WHERE LOWER(nombre) = $1 AND estado_componente_id <> $2 AND fecha_eliminacion IS NULL
    `, [nombre.toLowerCase(), stateId]);
    if (checkNombre && checkNombre.length > 0) {
      return NextResponse.json({ error: "STATE_ALREADY_EXISTS", message: "Ya existe otro estado registrado con este Nombre." }, { status: 400 });
    }

    const sql = `
      UPDATE admin.estado_componente SET
        codigo = $1,
        nombre = $2,
        descripcion = $3,
        nivel_desgaste = $4,
        requiere_revision = $5,
        orden_visual = $6,
        activo = $7,
        fecha_modificacion = NOW(),
        usuario_modificacion = $8
      WHERE estado_componente_id = $9 AND fecha_eliminacion IS NULL
      RETURNING *
    `;

    const result = await query(sql, [codigo, nombre, descripcion || null, nivel_desgaste, requiere_revision, orden_visual, activo, session.usuario_id, stateId]);
    if (!result || result.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "No se pudo actualizar el estado de componente." }, { status: 404 });
    }

    const updatedState = result[0];
    const diff = computeDiff(beforeState, updatedState);

    if (diff.hasChanges) {
      await recordUserActivity({
        userId: session.usuario_id,
        modulo: "CRM",
        evento: "COMPONENT_STATE_UPDATED",
        descripcion: `Modificación de estado de componentes ${updatedState.nombre} (ID: ${stateId})`,
        req
      });

      await recordUserAudit({
        userId: session.usuario_id,
        adminId: session.usuario_id,
        accion: "CRM_CATALOG_STATE_UPDATED",
        valorAnterior: diff.valorAnterior,
        valorNuevo: diff.valorNuevo,
        motivo: `Modificación de estado de componente ID ${stateId}`,
        req
      });
    }

    return NextResponse.json(updatedState);

  } catch (error: any) {
    console.error("Error in PUT /api/crm/component-states/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/crm/component-states/[id]
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("CRM", session.usuario_id);
    if (!perms.puede_eliminar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para eliminar estados de componentes." }, { status: 403 });
    }

    const { id } = await context.params;
    const stateId = parseInt(id, 10);

    if (isNaN(stateId)) {
      return NextResponse.json({ error: "INVALID_ID", message: "ID de estado inválido." }, { status: 400 });
    }

    const beforeRows = await query(`
      SELECT * FROM admin.estado_componente
      WHERE estado_componente_id = $1 AND fecha_eliminacion IS NULL
    `, [stateId]);

    if (!beforeRows || beforeRows.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Estado de componente no encontrado." }, { status: 404 });
    }

    const beforeState = beforeRows[0];

    // Check if any bicycle component is currently using this state
    const usageCheck = await query(`
      SELECT COUNT(*)::int as count FROM admin.bicicleta_componentes
      WHERE estado_componente_id = $1 AND fecha_eliminacion IS NULL
    `, [stateId]);

    const compCount = Number(usageCheck[0]?.count || 0);
    if (compCount > 0) {
      // Forensic log for blocked deletion attempt
      await recordUserActivity({
        userId: session.usuario_id,
        modulo: "CRM",
        evento: "COMPONENT_STATE_DELETE_BLOCKED",
        descripcion: `Intento bloqueado de eliminar estado ${beforeState.nombre} (ID: ${stateId}) por tener ${compCount} componente(s) vinculado(s)`,
        resultado: "DENEGADO",
        req
      });

      return NextResponse.json({
        error: "COMPONENT_STATE_IN_USE",
        code: "COMPONENT_STATE_IN_USE",
        message: "No puedes eliminar este estado porque está siendo utilizado por componentes de bicicletas. Puedes desactivarlo en su lugar.",
        dependencies: {
          componentes: compCount
        }
      }, { status: 409 });
    }

    const sql = `
      UPDATE admin.estado_componente SET
        activo = false,
        fecha_eliminacion = NOW(),
        usuario_eliminacion = $2
      WHERE estado_componente_id = $1
      RETURNING *
    `;

    const result = await query(sql, [stateId, session.usuario_id]);
    if (!result || result.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Estado de componente no encontrado." }, { status: 404 });
    }

    // Forensic logging on success
    await recordUserActivity({
      userId: session.usuario_id,
      modulo: "CRM",
      evento: "COMPONENT_STATE_DELETED",
      descripcion: `Eliminación de estado de componentes ${beforeState.nombre} (ID: ${stateId})`,
      req
    });

    await recordUserAudit({
      userId: session.usuario_id,
      adminId: session.usuario_id,
      accion: "CRM_CATALOG_STATE_DELETED",
      valorAnterior: JSON.stringify(sanitizeAuditPayload({
        estado_componente_id: stateId,
        codigo: beforeState.codigo,
        nombre: beforeState.nombre
      })),
      valorNuevo: null,
      motivo: `Eliminación de estado de componente ID ${stateId}`,
      req
    });

    return NextResponse.json({
      message: "Estado de componente eliminado correctamente.",
      id: stateId
    });

  } catch (error: any) {
    console.error("Error in DELETE /api/crm/component-states/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
