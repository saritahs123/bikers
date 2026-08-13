import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

// Helper for cleaning dates safely
function cleanFecha(val: any) {
  if (!val || typeof val !== 'string' || !val.trim()) return null;
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

// GET /api/taller/ordenes/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();

  try {
    const session = await getWorkshopSession();
    if (!session) {
      client.release();
      return NextResponse.json({ error: "NO_SESSION", message: "No hay sesión activa." }, { status: 401 });
    }

    const perms = await getModulePermissions(6, session.rol_principal_id);
    if (!perms.puede_ver) {
      client.release();
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso de lectura." }, { status: 403 });
    }

    const ordenId = parseInt(id, 10);
    if (isNaN(ordenId)) {
      client.release();
      return NextResponse.json({ error: "ID de orden no válido." }, { status: 400 });
    }

    // Detail query
    const orderSql = `
      SELECT 
        ot.orden_trabajo_id AS orden_id,
        ot.codigo_orden,
        ot.recepcion_id,
        r.codigo_recepcion,
        ot.estado_orden_id,
        eot.nombre AS estado_nombre,
        eot.codigo AS estado_codigo,
        ot.prioridad_orden_id AS prioridad_id,
        pot.nombre AS prioridad_nombre,
        pot.color_estado AS prioridad_color,
        ot.diagnostico_inicial,
        ot.observacion_interna AS observaciones,
        ot.fecha_recepcion AS fecha_ingreso,
        ot.fecha_entrega_estimada AS fecha_prometida,
        ot.fecha_inicio_trabajo AS fecha_inicio,
        ot.fecha_finalizacion AS fecha_termino,
        COALESCE(c.cliente_id, r.cliente_id) AS cliente_id,
        COALESCE(c.nombre_completo, 'Cliente General') AS cliente_nombre,
        c.telefono_principal AS cliente_telefono,
        c.correo AS cliente_correo,
        c.direccion AS cliente_direccion,
        COALESCE(b.bicicleta_id, r.bicicleta_id) AS bicicleta_id,
        COALESCE(b.marca, 'Bicicleta') AS bicicleta_marca,
        COALESCE(b.modelo, 'Sin Modelo') AS bicicleta_modelo,
        b.ano AS bicicleta_ano,
        b.numero_serie_cuadro AS bicicleta_serie,
        ot.subtotal_servicios,
        ot.subtotal_productos,
        ot.descuento_servicios,
        ot.descuento_productos,
        ot.subtotal_general,
        ot.impuesto,
        ot.total_orden
      FROM admin.ordenes_trabajo ot
      LEFT JOIN admin.recepciones r ON ot.recepcion_id = r.recepcion_id
      LEFT JOIN admin.clientes c ON COALESCE(ot.cliente_id, r.cliente_id) = c.cliente_id
      LEFT JOIN admin.bicicletas b ON COALESCE(ot.bicicleta_id, r.bicicleta_id) = b.bicicleta_id
      LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
      LEFT JOIN admin.prioridad_orden_trabajo pot ON ot.prioridad_orden_id = pot.prioridad_orden_trabajo_id
      WHERE ot.orden_trabajo_id = $1 AND ot.activo = true
    `;

    const orderRes = await client.query(orderSql, [ordenId]);
    if (orderRes.rows.length === 0) {
      client.release();
      return NextResponse.json({ error: "Orden de trabajo no encontrada." }, { status: 404 });
    }

    const order = orderRes.rows[0];

    // Services query
    const servSql = `
      SELECT 
        os.orden_servicio_id AS servicio_id,
        os.tipo_servicio_id,
        ts.nombre AS tipo_servicio_nombre,
        os.estado_orden_servicio_id AS estado_servicio_id,
        eos.nombre AS estado_servicio_nombre,
        os.cantidad,
        os.precio_unitario,
        os.porcentaje_descuento,
        os.valor_descuento,
        COALESCE(NULLIF(os.subtotal, 0), ROUND((os.cantidad * os.precio_unitario) - COALESCE(os.valor_descuento, 0), 2)) AS subtotal,
        os.observacion_tecnica AS motivo_sin_mano_obra,
        os.usuario_id AS mecanico_usuario_id,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), ui.correo_electronico, ('Mecánico #' || u.usuario_id::text)) AS mecanico_nombre,
        (
          SELECT COUNT(*)::int 
          FROM admin.orden_servicio_mano_obra 
          WHERE orden_servicio_id = os.orden_servicio_id AND fecha_finalizacion IS NULL AND (activo IS DISTINCT FROM false)
        ) > 0 AS en_proceso_cronometro
      FROM admin.orden_servicios os
      LEFT JOIN admin.tipo_servicio ts ON os.tipo_servicio_id = ts.tipo_servicio_id
      LEFT JOIN admin.estado_orden_servicio eos ON os.estado_orden_servicio_id = eos.estado_orden_servicio_id
      LEFT JOIN admin.usuario u ON os.usuario_id = u.usuario_id
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      WHERE os.orden_trabajo_id = $1 AND (os.activo IS DISTINCT FROM false)
      ORDER BY os.orden_servicio_id ASC
    `;

    const servRes = await client.query(servSql, [ordenId]);
    const servicios = servRes.rows;

    // Labor rows query
    const laborSql = `
      SELECT 
        mo.orden_servicio_mano_obra_id,
        mo.orden_servicio_mano_obra_id AS mano_obra_id,
        mo.orden_servicio_id,
        mo.usuario_id AS mecanico_usuario_id,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), ('Mecánico #' || mo.usuario_id::text)) AS mecanico_nombre,
        mo.fecha_inicio,
        mo.fecha_finalizacion,
        mo.minutos_trabajados,
        mo.minutos_facturables,
        mo.costo_hora,
        mo.costo_total,
        (mo.fecha_finalizacion IS NULL) AS es_abierta
      FROM admin.orden_servicio_mano_obra mo
      JOIN admin.orden_servicios os ON mo.orden_servicio_id = os.orden_servicio_id
      LEFT JOIN admin.usuario u ON mo.usuario_id = u.usuario_id
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      WHERE os.orden_trabajo_id = $1 AND (mo.activo IS DISTINCT FROM false)
      ORDER BY mo.orden_servicio_mano_obra_id DESC
    `;
    const laborRes = await client.query(laborSql, [ordenId]);

    // Products query
    const prodSql = `
      SELECT 
        op.orden_producto_id,
        op.orden_producto_id AS producto_id,
        op.orden_servicio_id,
        op.producto_id AS catalogo_producto_id,
        p.codigo_producto,
        p.nombre AS producto_nombre,
        op.cantidad,
        op.precio_unitario,
        op.porcentaje_descuento,
        op.valor_descuento,
        op.subtotal
      FROM admin.orden_productos op
      LEFT JOIN admin.productos p ON op.producto_id = p.producto_id
      WHERE op.orden_trabajo_id = $1
      ORDER BY op.orden_producto_id ASC
    `;
    const prodRes = await client.query(prodSql, [ordenId]);

    // History query
    const histSql = `
      SELECT 
        h.orden_historial_estado_id AS historial_id,
        h.estado_anterior_id,
        e1.nombre AS estado_anterior_nombre,
        h.estado_nuevo_id,
        e2.nombre AS estado_nuevo_nombre,
        h.usuario_cambio AS usuario_id,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), ui.correo_electronico, ('Usuario #' || h.usuario_cambio::text)) AS usuario_nombre,
        h.comentario,
        h.fecha_cambio AS fecha
      FROM admin.orden_historial_estado h
      LEFT JOIN admin.estado_orden_trabajo e1 ON h.estado_anterior_id = e1.estado_orden_id
      LEFT JOIN admin.estado_orden_trabajo e2 ON h.estado_nuevo_id = e2.estado_orden_id
      LEFT JOIN admin.usuario u ON h.usuario_cambio = u.usuario_id
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      WHERE h.orden_trabajo_id = $1 AND (h.activo IS DISTINCT FROM false)
      ORDER BY h.orden_historial_estado_id DESC
    `;
    const histRes = await client.query(histSql, [ordenId]);

    // Compute progress percentage and total registered labor hours
    const totalMinsRes = await client.query(`
      SELECT COALESCE(SUM(minutos_trabajados), 0)::int AS total_minutos
      FROM admin.orden_servicio_mano_obra osmo
      JOIN admin.orden_servicios os ON osmo.orden_servicio_id = os.orden_servicio_id
      WHERE os.orden_trabajo_id = $1 AND (osmo.activo IS DISTINCT FROM false)
    `, [ordenId]);
    const totalMinutos = totalMinsRes.rows[0]?.total_minutos || 0;
    const horasRegistradas = Math.round((totalMinutos / 60.0) * 10) / 10;

    const activeServs = servicios.filter((s: any) => s.estado_servicio_id !== 4);
    const completedServs = activeServs.filter((s: any) => s.estado_servicio_id === 3);
    const progresoPorcentaje = activeServs.length > 0 ? Math.round((completedServs.length / activeServs.length) * 100) : 0;

    const serviciosConDetalle = servicios.map((s: any) => {
      const sId = s.servicio_id || s.orden_servicio_id;
      return {
        ...s,
        orden_servicio_id: sId,
        mano_obra: laborRes.rows.filter((m: any) => Number(m.orden_servicio_id) === Number(sId)),
        productos: prodRes.rows.filter((p: any) => Number(p.orden_servicio_id) === Number(sId))
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        ...order,
        progreso_porcentaje: progresoPorcentaje,
        horas_registradas: horasRegistradas,
        servicios_activos_count: activeServs.length,
        servicios_completados_count: completedServs.length,
        servicios: serviciosConDetalle,
        mano_obra: laborRes.rows,
        repuestos: prodRes.rows,
        historial: histRes.rows
      }
    });
  } catch (err: any) {
    console.error("GET /api/taller/ordenes/[id] Error:", err);
    return NextResponse.json({ error: "Error al consultar la orden.", details: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// PUT /api/taller/ordenes/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();

  try {
    const session = await getWorkshopSession();
    if (!session || !session.usuario_id) {
      client.release();
      return NextResponse.json({ error: "NO_SESSION", message: "Sesión no válida o expirada." }, { status: 401 });
    }
    const sessionUserId = session.usuario_id;
    const ordenId = parseInt(id, 10);

    if (isNaN(ordenId)) {
      client.release();
      return NextResponse.json({ error: "ID de orden no válido." }, { status: 400 });
    }

    const body = await req.json();
    const {
      estado_orden_id,
      prioridad_orden_id,
      fecha_entrega_estimada,
      diagnostico_inicial,
      observacion_interna,
      observacion_entrega,
      persona_recibe,
      motivo_devolucion,
      servicio_id_reabrir
    } = body;

    // Single dedicated client transaction START
    await client.query("BEGIN");

    // Lock Order Row Exclusively
    const orderRes = await client.query(`
      SELECT ot.orden_trabajo_id, ot.estado_orden_id, ot.prioridad_orden_id, ot.fecha_entrega_estimada, ot.diagnostico_inicial, ot.observacion_interna
      FROM admin.ordenes_trabajo ot
      WHERE ot.orden_trabajo_id = $1 AND ot.activo = true
      FOR UPDATE OF ot
    `, [ordenId]);

    if (orderRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Orden de trabajo no encontrada." }, { status: 404 });
    }

    const currentOrder = orderRes.rows[0];
    const currentStateId = currentOrder.estado_orden_id;

    // Read-only check for ENTREGADA (8)
    if (currentStateId === 8) {
      await client.query("ROLLBACK");
      return NextResponse.json({
        error: "READ_ONLY_ORDER",
        message: "La orden se encuentra en estado ENTREGADA. Está en modo de solo lectura permanente."
      }, { status: 409 });
    }

    // Check IAM permissions for state transition / edit
    const perms = await getModulePermissions(6, session.rol_principal_id);

    const isEditingFields = prioridad_orden_id !== undefined || observacion_interna !== undefined || diagnostico_inicial !== undefined || fecha_entrega_estimada !== undefined;
    if (isEditingFields && !perms.puede_editar) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permiso para realizar esta acción." }, { status: 403 });
    }

    if (estado_orden_id !== undefined && parseInt(estado_orden_id, 10) !== currentStateId) {
      const targetStateId = parseInt(estado_orden_id, 10);

      // Allowed transitions matrix
      const ALLOWED_TRANSITIONS: Record<number, number[]> = {
        1: [5],     // RECIBIDA -> REPARACION
        5: [7],     // REPARACION -> LISTA_ENTREGA
        7: [5, 8],  // LISTA_ENTREGA -> REPARACION (devolución) o ENTREGADA (entrega)
        8: []       // Read-only
      };

      if (!ALLOWED_TRANSITIONS[currentStateId]?.includes(targetStateId)) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          error: "TRANSITION_NOT_ALLOWED",
          message: `Transición de estado no permitida: del estado ${currentStateId} al estado ${targetStateId}.`
        }, { status: 409 });
      }

      // Check specific state IAM permissions
      if (currentStateId === 7 && targetStateId === 5) {
        if (!perms.puede_reabrir) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permiso para realizar esta acción." }, { status: 403 });
        }
      } else if (targetStateId === 8) {
        if (!perms.puede_cerrar) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permiso para realizar esta acción." }, { status: 403 });
        }
      } else {
        if (!perms.puede_mover) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permiso para realizar esta acción." }, { status: 403 });
        }
      }

      // Validation for Transition 1 -> 5 (RECIBIDA -> REPARACION)
      if (currentStateId === 1 && targetStateId === 5) {
        const servCheck = await client.query(`
          SELECT os.orden_servicio_id, os.usuario_id, os.cantidad, os.precio_unitario, os.porcentaje_descuento, u.estado AS usuario_estado, tu.codigo AS tipo_usuario_codigo
          FROM admin.orden_servicios os
          LEFT JOIN admin.usuario u ON os.usuario_id = u.usuario_id
          LEFT JOIN admin.tipo_usuario tu ON u.tipo_usuario_id = tu.tipo_usuario_id
          WHERE os.orden_trabajo_id = $1 AND (os.activo IS DISTINCT FROM false)
        `, [ordenId]);

        if (servCheck.rows.length === 0) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            error: "NO_SERVICES",
            message: "No se puede iniciar la reparación: la orden no posee servicios activos registrados."
          }, { status: 422 });
        }

        const unassignedOrInvalid = servCheck.rows.filter(s => 
          !s.usuario_id || s.usuario_estado !== 'ACTIVO' || s.tipo_usuario_codigo !== 'MECANICO' || parseFloat(s.cantidad || 0) <= 0 || parseFloat(s.precio_unitario || 0) < 0
        );

        if (unassignedOrInvalid.length > 0) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            error: "UNASSIGNED_MECHANIC",
            message: "Debes asignar un mecánico a todos los servicios antes de iniciar la reparación.",
            servicios_pendientes: unassignedOrInvalid.map(s => s.orden_servicio_id)
          }, { status: 422 });
        }
      }

      // Validation for Transition 5 -> 7 (REPARACION -> LISTA_ENTREGA)
      if (currentStateId === 5 && targetStateId === 7) {
        const servStats = await client.query(`
          SELECT 
            os.orden_servicio_id,
            os.estado_orden_servicio_id,
            ts.nombre AS tipo_servicio_nombre
          FROM admin.orden_servicios os
          LEFT JOIN admin.tipo_servicio ts ON os.tipo_servicio_id = ts.tipo_servicio_id
          WHERE os.orden_trabajo_id = $1 AND (os.activo IS DISTINCT FROM false)
        `, [ordenId]);

        const totalActivos = servStats.rows.length;
        const noCompletados = servStats.rows.filter(s => s.estado_orden_servicio_id !== 3);

        if (totalActivos === 0) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            error: "NO_ACTIVE_SERVICES",
            message: "No se puede pasar a Lista de Entrega: la orden no posee servicios activos."
          }, { status: 422 });
        }

        if (noCompletados.length > 0) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            error: "SERVICES_NOT_COMPLETED",
            message: `No se puede pasar a Lista de Entrega: existen ${noCompletados.length} servicio(s) sin completar.`,
            servicios_pendientes: noCompletados.map(s => s.orden_servicio_id),
            detalles_pendientes: noCompletados.map(s => `Servicio #${s.orden_servicio_id}: ${s.tipo_servicio_nombre || 'Sin nombre'}`)
          }, { status: 422 });
        }

        // Open sessions check
        const openSessionsRes = await client.query(`
          SELECT COUNT(*)::int AS open_count
          FROM admin.orden_servicio_mano_obra mo
          JOIN admin.orden_servicios os ON mo.orden_servicio_id = os.orden_servicio_id
          WHERE os.orden_trabajo_id = $1 AND mo.fecha_finalizacion IS NULL AND (mo.activo IS DISTINCT FROM false)
        `, [ordenId]);

        if (openSessionsRes.rows[0]?.open_count > 0) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            error: "OPEN_SESSIONS",
            message: "No se puede pasar a Lista de Entrega: existen sesiones de tiempo abiertas. Pause las sesiones primero."
          }, { status: 409 });
        }
      }

      // Validation for Transition 7 -> 5 (LISTA_ENTREGA -> REPARACION)
      if (currentStateId === 7 && targetStateId === 5) {
        if (!motivo_devolucion || !motivo_devolucion.trim()) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            error: "REASON_REQUIRED",
            message: "Se requiere un motivo obligatorio para devolver la orden a reparación."
          }, { status: 400 });
        }

        if (servicio_id_reabrir) {
          await client.query(`
            UPDATE admin.orden_servicios
            SET estado_orden_servicio_id = 2,
                usuario_actualizacion = $1
            WHERE orden_servicio_id = $2 AND orden_trabajo_id = $3
          `, [sessionUserId, parseInt(servicio_id_reabrir, 10), ordenId]);
        }
      }

      // Validation for Transition 7 -> 8 (LISTA_ENTREGA -> ENTREGADA)
      if (currentStateId === 7 && targetStateId === 8) {
        if (!persona_recibe || !persona_recibe.trim()) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            error: "PERSONA_RECIBE_REQUIRED",
            message: "Debe indicar obligatoriamente el nombre de la persona que recibe la bicicleta."
          }, { status: 400 });
        }
      }

      // Perform State Update
      let updateStateSql = `
        UPDATE admin.ordenes_trabajo
        SET estado_orden_id = $1,
            fecha_actualizacion = NOW(),
            usuario_actualizacion = $2
      `;

      const stateParams: any[] = [targetStateId, sessionUserId];

      if (targetStateId === 5 && currentStateId === 1) {
        updateStateSql += `, fecha_inicio_trabajo = NOW()`;
      } else if (targetStateId === 7) {
        updateStateSql += `, fecha_finalizacion = NOW()`;
      } else if (targetStateId === 8) {
        // Persist persona_recibe temporarily into observacion_interna / observacion_entrega
        const obsFormatted = `Persona que recibe: ${persona_recibe.trim()}`;
        updateStateSql += `, observacion_interna = COALESCE(observacion_interna || '\n', '') || $${stateParams.length + 1}`;
        stateParams.push(obsFormatted);
      }

      stateParams.push(ordenId);
      updateStateSql += ` WHERE orden_trabajo_id = $${stateParams.length}`;

      await client.query(updateStateSql, stateParams);

      // Insert State History Record using ONLY existing database columns
      await client.query(`
        INSERT INTO admin.orden_historial_estado (
          orden_historial_estado_id, orden_trabajo_id, estado_anterior_id, estado_nuevo_id, usuario_cambio, comentario, fecha_cambio, activo, fecha_registro
        ) VALUES (
          (SELECT COALESCE(MAX(orden_historial_estado_id), 0) + 1 FROM admin.orden_historial_estado),
          $1, $2, $3, $4, $5, NOW(), true, NOW()
        )
      `, [
        ordenId,
        currentStateId,
        targetStateId,
        sessionUserId,
        targetStateId === 5 && currentStateId === 7
          ? `Devolución a Reparación: ${motivo_devolucion}`
          : targetStateId === 8
            ? `Entrega confirmada a: ${persona_recibe}`
            : `Cambio de estado de la orden de trabajo`
      ]);
    }

    // Process Whitelisted Fields Update per State
    const updates: string[] = [];
    const valParams: any[] = [];

    if (prioridad_orden_id !== undefined) {
      valParams.push(parseInt(prioridad_orden_id, 10));
      updates.push(`prioridad_orden_id = $${valParams.length}`);
    }

    if (fecha_entrega_estimada !== undefined) {
      valParams.push(cleanFecha(fecha_entrega_estimada));
      updates.push(`fecha_entrega_estimada = $${valParams.length}`);
    }

    if (diagnostico_inicial !== undefined) {
      valParams.push(diagnostico_inicial || null);
      updates.push(`diagnostico_inicial = $${valParams.length}`);
    }

    if (observacion_interna !== undefined) {
      valParams.push(observacion_interna || null);
      updates.push(`observacion_interna = $${valParams.length}`);
    }

    if (updates.length > 0) {
      valParams.push(ordenId);
      const sqlUpdateWhitelisted = `
        UPDATE admin.ordenes_trabajo
        SET ${updates.join(", ")}, fecha_actualizacion = NOW()
        WHERE orden_trabajo_id = $${valParams.length}
      `;
      await client.query(sqlUpdateWhitelisted, valParams);
    }

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Orden de trabajo actualizada exitosamente."
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("PUT /api/taller/ordenes/[id] Error:", err);
    return NextResponse.json({ error: "Error al actualizar la orden.", details: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
