import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

// GET /api/taller/recepciones/[id]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "NO_SESSION", message: "No hay sesión activa." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso de lectura para el Módulo de Recepción." }, { status: 403 });
    }

    const resolvedParams = await params;
    const recepcion_id = parseInt(resolvedParams.id, 10);
    if (isNaN(recepcion_id)) {
      return NextResponse.json({ error: "ID de recepción inválido." }, { status: 400 });
    }

    // Multitenant Check + Header Fetch
    const rows = await query(
      `SELECT r.recepcion_id, r.codigo_recepcion, r.token_seguimiento, r.fecha_recepcion,
              r.fecha_entrega_estimada, r.diagnostico_preliminar, r.observaciones_cliente,
              r.observaciones_recepcion, r.presupuesto_estimado, r.requiere_aprobacion, r.aprobado_cliente,
              r.fecha_aprobacion_cliente, r.convertido_orden_id,
              c.cliente_id, c.nombre_completo as cliente_nombre, c.telefono_principal as cliente_telefono,
              c.correo as cliente_correo, c.identificacion as cliente_identificacion,
              b.bicicleta_id, b.marca as bicicleta_marca, b.modelo as bicicleta_modelo,
              b.color as bicicleta_color, b.numero_serie_cuadro as bicicleta_serie,
              b.tipo_bicicleta as bicicleta_tipo, b.ano as bicicleta_ano, b.talla as bicicleta_talla,
              b.notas_tecnicas as bicicleta_notas,
              er.estado_recepcion_id, er.nombre as estado_nombre, er.codigo as estado_codigo,
              ts.tipo_servicio_id, ts.nombre as tipo_servicio_nombre
       FROM admin.recepciones r
       LEFT JOIN admin.clientes c ON r.cliente_id = c.cliente_id
       LEFT JOIN admin.bicicletas b ON r.bicicleta_id = b.bicicleta_id
       LEFT JOIN admin.estado_recepcion er ON r.estado_recepcion_id = er.estado_recepcion_id
       LEFT JOIN admin.tipo_servicio ts ON r.tipo_servicio_id = ts.tipo_servicio_id
       LEFT JOIN admin.usuario u ON r.recibido_por_usuario_id = u.usuario_id
       WHERE r.recepcion_id = $1 AND (u.empresa_id = $2 OR u.empresa_id IS NULL OR $2 = 1) AND (r.activo = true OR r.activo IS NULL) AND r.fecha_eliminacion IS NULL
       LIMIT 1`,
      [recepcion_id, session.empresa_id]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "La recepción no existe o no pertenece a su empresa." }, { status: 404 });
    }

    const r = rows[0];

    // Fetch Checklist Items
    const checklistRows = await query(
      `SELECT rc.recepcion_checklist_id, rc.item_checklist_id, rc.estado_checklist_id,
              rc.observacion, rc.requiere_trabajo, rc.evidencia_foto, rc.nombre_archivo, rc.ruta_archivo,
              ic.nombre as item_nombre, ic.categoria as item_categoria,
              ec.nombre as estado_checklist_nombre
       FROM admin.recepcion_checklist rc
       LEFT JOIN admin.item_checklist_recepcion ic ON rc.item_checklist_id = ic.item_checklist_id
       LEFT JOIN admin.estado_checklist ec ON rc.estado_checklist_id = ec.estado_checklist_id
       WHERE rc.recepcion_id = $1 AND (rc.activo = true OR rc.activo IS NULL)
       ORDER BY rc.orden_visual ASC, rc.recepcion_checklist_id ASC`,
      [recepcion_id]
    );

    // Fetch Signature DTO (Safe fields)
    const firmaRows = await query(
      `SELECT firma_recepcion_id, tipo_firma, firma_digital, terminos_aceptados, fecha_firma
       FROM admin.firma_recepcion
       WHERE recepcion_id = $1 AND (activo = true OR activo IS NULL)
       ORDER BY firma_recepcion_id DESC
       LIMIT 1`,
      [recepcion_id]
    );

    const firmaDTO = firmaRows && firmaRows.length > 0 ? {
      firma_recepcion_id: firmaRows[0].firma_recepcion_id,
      tipo_firma: firmaRows[0].tipo_firma,
      firma_digital: firmaRows[0].firma_digital,
      terminos_aceptados: Boolean(firmaRows[0].terminos_aceptados),
      fecha_firma: firmaRows[0].fecha_firma
    } : null;

    return NextResponse.json({
      success: true,
      data: {
        recepcion_id: r.recepcion_id,
        codigo_recepcion: r.codigo_recepcion,
        token_seguimiento: r.token_seguimiento,
        fecha_recepcion: r.fecha_recepcion,
        fecha_entrega_estimada: r.fecha_entrega_estimada,
        diagnostico_preliminar: r.diagnostico_preliminar || "",
        observaciones_cliente: r.observaciones_cliente || "",
        observaciones_recepcion: r.observaciones_recepcion || "",
        presupuesto_estimado: Number(r.presupuesto_estimado || 0),
        requiere_aprobacion: Boolean(r.requiere_aprobacion),
        aprobado_cliente: r.aprobado_cliente,
        fecha_aprobacion_cliente: r.fecha_aprobacion_cliente,
        convertido_orden_id: r.convertido_orden_id,
        cliente: {
          cliente_id: r.cliente_id,
          nombre_completo: r.cliente_nombre || "Cliente General",
          telefono: r.cliente_telefono || "",
          correo: r.cliente_correo || "",
          identificacion: r.cliente_identificacion || ""
        },
        bicicleta: {
          bicicleta_id: r.bicicleta_id,
          marca: r.bicicleta_marca || "Bicicleta",
          modelo: r.bicicleta_modelo || "",
          color: r.bicicleta_color || "",
          numero_serie: r.bicicleta_serie || "",
          tipo_bicicleta: r.bicicleta_tipo || "MTB",
          ano: r.bicicleta_ano ? Number(r.bicicleta_ano) : null,
          talla: r.bicicleta_talla || "",
          notas_tecnicas: r.bicicleta_notas || ""
        },
        estado: {
          estado_recepcion_id: r.estado_recepcion_id,
          nombre: r.estado_nombre || "INGRESADO",
          codigo: r.estado_codigo || "INGRESADO"
        },
        tipo_servicio: r.tipo_servicio_id ? {
          tipo_servicio_id: r.tipo_servicio_id,
          nombre: r.tipo_servicio_nombre || ""
        } : null,
        checklist: (checklistRows || []).map((ch: any) => ({
          recepcion_checklist_id: ch.recepcion_checklist_id,
          item_checklist_id: ch.item_checklist_id,
          item_nombre: ch.item_nombre || "Componente",
          item_categoria: ch.item_categoria || "General",
          estado_checklist_id: ch.estado_checklist_id,
          estado_checklist_nombre: ch.estado_checklist_nombre || "Normal",
          observacion: ch.observacion || "",
          requiere_trabajo: Boolean(ch.requiere_trabajo),
          evidencia_foto: Boolean(ch.evidencia_foto),
          nombre_archivo: ch.nombre_archivo || null,
          url_evidencia: ch.evidencia_foto ? `/api/taller/evidencias/${ch.recepcion_checklist_id}` : null
        })),
        firma: firmaDTO
      }
    });

  } catch (error: any) {
    console.error("Error in GET /api/taller/recepciones/[id]:", error);
    const safeMessage = (error?.message && !error.message.includes("Position:") && !error.message.includes("SQLState"))
      ? error.message
      : "No fue posible cargar el detalle de la recepción. Inténtalo nuevamente.";
    return NextResponse.json({ error: safeMessage, message: safeMessage }, { status: 500 });
  }
}

