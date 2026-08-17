import { NextRequest, NextResponse } from "next/server";
import { getPool, query } from "@/lib/db";
import { recalculateWorkOrderTotals } from "@/lib/workshop/recalculateWorkOrderTotals";
import { getCronometroStatus } from "@/lib/workshop/getCronometroStatus";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

// GET /api/taller/ordenes/[id]/servicios/[servicioId]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; servicioId: string }> }
) {
  const { id, servicioId } = await params;

  if (!id || !servicioId || !/^\d+$/.test(id.trim()) || !/^\d+$/.test(servicioId.trim())) {
    return NextResponse.json({ error: "INVALID_ID", message: "IDs de orden o servicio no válidos." }, { status: 400 });
  }
  const ordenId = Number(id.trim());
  const servId = Number(servicioId.trim());

  try {
    const session = await getWorkshopSession();
    if (!session || !session.usuario_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión inválida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permiso para consultar este servicio." }, { status: 403 });
    }

    // Query main service info
    const servSql = `
      SELECT 
        os.orden_servicio_id AS servicio_id,
        os.orden_trabajo_id,
        os.tipo_servicio_id,
        ts.nombre AS tipo_servicio_nombre,
        ts.descripcion AS tipo_servicio_descripcion,
        os.estado_orden_servicio_id AS estado_servicio_id,
        eos.nombre AS estado_servicio_nombre,
        eos.codigo AS estado_servicio_codigo,
        os.cantidad,
        os.precio_unitario,
        os.porcentaje_descuento,
        os.valor_descuento,
        COALESCE(NULLIF(os.subtotal, 0), ROUND((os.cantidad * os.precio_unitario) - COALESCE(os.valor_descuento, 0), 2)) AS subtotal,
        os.observacion_tecnica AS motivo_sin_mano_obra,
        os.observacion_tecnica,
        os.usuario_id AS mecanico_usuario_id,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), ui.correo_electronico, ('Mecánico #' || u.usuario_id::text)) AS mecanico_nombre
      FROM admin.orden_servicios os
      LEFT JOIN admin.tipo_servicio ts ON os.tipo_servicio_id = ts.tipo_servicio_id
      LEFT JOIN admin.estado_orden_servicio eos ON os.estado_orden_servicio_id = eos.estado_orden_servicio_id
      LEFT JOIN admin.usuario u ON os.usuario_id = u.usuario_id
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      WHERE os.orden_servicio_id = $1 AND os.orden_trabajo_id = $2 AND (os.activo IS DISTINCT FROM false)
    `;
    const servRes = await query<any>(servSql, [servId, ordenId]);

    if (!servRes || servRes.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Servicio no encontrado." }, { status: 404 });
    }

    const service = servRes[0];

    // Query labor entries
    const laborSql = `
      SELECT 
        mo.orden_servicio_mano_obra_id AS mano_obra_id,
        mo.orden_servicio_mano_obra_id AS id,
        mo.orden_servicio_id,
        mo.usuario_id AS mecanico_usuario_id,
        mo.usuario_id,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), ui.correo_electronico, u.usuario_id::text) AS mecanico_nombre,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), ui.correo_electronico, u.usuario_id::text) AS usuario_nombre,
        mo.fecha_inicio,
        mo.fecha_finalizacion,
        mo.minutos_trabajados,
        ROUND(mo.minutos_trabajados / 60.0, 2) AS horas_trabajadas,
        ROUND(mo.minutos_trabajados / 60.0, 2) AS horas_reales,
        mo.costo_hora,
        mo.costo_total AS subtotal,
        COALESCE(mo.detalle_mano_obra, mo.observacion) AS detalle_mano_obra,
        mo.observacion AS descripcion,
        mo.observacion AS observaciones,
        (mo.fecha_finalizacion IS NULL) AS es_abierta
      FROM admin.orden_servicio_mano_obra mo
      LEFT JOIN admin.usuario u ON mo.usuario_id = u.usuario_id
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      WHERE mo.orden_servicio_id = $1 
        AND (mo.activo IS DISTINCT FROM false)
        AND mo.detalle_mano_obra IS NOT NULL
        AND BTRIM(mo.detalle_mano_obra) <> ''
      ORDER BY mo.orden_servicio_mano_obra_id ASC
    `;
    const manoObra = await query<any>(laborSql, [servId]);

    // Query product entries
    const prodSql = `
      SELECT 
        op.orden_producto_id,
        op.orden_producto_id AS id,
        op.orden_trabajo_id,
        op.orden_servicio_id,
        op.producto_id,
        COALESCE(p.nombre, 'Producto #' || op.producto_id::text) AS producto_nombre,
        COALESCE(p.nombre, 'Producto #' || op.producto_id::text) AS nombre,
        p.codigo_producto,
        p.descripcion AS producto_descripcion,
        op.cantidad,
        op.precio_unitario,
        op.porcentaje_descuento,
        op.valor_descuento,
        op.subtotal,
        op.observacion
      FROM admin.orden_productos op
      LEFT JOIN admin.productos p ON op.producto_id = p.producto_id
      WHERE op.orden_servicio_id = $1
      ORDER BY op.orden_producto_id ASC
    `;
    const productos = await query<any>(prodSql, [servId]);

    const pool = getPool();
    const cronStatus = await getCronometroStatus(pool, servId);

    return NextResponse.json({
      success: true,
      data: {
        ...service,
        en_proceso_cronometro: cronStatus.activo,
        cronometro: cronStatus,
        mano_obra: manoObra || [],
        productos: productos || []
      }
    });
  } catch (error: any) {
    console.error("GET /api/taller/ordenes/[id]/servicios/[servicioId] failed:", error);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Error al consultar servicio." }, { status: 500 });
  }
}

