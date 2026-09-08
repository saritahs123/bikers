import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { recordUserActivity, recordUserAudit, computeDiff, sanitizeAuditPayload } from "@/lib/auditLogger";

const CANONICAL_STATUS_IDS = [1, 2, 3, 5, 7, 8];
const CANONICAL_STATUS_CODES = [
  "RECIBIDA",
  "HOLD",
  "APROBACION",
  "REPARACION",
  "LISTA_ENTREGA",
  "ENTREGADA"
];
const ACTIVE_CORE_CANONICAL_IDS = [1, 5, 7, 8]; // RECIBIDA, REPARACION, LISTA_ENTREGA, ENTREGADA

// GET /api/taller/estados-orden/[id]
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para consultar este estado de orden." }, { status: 403 });
    }

    const { id } = await context.params;
    const estadoId = parseInt(id, 10);
    if (isNaN(estadoId)) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Identificador de estado inválido." }, { status: 400 });
    }

    const rows = await query(`
      SELECT 
        eot.estado_orden_id AS id,
        eot.estado_orden_id,
        eot.codigo,
        eot.nombre,
        eot.descripcion,
        eot.color_estado,
        eot.orden_visual,
        eot.estado_inicial,
        eot.estado_final,
        eot.permite_edicion,
        eot.activo,
        eot.fecha_registro,
        eot.usuario_registro,
        eot.fecha_actualizacion,
        eot.usuario_actualizacion,
        (
          SELECT COUNT(DISTINCT ot.orden_trabajo_id)::int
          FROM admin.ordenes_trabajo ot
          WHERE ot.estado_orden_id = eot.estado_orden_id
        ) AS total_ordenes,
        (
          SELECT COUNT(DISTINCT ohe.orden_historial_estado_id)::int
          FROM admin.orden_historial_estado ohe
          WHERE ohe.estado_anterior_id = eot.estado_orden_id OR ohe.estado_nuevo_id = eot.estado_orden_id
        ) AS total_historial
      FROM admin.estado_orden_trabajo eot
      WHERE eot.estado_orden_id = $1
      LIMIT 1;
    `, [estadoId]);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "El estado de orden solicitado no existe." }, { status: 404 });
    }

    const r = rows[0];
    const isCanonical = CANONICAL_STATUS_IDS.includes(Number(r.estado_orden_id)) ||
      CANONICAL_STATUS_CODES.includes(String(r.codigo || "").toUpperCase());
    const totalRefs = Number(r.total_ordenes || 0) + Number(r.total_historial || 0);

    return NextResponse.json({
      success: true,
      data: {
        id: r.estado_orden_id,
        estado_orden_id: r.estado_orden_id,
        codigo: r.codigo || "",
        nombre: r.nombre || "",
        descripcion: r.descripcion || "",
        color_estado: r.color_estado || "#64748B",
        orden_visual: Number(r.orden_visual ?? 0),
        estado_inicial: Boolean(r.estado_inicial),
        estado_final: Boolean(r.estado_final),
        permite_edicion: Boolean(r.permite_edicion),
        activo: r.activo !== false,
        es_estructural: isCanonical,
        total_ordenes: Number(r.total_ordenes || 0),
        total_historial: Number(r.total_historial || 0),
        en_uso: totalRefs > 0,
        fecha_registro: r.fecha_registro ? String(r.fecha_registro) : null,
        fecha_actualizacion: r.fecha_actualizacion ? String(r.fecha_actualizacion) : null
      }
    });
  } catch (error: any) {
    console.error("Error in GET /api/taller/estados-orden/[id]:", error);
    return NextResponse.json({
      success: false,
      error: "SERVER_ERROR",
      message: "Error al consultar el estado de orden de trabajo."
    }, { status: 500 });
  }
}