// PATCH /api/taller/recepciones/[id]
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "NO_SESSION", message: "No hay sesión activa." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_editar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso de edición para el Módulo de Recepción." }, { status: 403 });
    }

    const resolvedParams = await params;
    const recepcion_id = parseInt(resolvedParams.id, 10);
    if (isNaN(recepcion_id)) {
      return NextResponse.json({ error: "ID de recepción inválido." }, { status: 400 });
    }

    const body = await req.json();

    // Check reception exists
    const existing = await query(
      `SELECT r.recepcion_id, r.convertido_orden_id
       FROM admin.recepciones r
       LEFT JOIN admin.usuario u ON r.recibido_por_usuario_id = u.usuario_id
       WHERE r.recepcion_id = $1 AND (u.empresa_id = $2 OR u.empresa_id IS NULL OR $2 = 1) AND (r.activo = true OR r.activo IS NULL) AND r.fecha_eliminacion IS NULL
       LIMIT 1`,
      [recepcion_id, session.empresa_id]
    );

    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "La recepción no existe o no pertenece a su empresa." }, { status: 404 });
    }

    if (existing[0].convertido_orden_id) {
      return NextResponse.json({ error: "LOCKED", message: "No se puede editar una recepción que ya fue convertida a Orden de Trabajo." }, { status: 400 });
    }

    // Allowed Fields
    const updates: string[] = [];
    const updateParams: any[] = [];

    if (body.diagnostico_preliminar !== undefined) {
      updateParams.push(body.diagnostico_preliminar ? String(body.diagnostico_preliminar).trim() : null);
      updates.push(`diagnostico_preliminar = $${updateParams.length}`);
    }
    if (body.observaciones_cliente !== undefined) {
      updateParams.push(body.observaciones_cliente ? String(body.observaciones_cliente).trim() : null);
      updates.push(`observaciones_cliente = $${updateParams.length}`);
    }
    if (body.observaciones_recepcion !== undefined) {
      updateParams.push(body.observaciones_recepcion ? String(body.observaciones_recepcion).trim() : null);
      updates.push(`observaciones_recepcion = $${updateParams.length}`);
    }
    if (body.presupuesto_estimado !== undefined) {
      const p = Number(body.presupuesto_estimado);
      if (isNaN(p) || p < 0) {
        return NextResponse.json({ error: "El presupuesto estimado debe ser un número >= 0." }, { status: 400 });
      }
      updateParams.push(p);
      updates.push(`presupuesto_estimado = $${updateParams.length}`);
    }
    if (body.requiere_aprobacion !== undefined) {
      updateParams.push(Boolean(body.requiere_aprobacion));
      updates.push(`requiere_aprobacion = $${updateParams.length}`);
    }
    if (body.estado_recepcion_id !== undefined) {
      const estId = parseInt(body.estado_recepcion_id, 10);
      if (isNaN(estId)) {
        return NextResponse.json({ error: "Estado de recepción inválido." }, { status: 400 });
      }
      updateParams.push(estId);
      updates.push(`estado_recepcion_id = $${updateParams.length}`);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "Debe enviar al menos un campo permitido para actualizar." }, { status: 400 });
    }

    updateParams.push(session.usuario_id);
    const userIdx = updateParams.length;
    updates.push(`usuario_modificacion = $${userIdx}`);
    updates.push(`fecha_modificacion = NOW()`);

    updateParams.push(recepcion_id);
    const idIdx = updateParams.length;

    const sql = `
      UPDATE admin.recepciones
      SET ${updates.join(", ")}
      WHERE recepcion_id = $${idIdx}
    `;

    await query(sql, updateParams);

    return NextResponse.json({
      success: true,
      message: "Recepción actualizada exitosamente."
    });

  } catch (error: any) {
    console.error("Error in PATCH /api/taller/recepciones/[id]:", error);
    return NextResponse.json({ error: error.message || "Error al actualizar la recepción." }, { status: 500 });
  }
}

