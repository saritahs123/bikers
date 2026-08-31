import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { recordUserActivity, recordUserAudit, computeDiff, sanitizeAuditPayload } from "@/lib/auditLogger";

// GET /api/taller/tipos-servicio/[id]
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para consultar este tipo de servicio." }, { status: 403 });
    }

    const { id } = await context.params;
    const tipoServicioId = parseInt(id, 10);

    if (isNaN(tipoServicioId)) {
      return NextResponse.json({ error: "ID de tipo de servicio inválido." }, { status: 400 });
    }

    const rows = await query(`
      SELECT 
        ts.tipo_servicio_id AS id,
        ts.tipo_servicio_id,
        ts.categoria_servicio_id,
        cs.nombre AS categoria_nombre,
        cs.codigo AS categoria_codigo,
        ts.codigo,
        ts.nombre,
        ts.descripcion,
        COALESCE(ts.duracion_estimada_horas, 0)::numeric AS duracion_estimada_horas,
        COALESCE(ts.precio_base, 0)::numeric AS precio_base,
        COALESCE(ts.requiere_diagnostico, false) AS requiere_diagnostico,
        COALESCE(ts.requiere_aprobacion_cliente, false) AS requiere_aprobacion_cliente,
        COALESCE(ts.orden_visual, 0) AS orden_visual,
        COALESCE(ts.activo, true) AS activo,
        ts.fecha_creacion,
        ts.usuario_creacion,
        ts.fecha_modificacion,
        ts.usuario_modificacion
      FROM admin.tipo_servicio ts
      LEFT JOIN admin.categoria_servicio cs ON ts.categoria_servicio_id = cs.categoria_servicio_id
      WHERE ts.tipo_servicio_id = $1 AND ts.fecha_eliminacion IS NULL
    `, [tipoServicioId]);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Tipo de servicio no encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: rows[0]
    });
  } catch (error: any) {
    console.error("Error in GET /api/taller/tipos-servicio/[id]:", error);
    return NextResponse.json({ error: error.message || "Error al obtener tipo de servicio" }, { status: 500 });
  }
}