// PUT /api/taller/ordenes/[id]/servicios/[servicioId]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; servicioId: string }> }
) {
  const { id, servicioId } = await params;

  if (!id || !servicioId || !/^\d+$/.test(id.trim()) || !/^\d+$/.test(servicioId.trim())) {
    return NextResponse.json({ error: "INVALID_ID", message: "IDs de orden o servicio no válidos." }, { status: 400 });
  }
  const ordenId = Number(id.trim());
  const servId = Number(servicioId.trim());

  const session = await getWorkshopSession();
  if (!session || !session.usuario_id) {
    return NextResponse.json({ error: "NO_SESSION", message: "Sesión no válida o expirada." }, { status: 401 });
  }
  const sessionUserId = session.usuario_id;

  const perms = await getModulePermissions("TALLER", session.usuario_id);
  if (!perms.puede_editar) {
    return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso para modificar servicios." }, { status: 403 });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
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
    `, [servId, ordenId]);

    if (servRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Servicio no encontrado en esta orden." }, { status: 404 });
    }

    const currentServ = servRes.rows[0];
    const currentServStateId = currentServ.estado_orden_servicio_id;

    // Map functional actions or explicit state ID to target state
    let targetServStateId: number | undefined = estado_orden_servicio_id !== undefined ? parseInt(estado_orden_servicio_id, 10) : undefined;
    
    if (body.accion === "INICIAR_SERVICIO") {
      targetServStateId = 2; // EN_PROCESO
    } else if (body.accion === "PAUSAR_SERVICIO") {
      targetServStateId = 5; // SUSPENDIDO
    } else if (body.accion === "REANUDAR_SERVICIO") {
      targetServStateId = 2; // EN_PROCESO
    } else if (body.accion === "FINALIZAR_SERVICIO") {
      // Resolver dinámicamente el estado COMPLETADO desde catálogo
      const compRes = await client.query(`
        SELECT estado_orden_servicio_id
        FROM admin.estado_orden_servicio
        WHERE UPPER(codigo) = 'COMPLETADO' AND (activo IS DISTINCT FROM false)
        LIMIT 1
      `);
      targetServStateId = compRes.rows[0]?.estado_orden_servicio_id || 3;
    }

    // Enforce order state MUST be REPARACIÓN (5) for service actions (start, pause, resume, finish)
    if (estadoOrdenId === 1 && (body.accion || targetServStateId !== undefined)) {
      await client.query("ROLLBACK");
      return NextResponse.json({
        error: "ORDER_NOT_IN_REPAIR",
        message: "Primero debes iniciar la reparación de la orden."
      }, { status: 409 });
    }

    // Handle Mechanic Reassignment
    const hasMecProp = mecanico_usuario_id !== undefined || body.mecanico_usuario_id !== undefined || body.usuario_id !== undefined;
    const newMecId = (mecanico_usuario_id !== null && mecanico_usuario_id !== "" && mecanico_usuario_id !== undefined && !isNaN(parseInt(mecanico_usuario_id, 10)))
      ? parseInt(mecanico_usuario_id, 10)
      : null;
    const currentMecId = (currentServ.usuario_id !== null && currentServ.usuario_id !== undefined && !isNaN(Number(currentServ.usuario_id)))
      ? Number(currentServ.usuario_id)
      : null;

    if (hasMecProp && newMecId !== currentMecId) {
      // Verify open technical sessions before reassigning
      const openSessCheck = await client.query(`
        SELECT COUNT(*)::int AS count
        FROM admin.orden_servicio_mano_obra
        WHERE orden_servicio_id = $1
          AND (detalle_mano_obra IS NULL OR BTRIM(detalle_mano_obra) = '')
          AND (observacion IS NULL OR BTRIM(observacion) = '')
          AND fecha_inicio IS NOT NULL
          AND fecha_finalizacion IS NULL
          AND (activo IS DISTINCT FROM false)
      `, [servId]);

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
      `, [newMecId, sessionUserId, servId]);

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
        `Asignación de mecánico en servicio #${servId}: ${motivo_reasignacion || (newMecId ? 'Asignado' : 'Desasignado')}`
      ]);
    }

    // Handle Service State Transitions
    if (targetServStateId !== undefined && targetServStateId !== currentServStateId) {
      const isReopenAction = currentServStateId === 3 && targetServStateId === 2;

      // Allowed transitions map
      const ALLOWED_SERV_TRANSITIONS: Record<number, number[]> = {
        1: [2],    // PENDIENTE -> EN_PROCESO
        2: [5, 3], // EN_PROCESO -> PAUSADO o COMPLETADO
        5: [2, 3], // PAUSADO -> EN_PROCESO o COMPLETADO
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

      // Action 1: Iniciar o Reanudar (1 -> 2 o 5 -> 2)
      if (targetServStateId === 2) {
        const openSessionsRes = await client.query(`
          SELECT orden_servicio_mano_obra_id, fecha_inicio, costo_hora
          FROM admin.orden_servicio_mano_obra
          WHERE orden_servicio_id = $1
            AND (detalle_mano_obra IS NULL OR BTRIM(detalle_mano_obra) = '')
            AND (observacion IS NULL OR BTRIM(observacion) = '')
            AND fecha_inicio IS NOT NULL
            AND fecha_finalizacion IS NULL
            AND (activo IS DISTINCT FROM false)
          ORDER BY orden_servicio_mano_obra_id DESC
          FOR UPDATE
        `, [servId]);

        const openCount = openSessionsRes.rows.length;

        if (openCount > 1) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            error: "MULTIPLE_OPEN_TIMER_SESSIONS",
            code: "MULTIPLE_OPEN_TIMER_SESSIONS",
            message: "Se encontraron múltiples sesiones de trabajo abiertas de forma inconsistente."
          }, { status: 409 });
        }

        if (openCount === 1) {
          const openSess = openSessionsRes.rows[0];

          if (currentServStateId === 5) {
            // Reconcile orphaned session if service is in state PAUSADO (5)
            const histPauseRes = await client.query(`
              SELECT COALESCE(fecha_cambio, fecha_registro) AS fecha_pausa
              FROM admin.orden_historial_estado
              WHERE orden_trabajo_id = $1
                AND (comentario LIKE '%cambiado de 2 a 5%' OR comentario LIKE '%Pausado%' OR comentario LIKE '%pausado%')
              ORDER BY orden_historial_estado_id DESC
              LIMIT 1
            `, [ordenId]);

            let fechaPausa = histPauseRes.rows[0]?.fecha_pausa ? new Date(histPauseRes.rows[0].fecha_pausa) : null;
            const fechaInicio = new Date(openSess.fecha_inicio);

            if (!fechaPausa || isNaN(fechaPausa.getTime()) || fechaPausa.getTime() <= fechaInicio.getTime()) {
              fechaPausa = new Date();
            }

            await client.query(`
              UPDATE admin.orden_servicio_mano_obra
              SET 
                fecha_finalizacion = $1,
                minutos_trabajados = ROUND(EXTRACT(EPOCH FROM ($1 - fecha_inicio))/60.0),
                minutos_facturables = ROUND(EXTRACT(EPOCH FROM ($1 - fecha_inicio))/60.0),
                costo_total = ROUND((EXTRACT(EPOCH FROM ($1 - fecha_inicio))/3600.0) * costo_hora, 2),
                usuario_actualizacion = $2
              WHERE orden_servicio_mano_obra_id = $3
            `, [fechaPausa, sessionUserId, openSess.orden_servicio_mano_obra_id]);

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
              `Sesión técnica reconciliada al reanudar servicio #${servId} (Cerrada en ${fechaPausa.toISOString()})`
            ]);
          } else {
            await client.query("ROLLBACK");
            return NextResponse.json({
              error: "OPEN_SESSION_EXISTS",
              code: "OPEN_SESSION_EXISTS",
              message: "Ya existe una sesión de trabajo abierta para este servicio."
            }, { status: 409 });
          }
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
          `, [servId, currentServ.usuario_id || sessionUserId, rate, sessionUserId]);
        } catch (dbErr: any) {
          console.warn("Notice inserting open session:", dbErr?.message);
        }
      }

      // Action 2: Pausar (2 -> 5)
      if (currentServStateId === 2 && targetServStateId === 5) {
        const pauseRes = await client.query(`
          WITH latest_session AS (
            SELECT orden_servicio_mano_obra_id
            FROM admin.orden_servicio_mano_obra
            WHERE orden_servicio_id = $1
              AND (detalle_mano_obra IS NULL OR BTRIM(detalle_mano_obra) = '')
              AND (observacion IS NULL OR BTRIM(observacion) = '')
              AND fecha_inicio IS NOT NULL
              AND fecha_finalizacion IS NULL
              AND (activo IS DISTINCT FROM false)
            ORDER BY orden_servicio_mano_obra_id DESC
            LIMIT 1
            FOR UPDATE
          )
          UPDATE admin.orden_servicio_mano_obra
          SET 
            fecha_finalizacion = NOW(),
            minutos_trabajados = ROUND(EXTRACT(EPOCH FROM (NOW() - fecha_inicio))/60.0),
            minutos_facturables = ROUND(EXTRACT(EPOCH FROM (NOW() - fecha_inicio))/60.0),
            costo_total = ROUND((EXTRACT(EPOCH FROM (NOW() - fecha_inicio))/3600.0) * costo_hora, 2),
            usuario_actualizacion = $2
          WHERE orden_servicio_mano_obra_id IN (SELECT orden_servicio_mano_obra_id FROM latest_session)
          RETURNING orden_servicio_mano_obra_id;
        `, [servId, sessionUserId]);

        if (pauseRes.rowCount !== 1) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            error: "TIMER_SESSION_INCONSISTENT",
            message: "No fue posible pausar el servicio porque la sesión de trabajo no es válida."
          }, { status: 409 });
        }
      }

      // Action 3: Completar / Finalizar Servicio (targetServStateId === 3)
      if (targetServStateId === 3) {
        // Enforce order state MUST be REPARACIÓN (5)
        if (estadoOrdenId !== 5) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            error: "ORDER_NOT_IN_REPAIR",
            message: "No se pueden completar servicios cuando la orden no está en REPARACIÓN."
          }, { status: 409 });
        }

        // Auto-close open technical timer session upon service completion
        await client.query(`
          WITH latest_session AS (
            SELECT orden_servicio_mano_obra_id
            FROM admin.orden_servicio_mano_obra
            WHERE orden_servicio_id = $1
              AND (detalle_mano_obra IS NULL OR BTRIM(detalle_mano_obra) = '')
              AND (observacion IS NULL OR BTRIM(observacion) = '')
              AND fecha_inicio IS NOT NULL
              AND fecha_finalizacion IS NULL
              AND (activo IS DISTINCT FROM false)
            ORDER BY orden_servicio_mano_obra_id DESC
            LIMIT 1
          )
          UPDATE admin.orden_servicio_mano_obra
          SET 
            fecha_finalizacion = NOW(),
            minutos_trabajados = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - fecha_inicio))/60)),
            minutos_facturables = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - fecha_inicio))/60)),
            costo_total = ROUND((GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - fecha_inicio))/60))/60.0) * costo_hora, 2),
            usuario_actualizacion = $2
          WHERE orden_servicio_mano_obra_id IN (SELECT orden_servicio_mano_obra_id FROM latest_session)
        `, [servId, sessionUserId]);
      }

      // Update Service State & Set fecha_finalizacion when completing
      await client.query(`
        UPDATE admin.orden_servicios
        SET 
          estado_orden_servicio_id = $1,
          fecha_finalizacion = CASE WHEN $1 = 3 THEN NOW() ELSE fecha_finalizacion END,
          usuario_actualizacion = $2
        WHERE orden_servicio_id = $3
      `, [targetServStateId, sessionUserId, servId]);

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
        `Estado de servicio #${servId} cambiado de ${currentServStateId} a ${targetServStateId}`
      ]);

      // If completing a service, check if ALL active services are now completed
      if (targetServStateId === 3 && estadoOrdenId === 5) {
        const allServsRes = await client.query(`
          SELECT orden_servicio_id, estado_orden_servicio_id, usuario_id, cantidad, precio_unitario
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

        if (allCompleted && totalOpenSessions === 0) {
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

      values.push(servId);
      const updateSql = `
        UPDATE admin.orden_servicios
        SET ${updates.join(", ")}
        WHERE orden_servicio_id = $${paramIdx}
      `;
      await client.query(updateSql, values);
    }

    await recalculateWorkOrderTotals(client, ordenId);

    await client.query("COMMIT");

    const cronStatus = await getCronometroStatus(pool, servId);

    return NextResponse.json({
      success: true,
      message: "Servicio actualizado exitosamente.",
      cronometro: cronStatus
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("PUT /api/taller/ordenes/[id]/servicios/[servicioId] Error:", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      constraint: err?.constraint,
      stack: err?.stack
    });

    return NextResponse.json({
      success: false,
      error: "SERVICE_UPDATE_FAILED",
      message: err.message || "Error al actualizar servicio.",
      ...(process.env.NODE_ENV === "development" ? {
        debug: {
          phase: "PUT_SERVICE_UPDATE",
          pgCode: err?.code,
          pgMessage: err?.message,
          detail: err?.detail,
          constraint: err?.constraint
        }
      } : {})
    }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE /api/taller/ordenes/[id]/servicios/[servicioId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; servicioId: string }> }
) {
  const { id, servicioId } = await params;

  if (!id || !servicioId || !/^\d+$/.test(id.trim()) || !/^\d+$/.test(servicioId.trim())) {
    return NextResponse.json({ error: "INVALID_ID", message: "IDs de orden o servicio no válidos." }, { status: 400 });
  }
  const ordenId = Number(id.trim());
  const servId = Number(servicioId.trim());

  const session = await getWorkshopSession();
  if (!session || !session.usuario_id) {
    return NextResponse.json({ error: "NO_SESSION", message: "Sesión no válida o expirada." }, { status: 401 });
  }
  const sessionUserId = session.usuario_id;

  const perms = await getModulePermissions("TALLER", session.usuario_id);
  if (!perms.puede_eliminar) {
    return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso para eliminar servicios." }, { status: 403 });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock order
    const orderRes = await client.query(`
      SELECT estado_orden_id FROM admin.ordenes_trabajo WHERE orden_trabajo_id = $1 AND activo = true FOR UPDATE
    `, [ordenId]);

    if (orderRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Orden de trabajo no encontrada." }, { status: 404 });
    }

    const estadoOrdenId = orderRes.rows[0].estado_orden_id;
    if (estadoOrdenId === 8) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "READ_ONLY_ORDER", message: "La orden está ENTREGADA y en solo lectura." }, { status: 409 });
    }

    // Check products
    const prodRes = await client.query(`
      SELECT COUNT(*)::int AS count FROM admin.orden_productos WHERE orden_servicio_id = $1
    `, [servId]);

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
    `, [servId]);

    // Recalculate Order Financial Totals
    await recalculateWorkOrderTotals(client, ordenId);

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
      `Servicio #${servId} eliminado de la orden`
    ]);

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Servicio eliminado exitosamente."
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("DELETE /api/taller/ordenes/[id]/servicios/[servicioId] Error:", err);
    return NextResponse.json({
      success: false,
      error: "SERVICE_DELETE_FAILED",
      message: err.message || "Error al eliminar servicio.",
      ...(process.env.NODE_ENV === "development" ? {
        debug: {
          phase: "DELETE_SERVICE",
          pgCode: err?.code,
          pgMessage: err?.message,
          detail: err?.detail,
          constraint: err?.constraint
        }
      } : {})
    }, { status: 500 });
  } finally {
    client.release();
  }
}