// DELETE /api/taller/recepciones/[id] (Soft Delete Exclusivo)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "NO_SESSION", message: "No hay sesión activa." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_inactivar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso para inactivar recepciones." }, { status: 403 });
    }

    const resolvedParams = await params;
    const recepcion_id = parseInt(resolvedParams.id, 10);
    if (isNaN(recepcion_id)) {
      return NextResponse.json({ error: "ID de recepción inválido." }, { status: 400 });
    }

    // Verify reception exists
    const existing = await query(
      `SELECT r.recepcion_id
       FROM admin.recepciones r
       LEFT JOIN admin.usuario u ON r.recibido_por_usuario_id = u.usuario_id
       WHERE r.recepcion_id = $1 AND (u.empresa_id = $2 OR u.empresa_id IS NULL OR $2 = 1) AND (r.activo = true OR r.activo IS NULL) AND r.fecha_eliminacion IS NULL
       LIMIT 1`,
      [recepcion_id, session.empresa_id]
    );

    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "La recepción no existe o no pertenece a su empresa." }, { status: 404 });
    }

    // Soft delete
    await query(
      `UPDATE admin.recepciones
       SET activo = false,
           fecha_eliminacion = NOW(),
           usuario_eliminacion = $1
       WHERE recepcion_id = $2`,
      [session.usuario_id, recepcion_id]
    );

    return NextResponse.json({
      success: true,
      message: "Recepción inactivada correctamente."
    });

  } catch (error: any) {
    console.error("Error in DELETE /api/taller/recepciones/[id]:", error);
    return NextResponse.json({ error: error.message || "Error al inactivar la recepción." }, { status: 500 });
  }
}
