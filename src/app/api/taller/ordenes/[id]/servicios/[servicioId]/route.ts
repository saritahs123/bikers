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

    // Query main service info joining bicicleta_componentes & estado_componente
    const servSql = `
      SELECT 
        os.orden_servicio_id AS servicio_id,
        os.orden_servicio_id,
        os.codigo_servicio,
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
        os.bicicleta_componente_id,
        cat.nombre AS componente_categoria,
        bc.marca AS componente_marca,
        bc.modelo AS componente_modelo,
        bc.numero_serie AS componente_numero_serie,
        bc.estado_componente_id AS componente_estado_actual_id,
        est_actual.nombre AS componente_estado_actual_nombre,
        est_actual.nivel_desgaste AS componente_estado_actual_porcentaje,
        os.nuevo_estado_componente_id,
        est_nuevo.nombre AS nuevo_estado_componente_nombre,
        os.fecha_inicio,
        os.fecha_finalizacion,
        COALESCE(os.tiempo_transcurrido, 0) AS tiempo_transcurrido
      FROM admin.orden_servicios os
      LEFT JOIN admin.tipo_servicio ts ON os.tipo_servicio_id = ts.tipo_servicio_id
      LEFT JOIN admin.estado_orden_servicio eos ON os.estado_orden_servicio_id = eos.estado_orden_servicio_id
      LEFT JOIN admin.bicicleta_componentes bc ON os.bicicleta_componente_id = bc.bicicleta_componente_id
      LEFT JOIN admin.categoria_componente cat ON bc.categoria_componente_id = cat.categoria_componente_id
      LEFT JOIN admin.estado_componente est_actual ON bc.estado_componente_id = est_actual.estado_componente_id
      LEFT JOIN admin.estado_componente est_nuevo ON os.nuevo_estado_componente_id = est_nuevo.estado_componente_id
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
        tiempo_transcurrido: Number(service.tiempo_transcurrido ?? 0),
        componente: service.bicicleta_componente_id ? {
          id: service.bicicleta_componente_id,
          categoria: service.componente_categoria || "Componente",
          marca: service.componente_marca || "",
          modelo: service.componente_modelo || "",
          numero_serie: service.componente_numero_serie || "",
          estado_actual_id: service.componente_estado_actual_id,
          estado_actual_nombre: service.componente_estado_actual_nombre || "",
          estado_actual_porcentaje: service.componente_estado_actual_porcentaje || 0
        } : null,
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
    const rawPrecio = body.precio_acordado ?? body.precio_unitario;
    const precio_acordado = (rawPrecio !== undefined && rawPrecio !== null && rawPrecio !== "" && !isNaN(Number(rawPrecio)))
      ? Number(rawPrecio)
      : undefined;
    const observaciones = body.observaciones ?? body.observacion_tecnica;

    const rawNuevoEstadoComponenteId = body.nuevo_estado_componente_id;
    const nuevoEstadoComponenteId = (rawNuevoEstadoComponenteId !== undefined && rawNuevoEstadoComponenteId !== null && rawNuevoEstadoComponenteId !== "" && !isNaN(parseInt(rawNuevoEstadoComponenteId, 10)))
      ? parseInt(rawNuevoEstadoComponenteId, 10)
      : undefined;

    await client.query("BEGIN");

    // Lock Order Row Exclusively
    const orderRes = await client.query(`
      SELECT orden_trabajo_id, estado_orden_id, bicicleta_id
      FROM admin.ordenes_trabajo
      WHERE orden_trabajo_id = $1 AND activo = true
      FOR UPDATE OF ordenes_trabajo
    `, [ordenId]);

    if (orderRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Orden de trabajo no encontrada." }, { status: 404 });
    }

    const currentOrder = orderRes.rows[0];
    const estadoOrdenId = currentOrder.estado_orden_id;
    const bicicletaId = currentOrder.bicicleta_id;

    if (estadoOrdenId === 8) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "READ_ONLY_ORDER", message: "La orden se encuentra ENTREGADA y está en solo lectura." }, { status: 409 });
    }

    // Lock Service Row
    const servRes = await client.query(`
      SELECT orden_servicio_id, tipo_servicio_id, estado_orden_servicio_id, bicicleta_componente_id, nuevo_estado_componente_id, usuario_id, precio_unitario
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

    // Save nuevo_estado_componente_id if passed
    let updatedNuevoEstadoCompId = currentServ.nuevo_estado_componente_id;
    if (nuevoEstadoComponenteId !== undefined && nuevoEstadoComponenteId !== null) {
      if (currentServStateId === 1) { // PENDIENTE
        await client.query("ROLLBACK");
        return NextResponse.json({
          success: false,
          error: "COMPONENT_RESULT_STATE_NOT_ALLOWED",
          message: "El estado final del componente solo puede definirse cuando el servicio está en proceso o pausado."
        }, { status: 409 });
      }

      if (!currentServ.bicicleta_componente_id) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          success: false,
          error: "NO_COMPONENT_ATTACHED",
          message: "Este servicio no tiene un componente vinculado."
        }, { status: 409 });
      }

      if (currentServStateId !== 2 && currentServStateId !== 5) { // Must be EN_PROCESO or PAUSADO
        await client.query("ROLLBACK");
        return NextResponse.json({
          success: false,
          error: "COMPONENT_RESULT_STATE_NOT_ALLOWED",
          message: "El estado final del componente solo puede definirse cuando el servicio está en proceso o pausado."
        }, { status: 409 });
      }

      if (nuevoEstadoComponenteId > 0) {
        const estCheck = await client.query(
          `SELECT estado_componente_id FROM admin.estado_componente WHERE estado_componente_id = $1 AND activo = true LIMIT 1`,
          [nuevoEstadoComponenteId]
        );
        if (estCheck.rows.length === 0) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "INVALID_COMPONENT_STATE", message: "El estado de componente seleccionado no es válido." }, { status: 400 });
        }
      }

      const updateStateRes = await client.query(`
        UPDATE admin.orden_servicios
        SET nuevo_estado_componente_id = $1,
            fecha_actualizacion = NOW(),
            usuario_actualizacion = $2
        WHERE orden_servicio_id = $3
          AND orden_trabajo_id = $4
        RETURNING orden_servicio_id, nuevo_estado_componente_id;
      `, [nuevoEstadoComponenteId > 0 ? nuevoEstadoComponenteId : null, sessionUserId, servId, ordenId]);

      if (updateStateRes.rowCount !== 1) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "SERVICE_UPDATE_FAILED", message: "No fue posible actualizar el servicio." }, { status: 500 });
      }

      updatedNuevoEstadoCompId = updateStateRes.rows[0].nuevo_estado_componente_id;
    }

    // Map functional actions or explicit state ID to target state
    let targetServStateId: number | undefined = estado_orden_servicio_id !== undefined ? parseInt(estado_orden_servicio_id, 10) : undefined;

    if (body.accion === "INICIAR_SERVICIO") {
      targetServStateId = 2; // EN_PROCESO
    } else if (body.accion === "PAUSAR_SERVICIO") {
      targetServStateId = 5; // SUSPENDIDO / PAUSADO
    } else if (body.accion === "REANUDAR_SERVICIO") {
      targetServStateId = 2; // EN_PROCESO
    } else if (body.accion === "FINALIZAR_SERVICIO") {
      targetServStateId = 3; // COMPLETADO
    }

    // Handle Service State Transitions
    let calculatedTiempoTranscurrido: number | null = null;
    let finishFechaInicio: string | null = null;
    let finishFechaFin: string | null = null;

    if (targetServStateId !== undefined && targetServStateId !== currentServStateId) {
      if (currentServStateId === 3) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          success: false,
          error: "INVALID_SERVICE_TRANSITION",
          message: "El servicio ya se encuentra completado y no admite más cambios de estado.",
          details: {
            estado_actual: "COMPLETADO",
            accion: body.accion || "CAMBIO_ESTADO"
          }
        }, { status: 409 });
      }

      if (currentServStateId === 1 && targetServStateId === 3) { // PENDIENTE -> COMPLETADO IS PROHIBITED
        await client.query("ROLLBACK");
        return NextResponse.json({
          success: false,
          error: "INVALID_SERVICE_TRANSITION",
          message: "Debes iniciar el servicio antes de finalizarlo.",
          details: {
            estado_actual: "PENDIENTE",
            accion: body.accion || "FINALIZAR_SERVICIO"
          }
        }, { status: 409 });
      }

      if (estadoOrdenId === 1) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          error: "ORDER_NOT_IN_REPAIR",
          message: "Primero debes iniciar la reparación de la orden."
        }, { status: 409 });
      }

      const ALLOWED_SERV_TRANSITIONS: Record<number, number[]> = {
        1: [2],    // PENDIENTE -> EN_PROCESO
        2: [5, 3], // EN_PROCESO -> PAUSADO o COMPLETADO
        5: [2, 3], // PAUSADO -> EN_PROCESO o COMPLETADO
        3: []      // COMPLETADO -> ninguna
      };

      if (!ALLOWED_SERV_TRANSITIONS[currentServStateId]?.includes(targetServStateId)) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          success: false,
          error: "INVALID_SERVICE_TRANSITION",
          message: `Transición de estado de servicio no permitida.`,
          details: {
            estado_actual: currentServStateId === 1 ? "PENDIENTE" : (currentServStateId === 2 ? "EN_PROCESO" : currentServStateId === 5 ? "PAUSADO" : "COMPLETADO"),
            accion: body.accion || "CAMBIO_ESTADO"
          }
        }, { status: 409 });
      }

      // Action 1: Iniciar o Reanudar (1 -> 2 o 5 -> 2)
      if (targetServStateId === 2) {
        // Set fecha_inicio COALESCE(fecha_inicio, NOW()) and tiempo_transcurrido = COALESCE(tiempo_transcurrido, 0)
        await client.query(`
          UPDATE admin.orden_servicios
          SET fecha_inicio = COALESCE(fecha_inicio, NOW()),
              tiempo_transcurrido = COALESCE(tiempo_transcurrido, 0),
              fecha_actualizacion = NOW(),
              usuario_actualizacion = $1
          WHERE orden_servicio_id = $2
            AND orden_trabajo_id = $3
        `, [sessionUserId, servId, ordenId]);

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
            message: "Se encontraron múltiples sesiones de trabajo abiertas de forma inconsistente."
          }, { status: 409 });
        }

        if (openCount === 1) {
          const openSess = openSessionsRes.rows[0];

          if (currentServStateId === 5) {
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

            const sessionSecs = Math.max(0, Math.round((fechaPausa.getTime() - fechaInicio.getTime()) / 1000));

            await client.query(`
              UPDATE admin.orden_servicio_mano_obra
              SET 
                fecha_finalizacion = $1,
                minutos_trabajados = ROUND($3 / 60.0),
                minutos_facturables = ROUND($3 / 60.0),
                costo_total = ROUND(($3 / 3600.0) * costo_hora, 2),
                usuario_actualizacion = $2
              WHERE orden_servicio_mano_obra_id = $4
            `, [fechaPausa, sessionUserId, sessionSecs, openSess.orden_servicio_mano_obra_id]);

            await client.query(`
              UPDATE admin.orden_servicios
              SET tiempo_transcurrido = COALESCE(tiempo_transcurrido, 0) + $1
              WHERE orden_servicio_id = $2
            `, [sessionSecs, servId]);

          } else {
            await client.query("ROLLBACK");
            return NextResponse.json({
              error: "OPEN_SESSION_EXISTS",
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
          `, [servId, sessionUserId, rate, sessionUserId]);
        } catch (dbErr: any) {
          console.warn("Notice inserting open session:", dbErr?.message);
        }
      }

      // Action 2: Pausar (2 -> 5)
      if (currentServStateId === 2 && targetServStateId === 5) {
        const pauseRes = await client.query(`
          WITH latest_session AS (
            SELECT orden_servicio_mano_obra_id, fecha_inicio
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
          RETURNING orden_servicio_mano_obra_id, ROUND(EXTRACT(EPOCH FROM (NOW() - fecha_inicio))) AS session_seconds;
        `, [servId, sessionUserId]);

        if (pauseRes.rowCount !== 1) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            error: "TIMER_SESSION_INCONSISTENT",
            message: "No fue posible pausar el servicio porque la sesión de trabajo no es válida."
          }, { status: 409 });
        }

        const sessSecs = Math.max(0, parseInt(pauseRes.rows[0]?.session_seconds || 0, 10));
        await client.query(`
          UPDATE admin.orden_servicios
          SET tiempo_transcurrido = COALESCE(tiempo_transcurrido, 0) + $1
          WHERE orden_servicio_id = $2
        `, [sessSecs, servId]);
      }

      // Action 3: Completar / Finalizar Servicio (targetServStateId === 3)
      if (targetServStateId === 3) {
        if (estadoOrdenId !== 5) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            error: "ORDER_NOT_IN_REPAIR",
            message: "No se pueden completar servicios cuando la orden no está en REPARACIÓN."
          }, { status: 409 });
        }

        const compId = currentServ.bicicleta_componente_id;
        const targetNuevoStateId = nuevoEstadoComponenteId !== undefined && nuevoEstadoComponenteId > 0
          ? nuevoEstadoComponenteId
          : currentServ.nuevo_estado_componente_id;

        if (compId) {
          if (!targetNuevoStateId) {
            await client.query("ROLLBACK");
            return NextResponse.json({
              error: "COMPONENT_RESULT_STATUS_REQUIRED",
              message: "Selecciona el estado final del componente antes de completar el servicio."
            }, { status: 400 });
          }

          const compLockRes = await client.query(`
            SELECT bc.bicicleta_componente_id, bc.estado_componente_id, est.nombre AS estado_anterior_nombre
            FROM admin.bicicleta_componentes bc
            JOIN admin.ordenes_trabajo ot ON ot.bicicleta_id = bc.bicicleta_id
            JOIN admin.orden_servicios os ON os.orden_trabajo_id = ot.orden_trabajo_id AND os.bicicleta_componente_id = bc.bicicleta_componente_id
            LEFT JOIN admin.estado_componente est ON bc.estado_componente_id = est.estado_componente_id
            WHERE os.orden_servicio_id = $1
              AND ot.orden_trabajo_id = $2
              AND (bc.activo IS DISTINCT FROM false)
              AND bc.fecha_eliminacion IS NULL
            FOR UPDATE OF bc, os;
          `, [servId, ordenId]);

          if (compLockRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return NextResponse.json({
              error: "INVALID_BICYCLE_COMPONENT",
              message: "El componente asociado no pertenece a la bicicleta de la orden."
            }, { status: 409 });
          }

          const prevEstadoId = compLockRes.rows[0].estado_componente_id;

          await client.query(`
            UPDATE admin.bicicleta_componentes
            SET estado_componente_id = $1,
                fecha_modificacion = NOW(),
                usuario_modificacion = $2
            WHERE bicicleta_componente_id = $3
          `, [targetNuevoStateId, sessionUserId, compId]);

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
            `Actualización de componente #${compId}: estado cambiado de ${prevEstadoId} a ${targetNuevoStateId} al finalizar servicio #${servId}`
          ]);
        }

        // Close open session if finishing from EN_PROCESO
        let finishSessionSecs = 0;
        if (currentServStateId === 2) {
          const finishSessRes = await client.query(`
            WITH latest_session AS (
              SELECT orden_servicio_mano_obra_id, fecha_inicio
              FROM admin.orden_servicio_mano_obra
              WHERE orden_servicio_id = $1
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
              minutos_trabajados = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - fecha_inicio))/60.0)),
              minutos_facturables = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - fecha_inicio))/60.0)),
              costo_total = ROUND((GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - fecha_inicio))/60.0))/60.0) * costo_hora, 2),
              usuario_actualizacion = $2
            WHERE orden_servicio_mano_obra_id IN (SELECT orden_servicio_mano_obra_id FROM latest_session)
            RETURNING ROUND(EXTRACT(EPOCH FROM (NOW() - fecha_inicio))) AS session_seconds;
          `, [servId, sessionUserId]);

          if (finishSessRes.rows.length > 0) {
            finishSessionSecs = Math.max(0, parseInt(finishSessRes.rows[0]?.session_seconds || 0, 10));
          }
        }

        // Calculate total active seconds (existing accumulated + closing session seconds)
        calculatedTiempoTranscurrido = Math.max(0, parseInt(currentServ.tiempo_transcurrido || 0, 10) + finishSessionSecs);

        // Update Service to COMPLETADO with non-null tiempo_transcurrido
        const finishUpdateRes = await client.query(`
          UPDATE admin.orden_servicios
          SET
            estado_orden_servicio_id = $1,
            fecha_finalizacion = NOW(),
            tiempo_transcurrido = $2,
            nuevo_estado_componente_id = COALESCE($3, nuevo_estado_componente_id),
            fecha_actualizacion = NOW(),
            usuario_actualizacion = $4
          WHERE orden_servicio_id = $5
            AND orden_trabajo_id = $6
          RETURNING orden_servicio_id, fecha_inicio, fecha_finalizacion, tiempo_transcurrido, nuevo_estado_componente_id;
        `, [targetServStateId, calculatedTiempoTranscurrido, targetNuevoStateId || null, sessionUserId, servId, ordenId]);

        finishFechaInicio = finishUpdateRes.rows[0]?.fecha_inicio ? new Date(finishUpdateRes.rows[0].fecha_inicio).toISOString() : null;
        finishFechaFin = finishUpdateRes.rows[0]?.fecha_finalizacion ? new Date(finishUpdateRes.rows[0].fecha_finalizacion).toISOString() : null;
      } else {
        // Non-completion state update
        await client.query(`
          UPDATE admin.orden_servicios
          SET
            estado_orden_servicio_id = $1,
            nuevo_estado_componente_id = COALESCE($4, nuevo_estado_componente_id),
            usuario_actualizacion = $2
          WHERE orden_servicio_id = $3
        `, [targetServStateId, sessionUserId, servId, nuevoEstadoComponenteId ?? null]);
      }

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
        targetServStateId === 2
          ? (currentServStateId === 5 ? `Servicio #${servId} reanudado por técnico` : `Servicio #${servId} iniciado`)
          : targetServStateId === 5
          ? `Servicio #${servId} pausado`
          : `Servicio #${servId} completado`
      ]);
    }

    // Handle Price / Observaciones updates
    if (precio_acordado !== undefined || observaciones !== undefined) {
      await client.query(`
        UPDATE admin.orden_servicios
        SET
          precio_unitario = COALESCE($1, precio_unitario),
          subtotal = COALESCE($1, subtotal),
          observacion_tecnica = COALESCE($2, observacion_tecnica),
          usuario_actualizacion = $3
        WHERE orden_servicio_id = $4
      `, [
        precio_acordado !== undefined ? precio_acordado : null,
        observaciones !== undefined ? observaciones : null,
        sessionUserId,
        servId
      ]);
    }

    await recalculateWorkOrderTotals(client, ordenId);

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: targetServStateId === 3 ? "Servicio completado exitosamente." : "Servicio actualizado correctamente.",
      data: {
        servicio_id: servId,
        orden_servicio_id: servId,
        estado_codigo: targetServStateId === 3 ? "COMPLETADO" : (targetServStateId === 2 ? "EN_PROCESO" : targetServStateId === 5 ? "PAUSADO" : "PENDIENTE"),
        fecha_inicio: finishFechaInicio || currentServ.fecha_inicio,
        fecha_finalizacion: finishFechaFin,
        tiempo_transcurrido: calculatedTiempoTranscurrido,
        nuevo_estado_componente_id: updatedNuevoEstadoCompId
      }
    });
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("PUT /api/taller/ordenes/[id]/servicios/[servicioId] failed:", error);
    return NextResponse.json({
      error: error?.code || "INTERNAL_ERROR",
      message: error?.message || "Error al actualizar servicio."
    }, { status: 400 });
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
  if (!perms.puede_eliminar && !perms.puede_editar) {
    return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso para eliminar servicios." }, { status: 403 });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
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
      return NextResponse.json({ error: "NOT_FOUND", message: "Orden de trabajo no encontrada." }, { status: 404 });
    }

    const estadoOrdenId = orderRes.rows[0].estado_orden_id;
    if (estadoOrdenId === 8) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "READ_ONLY_ORDER", message: "La orden se encuentra ENTREGADA y está en solo lectura." }, { status: 409 });
    }

    // Lock Service Row
    const servRes = await client.query(`
      SELECT orden_servicio_id, estado_orden_servicio_id, tipo_servicio_id
      FROM admin.orden_servicios
      WHERE orden_servicio_id = $1 AND orden_trabajo_id = $2 AND (activo IS DISTINCT FROM false)
      FOR UPDATE OF orden_servicios
    `, [servId, ordenId]);

    if (servRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "NOT_FOUND", message: "Servicio no encontrado en esta orden." }, { status: 404 });
    }

    const serviceToDel = servRes.rows[0];

    if (serviceToDel.estado_orden_servicio_id === 3 && estadoOrdenId === 8) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "COMPLETED_SERVICE_LOCKED", message: "No se puede eliminar un servicio completado en una orden cerrada." }, { status: 409 });
    }

    // Delete associated timer sessions & products
    await client.query(`
      DELETE FROM admin.orden_servicio_mano_obra WHERE orden_servicio_id = $1
    `, [servId]);

    await client.query(`
      DELETE FROM admin.orden_productos WHERE orden_servicio_id = $1
    `, [servId]);

    // Soft delete or delete service from admin.orden_servicios
    await client.query(`
      UPDATE admin.orden_servicios
      SET activo = false, usuario_actualizacion = $1, fecha_actualizacion = NOW()
      WHERE orden_servicio_id = $2 AND orden_trabajo_id = $3
    `, [sessionUserId, servId, ordenId]);

    // Audit History Record
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

    // Recalculate financial totals
    await recalculateWorkOrderTotals(client, ordenId);

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Servicio eliminado de la orden exitosamente.",
      data: {
        servicio_id: servId,
        orden_servicio_id: servId
      }
    });

  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("DELETE /api/taller/ordenes/[id]/servicios/[servicioId] failed:", error);
    return NextResponse.json({
      error: error?.code || "INTERNAL_ERROR",
      message: error?.message || "Error al eliminar servicio."
    }, { status: 500 });
  } finally {
    client.release();
  }
}