// PUT /api/taller/estados-orden/[id]
export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_editar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para editar estados de orden de trabajo." }, { status: 403 });
    }

    const { id } = await context.params;
    const estadoId = parseInt(id, 10);
    if (isNaN(estadoId)) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Identificador de estado inválido." }, { status: 400 });
    }

    // Fetch current state
    const currentRows = await query(
      `SELECT * FROM admin.estado_orden_trabajo WHERE estado_orden_id = $1 LIMIT 1`,
      [estadoId]
    );

    if (!currentRows || currentRows.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "El estado de orden a editar no existe." }, { status: 404 });
    }

    const currentState = currentRows[0];
    const isCanonical = CANONICAL_STATUS_IDS.includes(Number(currentState.estado_orden_id)) ||
      CANONICAL_STATUS_CODES.includes(String(currentState.codigo || "").toUpperCase());

    const body = await req.json();

    const rawCodigo = body.codigo ? String(body.codigo).trim().toUpperCase() : currentState.codigo;
    const rawNombre = body.nombre ? String(body.nombre).trim() : currentState.nombre;
    const rawDescripcion = body.descripcion !== undefined
      ? (body.descripcion ? String(body.descripcion).trim() : null)
      : currentState.descripcion;
    let rawColor = body.color_estado
      ? String(body.color_estado).trim().toUpperCase()
      : (currentState.color_estado || "#64748B");
    const rawOrdenVisual = body.orden_visual !== undefined && body.orden_visual !== null && body.orden_visual !== ""
      ? parseInt(body.orden_visual, 10)
      : Number(currentState.orden_visual ?? 0);
    const rawPermiteEdicion = body.permite_edicion !== undefined
      ? Boolean(body.permite_edicion)
      : Boolean(currentState.permite_edicion);
    const rawActivo = body.activo !== undefined
      ? Boolean(body.activo)
      : Boolean(currentState.activo);

    // Safeguard for Canonical States
    if (isCanonical) {
      if (rawCodigo !== currentState.codigo) {
        return NextResponse.json({
          error: "FORBIDDEN_MUTATION",
          message: "El código de un estado principal del sistema no puede modificarse."
        }, { status: 400 });
      }

      if (body.estado_inicial !== undefined && Boolean(body.estado_inicial) !== Boolean(currentState.estado_inicial)) {
        return NextResponse.json({
          error: "FORBIDDEN_MUTATION",
          message: "La propiedad de estado inicial de un estado del sistema no puede alterarse."
        }, { status: 400 });
      }

      if (body.estado_final !== undefined && Boolean(body.estado_final) !== Boolean(currentState.estado_final)) {
        return NextResponse.json({
          error: "FORBIDDEN_MUTATION",
          message: "La propiedad de estado final de un estado del sistema no puede alterarse."
        }, { status: 400 });
      }

      // Check if trying to deactivate a core active canonical state
      if (ACTIVE_CORE_CANONICAL_IDS.includes(Number(currentState.estado_orden_id)) && rawActivo === false) {
        return NextResponse.json({
          error: "FORBIDDEN_MUTATION",
          message: "No se puede desactivar un estado principal activo del flujo operativo de órdenes."
        }, { status: 400 });
      }
    } else {
      // Non-canonical states cannot be set as initial or final
      if (body.estado_inicial === true) {
        return NextResponse.json({
          error: "VALIDATION_ERROR",
          message: "El estado inicial es único y pertenece exclusivamente al estado RECIBIDA."
        }, { status: 400 });
      }

      if (body.estado_final === true) {
        return NextResponse.json({
          error: "VALIDATION_ERROR",
          message: "El estado final es único y pertenece exclusivamente al estado ENTREGADA."
        }, { status: 400 });
      }
    }

    // Validation: Codigo (for custom states)
    if (!rawCodigo) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Código del estado es obligatorio." }, { status: 400 });
    }
    if (rawCodigo.length > 50) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Código no puede superar los 50 caracteres." }, { status: 400 });
    }
    if (!/^[A-Z0-9_-]+$/.test(rawCodigo)) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Código solo puede contener letras mayúsculas, números, guiones y guiones bajos." }, { status: 400 });
    }

    // Validation: Nombre
    if (!rawNombre) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Nombre del estado es obligatorio." }, { status: 400 });
    }
    if (rawNombre.length > 100) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Nombre no puede superar los 100 caracteres." }, { status: 400 });
    }

    // Validation: Descripcion
    if (rawDescripcion && rawDescripcion.length > 300) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "La Descripción no puede superar los 300 caracteres." }, { status: 400 });
    }

    // Validation: Color
    if (!/^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(rawColor)) {
      rawColor = currentState.color_estado || "#64748B";
    }

    // Validation: Orden Visual
    if (isNaN(rawOrdenVisual) || rawOrdenVisual < 0) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Orden Visual debe ser un número entero mayor o igual a cero." }, { status: 400 });
    }

    // Check collision on other records
    const collisionCheck = await query(
      `SELECT estado_orden_id, codigo, nombre 
       FROM admin.estado_orden_trabajo 
       WHERE (UPPER(codigo) = $1 OR UPPER(nombre) = UPPER($2)) AND estado_orden_id != $3 
       LIMIT 1`,
      [rawCodigo, rawNombre, estadoId]
    );

    if (collisionCheck && collisionCheck.length > 0) {
      const match = collisionCheck[0];
      if (String(match.codigo).toUpperCase() === rawCodigo) {
        return NextResponse.json({ error: "CONFLICT", message: `Ya existe otro estado con el código '${rawCodigo}'.` }, { status: 409 });
      }
      if (String(match.nombre).toUpperCase() === rawNombre.toUpperCase()) {
        return NextResponse.json({ error: "CONFLICT", message: `Ya existe otro estado con el nombre '${rawNombre}'.` }, { status: 409 });
      }
    }

    // Execute safe update
    const updateSql = `
      UPDATE admin.estado_orden_trabajo
      SET
        codigo = $1,
        nombre = $2,
        descripcion = $3,
        color_estado = $4,
        orden_visual = $5,
        permite_edicion = $6,
        activo = $7,
        fecha_actualizacion = NOW(),
        usuario_actualizacion = $8
      WHERE estado_orden_id = $9
      RETURNING *;
    `;

    const updatedRows = await query(updateSql, [
      rawCodigo,
      rawNombre,
      rawDescripcion,
      rawColor,
      rawOrdenVisual,
      rawPermiteEdicion,
      rawActivo,
      session.usuario_id,
      estadoId
    ]);

    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json({ error: "SERVER_ERROR", message: "No se pudo actualizar el estado de orden de trabajo." }, { status: 500 });
    }

    const updatedItem = updatedRows[0];
    const diff = computeDiff(currentState, updatedItem);

    // Audit Logging
    await recordUserAudit({
      userId: session.usuario_id,
      adminId: session.usuario_id,
      accion: "TALLER_ORDER_STATUS_UPDATED",
      valorAnterior: diff.valorAnterior,
      valorNuevo: diff.valorNuevo,
      motivo: `Modificación de estado de orden ID ${estadoId} (${updatedItem.codigo})`,
      req
    });

    await recordUserActivity({
      userId: session.usuario_id,
      modulo: "TALLER",
      evento: "ACTUALIZAR_ESTADO_ORDEN",
      descripcion: `Actualización de estado de orden #${estadoId}: ${updatedItem.nombre} (${updatedItem.codigo})`,
      req
    });

    return NextResponse.json({
      success: true,
      message: "Estado de orden de trabajo actualizado exitosamente.",
      data: {
        id: updatedItem.estado_orden_id,
        estado_orden_id: updatedItem.estado_orden_id,
        codigo: updatedItem.codigo,
        nombre: updatedItem.nombre,
        descripcion: updatedItem.descripcion,
        color_estado: updatedItem.color_estado,
        orden_visual: Number(updatedItem.orden_visual ?? 0),
        estado_inicial: Boolean(updatedItem.estado_inicial),
        estado_final: Boolean(updatedItem.estado_final),
        permite_edicion: Boolean(updatedItem.permite_edicion),
        activo: updatedItem.activo !== false,
        es_estructural: isCanonical,
        fecha_registro: updatedItem.fecha_registro ? String(updatedItem.fecha_registro) : null,
        fecha_actualizacion: updatedItem.fecha_actualizacion ? String(updatedItem.fecha_actualizacion) : null
      }
    });
  } catch (error: any) {
    console.error("Error in PUT /api/taller/estados-orden/[id]:", error);
    return NextResponse.json({
      success: false,
      error: "SERVER_ERROR",
      message: "Error al procesar la actualización del estado de orden de trabajo."
    }, { status: 500 });
  }
}