// PUT /api/taller/tipos-servicio/[id]
export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_editar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para modificar tipos de servicio." }, { status: 403 });
    }

    const { id } = await context.params;
    const tipoServicioId = parseInt(id, 10);

    if (isNaN(tipoServicioId)) {
      return NextResponse.json({ error: "ID de tipo de servicio inválido." }, { status: 400 });
    }

    const beforeRows = await query(`
      SELECT * FROM admin.tipo_servicio
      WHERE tipo_servicio_id = $1 AND fecha_eliminacion IS NULL
    `, [tipoServicioId]);

    if (!beforeRows || beforeRows.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Tipo de servicio no encontrado." }, { status: 404 });
    }

    const beforeItem = beforeRows[0];
    const body = await req.json();

    // Support toggle activo or full update
    const codigo = (body.codigo !== undefined ? body.codigo : beforeItem.codigo || '').trim().toUpperCase();
    const nombre = (body.nombre !== undefined ? body.nombre : beforeItem.nombre || '').trim();
    const descripcion = (body.descripcion !== undefined ? body.descripcion : beforeItem.descripcion || '').trim();
    const categoria_servicio_id = body.categoria_servicio_id !== undefined ? parseInt(body.categoria_servicio_id, 10) : beforeItem.categoria_servicio_id;
    const duracion_estimada_horas = body.duracion_estimada_horas !== undefined && body.duracion_estimada_horas !== null && body.duracion_estimada_horas !== ''
      ? parseFloat(body.duracion_estimada_horas)
      : (beforeItem.duracion_estimada_horas || 0);
    const precio_base = body.precio_base !== undefined && body.precio_base !== null && body.precio_base !== ''
      ? parseFloat(body.precio_base)
      : (beforeItem.precio_base || 0);
    const requiere_diagnostico = body.requiere_diagnostico !== undefined ? Boolean(body.requiere_diagnostico) : Boolean(beforeItem.requiere_diagnostico);
    const requiere_aprobacion_cliente = body.requiere_aprobacion_cliente !== undefined ? Boolean(body.requiere_aprobacion_cliente) : Boolean(beforeItem.requiere_aprobacion_cliente);
    const orden_visual = body.orden_visual !== undefined && body.orden_visual !== null && body.orden_visual !== ''
      ? parseInt(body.orden_visual, 10)
      : (beforeItem.orden_visual || 0);
    const activo = body.activo !== undefined ? Boolean(body.activo) : (beforeItem.activo !== false);

    // Validations
    if (!codigo) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Código del tipo de servicio es obligatorio.", field: "codigo" }, { status: 400 });
    }
    if (codigo.length > 50) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Código no puede exceder los 50 caracteres.", field: "codigo" }, { status: 400 });
    }
    if (!nombre) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Nombre del tipo de servicio es obligatorio.", field: "nombre" }, { status: 400 });
    }
    if (nombre.length > 150) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Nombre no puede exceder los 150 caracteres.", field: "nombre" }, { status: 400 });
    }
    if (descripcion.length > 500) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "La Descripción no puede exceder los 500 caracteres.", field: "descripcion" }, { status: 400 });
    }
    if (!categoria_servicio_id || isNaN(categoria_servicio_id)) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "Debe seleccionar una Categoría de Servicio válida.", field: "categoria_servicio_id" }, { status: 400 });
    }
    if (isNaN(duracion_estimada_horas) || duracion_estimada_horas < 0) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "La Duración Estimada debe ser mayor o igual a 0.", field: "duracion_estimada_horas" }, { status: 400 });
    }
    if (isNaN(precio_base) || precio_base < 0) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Precio Base debe ser mayor o igual a 0.00 DOP.", field: "precio_base" }, { status: 400 });
    }
    if (isNaN(orden_visual) || orden_visual < 0) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Orden Visual debe ser un entero mayor o igual a 0.", field: "orden_visual" }, { status: 400 });
    }

    // Uniqueness Checks for other records
    const checkCodigo = await query(`
      SELECT tipo_servicio_id FROM admin.tipo_servicio
      WHERE UPPER(codigo) = $1 AND tipo_servicio_id <> $2 AND fecha_eliminacion IS NULL
    `, [codigo, tipoServicioId]);
    if (checkCodigo && checkCodigo.length > 0) {
      return NextResponse.json({ error: "SERVICE_TYPE_ALREADY_EXISTS", message: "Ya existe otro tipo de servicio registrado con este Código.", field: "codigo" }, { status: 409 });
    }

    const checkNombre = await query(`
      SELECT tipo_servicio_id FROM admin.tipo_servicio
      WHERE LOWER(nombre) = $1 AND tipo_servicio_id <> $2 AND fecha_eliminacion IS NULL
    `, [nombre.toLowerCase(), tipoServicioId]);
    if (checkNombre && checkNombre.length > 0) {
      return NextResponse.json({ error: "SERVICE_TYPE_ALREADY_EXISTS", message: "Ya existe otro tipo de servicio registrado con este Nombre.", field: "nombre" }, { status: 409 });
    }

    const sql = `
      UPDATE admin.tipo_servicio SET
        categoria_servicio_id = $1,
        codigo = $2,
        nombre = $3,
        descripcion = $4,
        duracion_estimada_horas = $5,
        precio_base = $6,
        requiere_diagnostico = $7,
        requiere_aprobacion_cliente = $8,
        orden_visual = $9,
        activo = $10,
        fecha_modificacion = NOW(),
        usuario_modificacion = $11
      WHERE tipo_servicio_id = $12 AND fecha_eliminacion IS NULL
      RETURNING *
    `;

    const result = await query(sql, [
      categoria_servicio_id,
      codigo,
      nombre,
      descripcion || null,
      duracion_estimada_horas,
      precio_base,
      requiere_diagnostico,
      requiere_aprobacion_cliente,
      orden_visual,
      activo,
      session.usuario_id,
      tipoServicioId
    ]);

    if (!result || result.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Tipo de servicio no encontrado." }, { status: 404 });
    }

    const updated = result[0];
    const diff = computeDiff(beforeItem, updated);

    if (diff.hasChanges) {
      let eventType = "SERVICE_TYPE_UPDATED";
      if (beforeItem.activo !== false && updated.activo === false) {
        eventType = "SERVICE_TYPE_DEACTIVATED";
      } else if (beforeItem.activo === false && updated.activo === true) {
        eventType = "SERVICE_TYPE_REACTIVATED";
      }

      await recordUserActivity({
        userId: session.usuario_id,
        modulo: "TALLER",
        evento: eventType,
        descripcion: `Actualización de tipo de servicio ${updated.nombre} (ID: ${tipoServicioId})`,
        req
      });

      await recordUserAudit({
        userId: session.usuario_id,
        adminId: session.usuario_id,
        accion: "TALLER_SERVICE_TYPE_UPDATED",
        valorAnterior: diff.valorAnterior,
        valorNuevo: diff.valorNuevo,
        motivo: `Modificación de tipo de servicio ID ${tipoServicioId}`,
        req
      });
    }

    return NextResponse.json({
      success: true,
      message: "Tipo de servicio actualizado correctamente.",
      data: {
        id: updated.tipo_servicio_id,
        ...updated
      }
    });

  } catch (error: any) {
    console.error("Error in PUT /api/taller/tipos-servicio/[id]:", error);
    return NextResponse.json({ error: error.message || "No fue posible actualizar el tipo de servicio" }, { status: 500 });
  }
}

