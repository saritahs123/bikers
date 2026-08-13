import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

// PUT /api/taller/ordenes/[id]/servicios/[servicioId]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; servicioId: string }> }
) {
  const { id, servicioId: servIdStr } = await params;
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
    const servicioId = parseInt(servIdStr, 10);

    if (isNaN(ordenId) || isNaN(servicioId)) {
      client.release();
      return NextResponse.json({ error: "IDs de orden o servicio no válidos." }, { status: 400 });
    }

    const perms = await getModulePermissions(6, session.rol_principal_id);
    if (!perms.puede_editar) {
      client.release();
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso para modificar servicios." }, { status: 403 });
    }

    const body = await req.json();
    const estado_orden_servicio_id = body.estado_orden_servicio_id ?? body.estado_servicio_id;
    const mecanico_usuario_id = body.mecanico_usuario_id ?? body.usuario_id;
    const rawPrecio = body.precio_acordado ?? body.precio_unitario;
    const precio_acordado = (rawPrecio !== undefined && rawPrecio !== null && rawPrecio !== "" && !isNaN(Number(rawPrecio)))
      ? Number(rawPrecio)
      : undefined;
    const observaciones = body.observaciones ?? body.observacion_tecnica;
    const {
      motivo_reasignacion,
      confirmar_reasignacion,
      motivo_sin_mano_obra,
      confirmar_sin_mano_obra
    } = body;

    await client.query("BEGIN");

    // Lock Order Row Exclusively
    const orderRes = await client.query(`
      SELECT orden_trabajo_id, estado_orden_id
      FROM admin.ordenes_trabajo
      WHERE orden_trabajo_id = $1 AND activo = true
      FOR UPDATE OF ordenes_trabajo
    `, [ordenId]);

    if (orderRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Orden de trabajo no encontrada." }, { status: 404 });
    }

    const estadoOrdenId = orderRes.rows[0].estado_orden_id;
    if (estadoOrdenId === 8) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "READ_ONLY_ORDER", message: "La orden se encuentra ENTREGADA y está en solo lectura." }, { status: 409 });
    }

    // Lock Service Row
    const servRes = await client.query(`
      SELECT orden_servicio_id, tipo_servicio_id, estado_orden_servicio_id, usuario_id, precio_unitario
      FROM admin.orden_servicios
      WHERE orden_servicio_id = $1 AND orden_trabajo_id = $2 AND (activo IS DISTINCT FROM false)
      FOR UPDATE OF orden_servicios
    `, [servicioId, ordenId]);

    if (servRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Servicio no encontrado en esta orden." }, { status: 404 });
    }

    const currentServ = servRes.rows[0];
    const currentServStateId = currentServ.estado_orden_servicio_id;

    // Enforce order state MUST be REPARACIÓN (5) for service actions (cronometer, start, pause, finish)
    if (estadoOrdenId === 1 && (body.accion || body.estado_orden_servicio_id !== undefined || body.estado_servicio_id !== undefined)) {
      await client.query("ROLLBACK");
      return NextResponse.json({
        error: "ORDER_NOT_IN_REPAIR",
        message: "Primero debes iniciar la reparación de la orden."
      }, { status: 409 });
    }

    // Handle INICIAR_CRONOMETRO Action (starts new live open session for service in EN_PROCESO)
    if (body.accion === "INICIAR_CRONOMETRO") {
      try {
        // Enforce max 1 open session
        const openCheck = await client.query(`
          SELECT COUNT(*)::int AS count
          FROM admin.orden_servicio_mano_obra
          WHERE orden_servicio_id = $1 AND fecha_finalizacion IS NULL AND (activo IS DISTINCT FROM false)
        `, [servicioId]);

        if (openCheck.rows[0]?.count > 0) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            error: "OPEN_SESSION_EXISTS",
            message: "Ya existe una sesión de cronómetro abierta para este servicio."
          }, { status: 409 });
        }

        let rate = 0.00;
        const tsRateRes = await client.query(`
          SELECT precio_base, duracion_estimada_horas
          FROM admin.tipo_servicio
          WHERE tipo_servicio_id = $1
        `, [currentServ.tipo_servicio_id]);

        if (tsRateRes.rows.length > 0) {
          const pb = parseFloat(tsRateRes.rows[0].precio_base || 0);
          const dur = parseFloat(tsRateRes.rows[0].duracion_estimada_horas || 1);
          rate = dur > 0 ? Math.round((pb / dur) * 100) / 100 : pb;
        }

        await client.query(`
          INSERT INTO admin.orden_servicio_mano_obra (
            orden_servicio_mano_obra_id,
            orden_servicio_id,
            usuario_id,
            fecha_inicio,
            fecha_finalizacion,
            minutos_trabajados,
            minutos_facturables,
            costo_hora,
            costo_total,
            activo,
            fecha_registro,
            usuario_registro
          ) VALUES (
            (SELECT COALESCE(MAX(orden_servicio_mano_obra_id), 0) + 1 FROM admin.orden_servicio_mano_obra),
            $1, $2, NOW(), NULL, 0, 0, $3, 0.00, true, NOW(), $4
          )
        `, [servicioId, currentServ.usuario_id || sessionUserId, rate, sessionUserId]);

        await client.query(`
          INSERT INTO admin.orden_historial_estado (
            orden_historial_estado_id, orden_trabajo_id, estado_anterior_id, estado_nuevo_id, usuario_cambio, comentario, fecha_cambio, activo, fecha_registro
          ) VALUES (
            (SELECT COALESCE(MAX(orden_historial_estado_id), 0) + 1 FROM admin.orden_historial_estado),
            $1, $2, $2, $3, $4, NOW(), true, NOW()
          )
        `, [
          ordenId,
          estadoOrdenId,
          sessionUserId,
          `Cronómetro iniciado en servicio #${servicioId}`
        ]);

        await client.query("COMMIT");
        return NextResponse.json({
          success: true,
          message: "Cronómetro iniciado correctamente."
        });
      } catch (err: any) {
        await client.query("ROLLBACK");
        console.error("INICIAR_CRONOMETRO Error:", err);
        return NextResponse.json({ error: "INICIAR_CRONOMETRO_FAILED", message: err.message || "Error al iniciar cronómetro." }, { status: 500 });
      }
    }

    // Handle DETENER_CRONOMETRO Action (closes open session, keeps EN_PROCESO state 2)
    if (body.accion === "DETENER_CRONOMETRO" || body.accion === "PAUSAR_CRONOMETRO_SOLO") {
      try {
        await client.query(`
          UPDATE admin.orden_servicio_mano_obra
          SET 
            fecha_finalizacion = NOW(),
            minutos_trabajados = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - fecha_inicio))/60)),
            minutos_facturables = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - fecha_inicio))/60)),
            costo_total = ROUND((GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - fecha_inicio))/60))/60.0) * costo_hora, 2),
            usuario_actualizacion = $2
          WHERE orden_servicio_id = $1 AND fecha_finalizacion IS NULL AND (activo IS DISTINCT FROM false)
        `, [servicioId, sessionUserId]);

        await client.query(`
          INSERT INTO admin.orden_historial_estado (
            orden_historial_estado_id, orden_trabajo_id, estado_anterior_id, estado_nuevo_id, usuario_cambio, comentario, fecha_cambio, activo, fecha_registro
          ) VALUES (
            (SELECT COALESCE(MAX(orden_historial_estado_id), 0) + 1 FROM admin.orden_historial_estado),
            $1, $2, $3, $4, $5, NOW(), true, NOW()
          )
        `, [
          ordenId,
          estadoOrdenId,
          estadoOrdenId,
          sessionUserId,
          `Cronómetro detenido en servicio #${servicioId}`
        ]);

        await client.query("COMMIT");
        return NextResponse.json({
          success: true,
          message: "Cronómetro detenido correctamente. El servicio permanece En Proceso."
        });
      } catch (err: any) {
        await client.query("ROLLBACK");
        console.error("DETENER_CRONOMETRO Error:", err);
        return NextResponse.json({ error: "DETENER_CRONOMETRO_FAILED", message: err.message || "Error al detener cronómetro." }, { status: 500 });
      }
    }

    // Handle Mechanic Reassignment
    const hasMecProp = body.mecanico_usuario_id !== undefined || body.usuario_id !== undefined;
    const rawMecVal = body.mecanico_usuario_id ?? body.usuario_id;
    const newMecId = (rawMecVal !== null && rawMecVal !== "" && rawMecVal !== undefined && !isNaN(parseInt(rawMecVal, 10)))
      ? parseInt(rawMecVal, 10)
      : null;
    const currentMecId = (currentServ.usuario_id !== null && currentServ.usuario_id !== undefined && !isNaN(Number(currentServ.usuario_id)))
      ? Number(currentServ.usuario_id)
      : null;

    if (hasMecProp && newMecId !== currentMecId) {
      // Verify open sessions before reassigning
      const openSessCheck = await client.query(`
        SELECT COUNT(*)::int AS count
        FROM admin.orden_servicio_mano_obra
        WHERE orden_servicio_id = $1 AND fecha_finalizacion IS NULL AND (activo IS DISTINCT FROM false)
      `, [servicioId]);

      if (openSessCheck.rows[0]?.count > 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          error: "OPEN_SESSION_EXISTS",
          message: "No se puede reasignar el mecánico mientras exista una sesión de trabajo abierta. Pause la sesión primero."
        }, { status: 409 });
      }

      const isInitialAssignment = !currentMecId || currentMecId === 0;
      const isUnassigning = newMecId === null;
      if (estadoOrdenId === 5 && !isInitialAssignment && !isUnassigning && (!confirmar_reasignacion || !motivo_reasignacion || !motivo_reasignacion.trim())) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          error: "REASSIGNMENT_CONFIRMATION_REQUIRED",
          message: "Para reasignar el mecánico en una orden en Reparación, se requiere confirmación explícita y motivo obligatorio."
        }, { status: 400 });
      }

      await client.query(`
        UPDATE admin.orden_servicios
        SET usuario_id = $1, usuario_actualizacion = $2
        WHERE orden_servicio_id = $3
      `, [newMecId, sessionUserId, servicioId]);

      // History record
      await client.query(`
        INSERT INTO admin.orden_historial_estado (
          orden_historial_estado_id, orden_trabajo_id, estado_anterior_id, estado_nuevo_id, usuario_cambio, comentario, fecha_cambio, activo, fecha_registro
        ) VALUES (
          (SELECT COALESCE(MAX(orden_historial_estado_id), 0) + 1 FROM admin.orden_historial_estado),
          $1, $2, $2, $3, $4, NOW(), true, NOW()
        )
      `, [
        ordenId,
        estadoOrdenId,
        sessionUserId,
        `Asignación de mecánico en servicio #${servicioId}: ${motivo_reasignacion || (newMecId ? 'Asignado' : 'Desasignado')}`
      ]);
    }

    // Handle Service State Transitions
    if (estado_orden_servicio_id !== undefined && parseInt(estado_orden_servicio_id, 10) !== currentServStateId) {
      const targetServStateId = parseInt(estado_orden_servicio_id, 10);

      const isReopenAction = currentServStateId === 3 && targetServStateId === 2;

      // Allowed transitions map
      const ALLOWED_SERV_TRANSITIONS: Record<number, number[]> = {
        1: [2],    // PENDIENTE -> EN_PROCESO
        2: [5, 3], // EN_PROCESO -> PAUSADO o COMPLETADO
        5: [2],    // PAUSADO -> EN_PROCESO
        3: []      // COMPLETADO: ninguna transición ordinaria
      };

      if (!isReopenAction && !ALLOWED_SERV_TRANSITIONS[currentServStateId]?.includes(targetServStateId)) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          error: "INVALID_SERVICE_TRANSITION",
          message: `Transición de estado de servicio no permitida: del estado ${currentServStateId} al estado ${targetServStateId}.`
        }, { status: 409 });
      }

      // Check mechanic required for starting PENDIENTE service (1 -> 2)
      if (currentServStateId === 1 && targetServStateId === 2) {
        const mecId = currentServ.usuario_id || mecanico_usuario_id;
        if (!mecId) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            error: "MECHANIC_REQUIRED",
            message: "Asigna un mecánico antes de iniciar el servicio."
          }, { status: 422 });
        }
      }

      // Check IAM permission & motivo for reopening completed service (3 -> 2)
      if (currentServStateId === 3 && targetServStateId === 2) {
        const canReopen =
          session.rol_principal_id === 1 ||
          perms.puede_reabrir === true;
        if (!canReopen) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permiso para realizar esta acción." }, { status: 403 });
        }
        const motivoReapertura = body.motivo || body.motivo_reapertura || body.motivo_devolucion;
        if (!motivoReapertura || !motivoReapertura.trim()) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            error: "REOPEN_REASON_REQUIRED",
            message: "Para reabrir un servicio completado se requiere indicar el motivo obligatoriamente."
          }, { status: 400 });
        }
      }

      // Action 1: Iniciar o Reanudar (1 -> 2 o 5 -> 2)
      if (targetServStateId === 2) {
        // Enforce max 1 open session
        const openCheck = await client.query(`
          SELECT COUNT(*)::int AS count
          FROM admin.orden_servicio_mano_obra
          WHERE orden_servicio_id = $1 AND fecha_finalizacion IS NULL AND (activo IS DISTINCT FROM false)
        `, [servicioId]);

        if (openCheck.rows[0]?.count > 0) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            error: "OPEN_SESSION_EXISTS",
            code: "OPEN_SESSION_EXISTS",
            message: "Ya existe una sesión de trabajo abierta para este servicio."
          }, { status: 409 });
        }

        // Get mechanic rate from catalog (or default 0.00 DOP)
        let rate = 0.00;
        const tsRateRes = await client.query(`
          SELECT precio_base, duracion_estimada_horas
          FROM admin.tipo_servicio
          WHERE tipo_servicio_id = $1
        `, [currentServ.tipo_servicio_id]);

        if (tsRateRes.rows.length > 0) {
          const pb = parseFloat(tsRateRes.rows[0].precio_base || 0);
          const dur = parseFloat(tsRateRes.rows[0].duracion_estimada_horas || 1);
          rate = dur > 0 ? Math.round((pb / dur) * 100) / 100 : pb;
        }

        // Insert new open time tracking session safely
        try {
          await client.query(`
            INSERT INTO admin.orden_servicio_mano_obra (
              orden_servicio_mano_obra_id,
              orden_servicio_id,
              usuario_id,
              fecha_inicio,
              fecha_finalizacion,
              minutos_trabajados,
              minutos_facturables,
              costo_hora,
              costo_total,
              activo,
              fecha_registro,
              usuario_registro
            ) VALUES (
              (SELECT COALESCE(MAX(orden_servicio_mano_obra_id), 0) + 1 FROM admin.orden_servicio_mano_obra),
              $1, $2, NOW(), NULL, 0, 0, $3, 0.00, true, NOW(), $4
            )
          `, [servicioId, currentServ.usuario_id || sessionUserId, rate, sessionUserId]);
        } catch (dbErr: any) {
          if (dbErr.code === '23505') {
            await client.query("ROLLBACK");
            return NextResponse.json({
              error: "OPEN_SESSION_EXISTS",
              code: "OPEN_SESSION_EXISTS",
              message: "Ya existe una sesión de trabajo abierta para este servicio."
            }, { status: 409 });
          }
          throw dbErr;
        }
      }

      // Action 2: Pausar (2 -> 5)
      if (currentServStateId === 2 && targetServStateId === 5) {
        // Close current open session and compute elapsed minutes
        await client.query(`
          UPDATE admin.orden_servicio_mano_obra
          SET 
            fecha_finalizacion = NOW(),
            minutos_trabajados = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - fecha_inicio))/60)),
            minutos_facturables = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - fecha_inicio))/60)),
            costo_total = ROUND((GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - fecha_inicio))/60))/60.0) * costo_hora, 2),
            usuario_actualizacion = $2
          WHERE orden_servicio_id = $1 AND fecha_finalizacion IS NULL AND (activo IS DISTINCT FROM false)
        `, [servicioId, sessionUserId]);
      }

      // Action 3: Completar (2 -> 3)
      if (targetServStateId === 3) {
        // Enforce order state MUST be REPARACIÓN (5)
        if (estadoOrdenId !== 5) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            error: "ORDER_NOT_IN_REPAIR",
            message: "No se pueden completar servicios cuando la orden se encuentra en estado RECIBIDA, LISTA PARA ENTREGA o ENTREGADA. La orden debe estar en REPARACIÓN."
          }, { status: 409 });
        }

        // Enforce 0 open sessions for this service
        const openCheck = await client.query(`
          SELECT COUNT(*)::int AS count
          FROM admin.orden_servicio_mano_obra
          WHERE orden_servicio_id = $1 AND fecha_finalizacion IS NULL AND (activo IS DISTINCT FROM false)
        `, [servicioId]);

        if (openCheck.rows[0]?.count > 0) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            error: "OPEN_SESSION_EXISTS",
            message: "Debes pausar o cerrar la sesión de trabajo antes de finalizar el servicio."
          }, { status: 409 });
        }

        // Check if labor exists
        const laborCountRes = await client.query(`
          SELECT COUNT(*)::int AS count
          FROM admin.orden_servicio_mano_obra
          WHERE orden_servicio_id = $1 AND (activo IS DISTINCT FROM false)
        `, [servicioId]);

        if (laborCountRes.rows[0]?.count === 0) {
          if (!confirmar_sin_mano_obra || !motivo_sin_mano_obra || !motivo_sin_mano_obra.trim()) {
            await client.query("ROLLBACK");
            return NextResponse.json({
              error: "NO_LABOR_CONFIRMATION_REQUIRED",
              message: "Para completar un servicio sin mano de obra o tiempo registrado, se requiere confirmación explícita y motivo obligatorio."
            }, { status: 400 });
          }

          // Save reason in observacion_tecnica
          await client.query(`
            UPDATE admin.orden_servicios
            SET observacion_tecnica = $1
            WHERE orden_servicio_id = $2
          `, [`Completado sin mano de obra: ${motivo_sin_mano_obra}`, servicioId]);
        }
      }

      // Update Service State
      await client.query(`
        UPDATE admin.orden_servicios
        SET estado_orden_servicio_id = $1, usuario_actualizacion = $2
        WHERE orden_servicio_id = $3
      `, [targetServStateId, sessionUserId, servicioId]);

      // History record
      await client.query(`
        INSERT INTO admin.orden_historial_estado (
          orden_historial_estado_id, orden_trabajo_id, estado_anterior_id, estado_nuevo_id, usuario_cambio, comentario, fecha_cambio, activo, fecha_registro
        ) VALUES (
          (SELECT COALESCE(MAX(orden_historial_estado_id), 0) + 1 FROM admin.orden_historial_estado),
          $1, $2, $2, $3, $4, NOW(), true, NOW()
        )
      `, [
        ordenId,
        estadoOrdenId,
        sessionUserId,
        `Estado de servicio #${servicioId} cambiado de ${currentServStateId} a ${targetServStateId}`
      ]);

      // If completing a service, check if ALL active services are now completed and validate 6 conditions for 5 -> 7 transition
      if (targetServStateId === 3 && estadoOrdenId === 5) {
        const allServsRes = await client.query(`
          SELECT orden_servicio_id, estado_orden_servicio_id, mecanico_usuario_id, usuario_id, cantidad, precio_unitario
          FROM admin.orden_servicios
          WHERE orden_trabajo_id = $1 AND (activo IS DISTINCT FROM false)
        `, [ordenId]);

        const allActiveServices = allServsRes.rows;

        const openSessionsRes = await client.query(`
          SELECT COUNT(*)::int AS count
          FROM admin.orden_servicio_mano_obra osmo
          JOIN admin.orden_servicios os ON osmo.orden_servicio_id = os.orden_servicio_id
          WHERE os.orden_trabajo_id = $1 AND osmo.fecha_finalizacion IS NULL AND (osmo.activo IS DISTINCT FROM false)
        `, [ordenId]);

        const totalOpenSessions = openSessionsRes.rows[0]?.count || 0;
        const hasAtLeastOneService = allActiveServices.length > 0;
        const allCompleted = hasAtLeastOneService && allActiveServices.every(s => Number(s.estado_orden_servicio_id) === 3);
        const allHaveMechanic = allActiveServices.every(s => Boolean(s.mecanico_usuario_id || s.usuario_id));
        const allQuantitiesAndPricesValid = allActiveServices.every(s => Number(s.cantidad || 0) > 0 && Number(s.precio_unitario || 0) >= 0);

        if (allCompleted && totalOpenSessions === 0 && allHaveMechanic && allQuantitiesAndPricesValid) {
          // Auto-advance Order from REPARACIÓN (5) to LISTA_ENTREGA (7)
          await client.query(`
            UPDATE admin.ordenes_trabajo
            SET 
              estado_orden_id = 7,
              fecha_finalizacion = NOW(),
              usuario_actualizacion = $2,
              fecha_actualizacion = NOW()
            WHERE orden_trabajo_id = $1
          `, [ordenId, sessionUserId]);

          await client.query(`
            INSERT INTO admin.orden_historial_estado (
              orden_historial_estado_id, orden_trabajo_id, estado_anterior_id, estado_nuevo_id, usuario_cambio, comentario, fecha_cambio, activo, fecha_registro
            ) VALUES (
              (SELECT COALESCE(MAX(orden_historial_estado_id), 0) + 1 FROM admin.orden_historial_estado),
              $1, 5, 7, $2, 'Orden finalizada automáticamente al completar todos sus servicios (Pasó a Lista para Entrega)', NOW(), true, NOW()
            )
          `, [ordenId, sessionUserId]);
        }
      }
    }

    // Handle Price and Observations Update
    if (precio_acordado !== undefined || observaciones !== undefined) {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIdx = 1;

      if (precio_acordado !== undefined) {
        updates.push(`precio_unitario = $${paramIdx}`);
        values.push(precio_acordado);
        paramIdx++;
        updates.push(`subtotal = ROUND((COALESCE(cantidad, 1) * $${paramIdx - 1}) - COALESCE(valor_descuento, 0), 2)`);
      }

      if (observaciones !== undefined) {
        updates.push(`observacion_tecnica = $${paramIdx}`);
        values.push(observaciones);
        paramIdx++;
      }

      updates.push(`usuario_actualizacion = $${paramIdx}`);
      values.push(sessionUserId);
      paramIdx++;

      values.push(servicioId);
      const updateSql = `
        UPDATE admin.orden_servicios
        SET ${updates.join(", ")}
        WHERE orden_servicio_id = $${paramIdx}
      `;
      await client.query(updateSql, values);

      // Recalculate order subtotal_servicios & total_orden
      await client.query(`
        UPDATE admin.ordenes_trabajo
        SET 
          subtotal_servicios = (
            SELECT COALESCE(SUM(subtotal), 0)
            FROM admin.orden_servicios
            WHERE orden_trabajo_id = $1 AND (activo IS DISTINCT FROM false)
          ),
          subtotal_general = (
            SELECT COALESCE(SUM(subtotal), 0)
            FROM admin.orden_servicios
            WHERE orden_trabajo_id = $1 AND (activo IS DISTINCT FROM false)
          ) + COALESCE(subtotal_productos, 0),
          total_orden = (
            SELECT COALESCE(SUM(subtotal), 0)
            FROM admin.orden_servicios
            WHERE orden_trabajo_id = $1 AND (activo IS DISTINCT FROM false)
          ) + COALESCE(subtotal_productos, 0) + COALESCE(impuesto, 0)
        WHERE orden_trabajo_id = $1
      `, [ordenId]);
    }

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Servicio actualizado exitosamente."
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("PUT /api/taller/ordenes/[id]/servicios/[servicioId] Error:", err);
    return NextResponse.json({ error: "Error al actualizar servicio.", details: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE /api/taller/ordenes/[id]/servicios/[servicioId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; servicioId: string }> }
) {
  const { id, servicioId: servIdStr } = await params;
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
    const servicioId = parseInt(servIdStr, 10);

    if (isNaN(ordenId) || isNaN(servicioId)) {
      client.release();
      return NextResponse.json({ error: "IDs de orden o servicio no válidos." }, { status: 400 });
    }

    const perms = await getModulePermissions(6, session.rol_principal_id);
    if (!perms.puede_eliminar) {
      client.release();
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso para eliminar servicios." }, { status: 403 });
    }

    await client.query("BEGIN");

    // Lock Order
    const orderRes = await client.query(`
      SELECT orden_trabajo_id, estado_orden_id
      FROM admin.ordenes_trabajo
      WHERE orden_trabajo_id = $1 AND activo = true
      FOR UPDATE OF ordenes_trabajo
    `, [ordenId]);

    if (orderRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Orden de trabajo no encontrada." }, { status: 404 });
    }

    const estadoOrdenId = orderRes.rows[0].estado_orden_id;
    if (estadoOrdenId === 8) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "READ_ONLY_ORDER", message: "La orden se encuentra ENTREGADA y está en solo lectura." }, { status: 409 });
    }

    // Check service state and registered work before blocking
    const servRes = await client.query(`
      SELECT orden_servicio_id, estado_orden_servicio_id
      FROM admin.orden_servicios
      WHERE orden_servicio_id = $1 AND orden_trabajo_id = $2 AND (activo IS DISTINCT FROM false)
      FOR UPDATE OF orden_servicios
    `, [servicioId, ordenId]);

    if (servRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Servicio no encontrado." }, { status: 404 });
    }

    const servState = servRes.rows[0].estado_orden_servicio_id;
    if (servState !== 1) { // Not PENDIENTE
      await client.query("ROLLBACK");
      return NextResponse.json({
        error: "SERVICE_IN_PROGRESS",
        message: "No se puede eliminar un servicio que ya ha sido iniciado, pausado o completado."
      }, { status: 409 });
    }

    // Check time tracking rows
    const laborRes = await client.query(`
      SELECT COUNT(*)::int AS count FROM admin.orden_servicio_mano_obra WHERE orden_servicio_id = $1 AND (activo IS DISTINCT FROM false)
    `, [servicioId]);

    if (laborRes.rows[0]?.count > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({
        error: "WORK_REGISTERED",
        message: "No se puede eliminar el servicio porque tiene sesiones de trabajo registradas."
      }, { status: 409 });
    }

    // Check products
    const prodRes = await client.query(`
      SELECT COUNT(*)::int AS count FROM admin.orden_productos WHERE orden_servicio_id = $1
    `, [servicioId]);

    if (prodRes.rows[0]?.count > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({
        error: "PRODUCTS_REGISTERED",
        message: "No se puede eliminar el servicio porque tiene repuestos asociados."
      }, { status: 409 });
    }

    // Safe deletion / soft deactivation
    await client.query(`
      UPDATE admin.orden_servicios SET activo = false WHERE orden_servicio_id = $1
    `, [servicioId]);

    // Recalculate Order Financial Totals
    await client.query(`
      UPDATE admin.ordenes_trabajo ot
      SET 
        subtotal_servicios = COALESCE((SELECT SUM(subtotal) FROM admin.orden_servicios WHERE orden_trabajo_id = $1 AND (activo IS DISTINCT FROM false)), 0),
        subtotal_productos = COALESCE((SELECT SUM(subtotal) FROM admin.orden_productos WHERE orden_trabajo_id = $1), 0),
        descuento_servicios = COALESCE((SELECT SUM(valor_descuento) FROM admin.orden_servicios WHERE orden_trabajo_id = $1 AND (activo IS DISTINCT FROM false)), 0),
        descuento_productos = COALESCE((SELECT SUM(valor_descuento) FROM admin.orden_productos WHERE orden_trabajo_id = $1), 0),
        subtotal_general = COALESCE((SELECT SUM(subtotal) FROM admin.orden_servicios WHERE orden_trabajo_id = $1 AND (activo IS DISTINCT FROM false)), 0) + 
                           COALESCE((SELECT SUM(subtotal) FROM admin.orden_productos WHERE orden_trabajo_id = $1), 0),
        total_orden = GREATEST(0, ROUND(
          (COALESCE((SELECT SUM(subtotal) FROM admin.orden_servicios WHERE orden_trabajo_id = $1 AND (activo IS DISTINCT FROM false)), 0) + 
           COALESCE((SELECT SUM(subtotal) FROM admin.orden_productos WHERE orden_trabajo_id = $1), 0)) + COALESCE(ot.impuesto, 0), 2
        )),
        fecha_actualizacion = NOW(),
        usuario_actualizacion = $2
      WHERE ot.orden_trabajo_id = $1
    `, [ordenId, sessionUserId]);

    // History record
    await client.query(`
      INSERT INTO admin.orden_historial_estado (
        orden_historial_estado_id, orden_trabajo_id, estado_anterior_id, estado_nuevo_id, usuario_cambio, comentario, fecha_cambio, activo, fecha_registro
      ) VALUES (
        (SELECT COALESCE(MAX(orden_historial_estado_id), 0) + 1 FROM admin.orden_historial_estado),
        $1, $2, $2, $3, $4, NOW(), true, NOW()
      )
    `, [
      ordenId,
      estadoOrdenId,
      sessionUserId,
      `Servicio #${servicioId} eliminado de la orden`
    ]);

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Servicio eliminado exitosamente."
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("DELETE /api/taller/ordenes/[id]/servicios/[servicioId] Error:", err);
    return NextResponse.json({ error: "Error al eliminar servicio.", details: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