// DELETE /api/taller/estados-orden/[id]
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_eliminar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para eliminar estados de orden de trabajo." }, { status: 403 });
    }

    const { id } = await context.params;
    const estadoId = parseInt(id, 10);
    if (isNaN(estadoId)) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Identificador de estado inválido." }, { status: 400 });
    }

    // Fetch existing state record
    const rows = await query(
      `SELECT * FROM admin.estado_orden_trabajo WHERE estado_orden_id = $1 LIMIT 1`,
      [estadoId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "El estado de orden a eliminar no existe." }, { status: 404 });
    }

    const stateToDelete = rows[0];

    // Rule 1: Canonical Structural States cannot be deleted (always 409)
    const isCanonical = CANONICAL_STATUS_IDS.includes(Number(stateToDelete.estado_orden_id)) ||
      CANONICAL_STATUS_CODES.includes(String(stateToDelete.codigo || "").toUpperCase());

    if (isCanonical) {
      return NextResponse.json({
        error: "CONFLICT",
        message: "Este es un estado principal del sistema y no puede eliminarse."
      }, { status: 409 });
    }

    // Rule 2: Check referential integrity across dependencies
    const refCheck = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM admin.ordenes_trabajo WHERE estado_orden_id = $1) AS ref_ordenes,
        (SELECT COUNT(*)::int FROM admin.orden_historial_estado WHERE estado_anterior_id = $1 OR estado_nuevo_id = $1) AS ref_historial;
    `, [estadoId]);

    const refOrdenes = Number(refCheck[0]?.ref_ordenes || 0);
    const refHistorial = Number(refCheck[0]?.ref_historial || 0);

    if (refOrdenes > 0 || refHistorial > 0) {
      return NextResponse.json({
        error: "CONFLICT",
        message: "Este estado no puede eliminarse porque está siendo utilizado por órdenes de trabajo o su historial."
      }, { status: 409 });
    }

    // Audit Logging before deletion to retain full context
    await recordUserAudit({
      userId: session.usuario_id,
      adminId: session.usuario_id,
      accion: "TALLER_ORDER_STATUS_DELETED",
      valorAnterior: sanitizeAuditPayload(stateToDelete),
      valorNuevo: null,
      motivo: `Eliminación de estado de orden ID ${estadoId} (${stateToDelete.codigo})`,
      req
    });

    await recordUserActivity({
      userId: session.usuario_id,
      modulo: "TALLER",
      evento: "ELIMINAR_ESTADO_ORDEN",
      descripcion: `Eliminación de estado de orden #${estadoId}: ${stateToDelete.nombre} (${stateToDelete.codigo})`,
      req
    });

    // Execute physical delete
    await query(
      `DELETE FROM admin.estado_orden_trabajo WHERE estado_orden_id = $1`,
      [estadoId]
    );

    return NextResponse.json({
      success: true,
      message: "Estado de orden de trabajo eliminado exitosamente."
    });
  } catch (error: any) {
    console.error("Error in DELETE /api/taller/estados-orden/[id]:", error);
    return NextResponse.json({
      success: false,
      error: "SERVER_ERROR",
      message: "Error al procesar la eliminación del estado de orden de trabajo."
    }, { status: 500 });
  }
}