// DELETE /api/taller/tipos-servicio/[id]
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_eliminar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para eliminar tipos de servicio." }, { status: 403 });
    }

    const { id } = await context.params;
    const tipoServicioId = parseInt(id, 10);

    if (isNaN(tipoServicioId)) {
      return NextResponse.json({ error: "ID de tipo de servicio inválido." }, { status: 400 });
    }

    const beforeRows = await query(`
      SELECT * FROM admin.tipo_servicio
      WHERE tipo_servicio_id = $1 AND fecha_eliminacion IS NULL
    `, [tipoServicioId]);

    if (!beforeRows || beforeRows.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Tipo de servicio no encontrado." }, { status: 404 });
    }

    const beforeItem = beforeRows[0];

    // 1. Audit usage references in Workshop (orden_servicios and recepciones)
    const ordersCheck = await query(`
      SELECT COUNT(*)::int AS total FROM admin.orden_servicios
      WHERE tipo_servicio_id = $1
    `, [tipoServicioId]);
    const totalOrders = Number(ordersCheck[0]?.total || 0);

    const recCheck = await query(`
      SELECT COUNT(*)::int AS total FROM admin.recepciones
      WHERE tipo_servicio_id = $1
    `, [tipoServicioId]);
    const totalReceptions = Number(recCheck[0]?.total || 0);

    const totalUsage = totalOrders + totalReceptions;

    // 2. Block physical deletion if dependencies exist -> Return HTTP 409
    if (totalUsage > 0) {
      await recordUserActivity({
        userId: session.usuario_id,
        modulo: "TALLER",
        evento: "SERVICE_TYPE_DELETE_BLOCKED",
        descripcion: `Intento de eliminación de tipo de servicio en uso ${beforeItem.nombre} (ID: ${tipoServicioId})`,
        resultado: "DENEGADO",
        req
      });

      return NextResponse.json({
        success: false,
        error: "SERVICE_TYPE_IN_USE",
        code: "SERVICE_TYPE_IN_USE",
        message: "Este tipo de servicio está siendo utilizado y no puede eliminarse. Puedes desactivarlo para evitar que sea utilizado en nuevos registros.",
        dependencies: {
          orden_servicios: totalOrders,
          recepciones: totalReceptions,
          total: totalUsage
        }
      }, { status: 409 });
    }

    // 3. Perform physical deletion if 0 dependencies exist
    const delResult = await query(`
      DELETE FROM admin.tipo_servicio
      WHERE tipo_servicio_id = $1
      RETURNING tipo_servicio_id
    `, [tipoServicioId]);

    if (!delResult || delResult.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Tipo de servicio no encontrado." }, { status: 404 });
    }

    // Forensic logging on successful deletion
    await recordUserActivity({
      userId: session.usuario_id,
      modulo: "TALLER",
      evento: "SERVICE_TYPE_DELETED",
      descripcion: `Eliminación física de tipo de servicio ${beforeItem.nombre} (ID: ${tipoServicioId})`,
      req
    });

    await recordUserAudit({
      userId: session.usuario_id,
      adminId: session.usuario_id,
      accion: "TALLER_SERVICE_TYPE_DELETED",
      valorAnterior: JSON.stringify(sanitizeAuditPayload({
        tipo_servicio_id: beforeItem.tipo_servicio_id,
        codigo: beforeItem.codigo,
        nombre: beforeItem.nombre,
        categoria_servicio_id: beforeItem.categoria_servicio_id,
        precio_base: beforeItem.precio_base
      })),
      valorNuevo: null,
      motivo: `Eliminación de tipo de servicio ID ${tipoServicioId} sin dependencias`,
      req
    });

    return NextResponse.json({
      success: true,
      message: "Tipo de servicio eliminado correctamente.",
      id: tipoServicioId
    });

  } catch (error: any) {
    console.error("Error in DELETE /api/taller/tipos-servicio/[id]:", error);
    return NextResponse.json({ error: error.message || "No fue posible eliminar el tipo de servicio" }, { status: 500 });
  }
}
