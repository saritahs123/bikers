import { NextRequest, NextResponse } from "next/server";
import { getPool, query } from "@/lib/db";
import { recalculateWorkOrderTotals } from "@/lib/workshop/recalculateWorkOrderTotals";
import { getCronometroStatus } from "@/lib/workshop/getCronometroStatus";
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

  try {
    // 1. Validar ID con regex, Number(), y Number.isSafeInteger()
    if (!id || typeof id !== "string" || !/^\d+$/.test(id.trim())) {
      return NextResponse.json(
        { error: "INVALID_ID", message: "Identificador de orden inválido." },
        { status: 400 }
      );
    }
    const ordenId = Number(id.trim());
    if (!Number.isSafeInteger(ordenId) || ordenId <= 0) {
      return NextResponse.json(
        { error: "INVALID_ID", message: "Identificador de orden inválido." },
        { status: 400 }
      );
    }

    // 2. Validar sesión (sin retener conexiones de pool)
    const session = await getWorkshopSession();
    if (!session || !session.usuario_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión inválida o expirada." },
        { status: 401 }
      );
    }

    // 3. Validar permisos de módulo
    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permiso para consultar esta orden." },
        { status: 403 }
      );
    }

    // 4. Comprobar existencia en admin.ordenes_trabajo y obtener empresa vía usuario
    const existenceCheckSql = `
      SELECT
        ot.orden_trabajo_id,
        ot.recepcion_id,
        ot.usuario_registro,
        ot.estado_orden_id,
        ot.activo,
        COALESCE(u_ot.empresa_id, u_rec.empresa_id) AS order_empresa_id
      FROM admin.ordenes_trabajo ot
      LEFT JOIN admin.recepciones r ON ot.recepcion_id = r.recepcion_id
      LEFT JOIN admin.usuario u_ot ON ot.usuario_registro = u_ot.usuario_id
      LEFT JOIN admin.usuario u_rec ON r.usuario_creacion = u_rec.usuario_id
      WHERE ot.orden_trabajo_id = $1 AND ot.activo = true
    `;
    const existenceRes = await query<any>(existenceCheckSql, [ordenId]);
    if (!existenceRes || existenceRes.length === 0) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "La orden solicitada no existe." },
        { status: 404 }
      );
    }

    const otCheck = existenceRes[0];

    // 5. Resolver empresa asignada y validar alcance empresarial estricto
    const orderEmpresaId = otCheck.order_empresa_id ?? null;
    if (
      session.empresa_id == null ||
      orderEmpresaId == null ||
      Number(session.empresa_id) !== Number(orderEmpresaId)
    ) {
      return NextResponse.json(
        { error: "FORBIDDEN_COMPANY", message: "No tienes acceso a las órdenes de esta empresa." },
        { status: 403 }
      );
    }

    // 6. Cargar el detalle completo (usando helper query shared pool)
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

        COALESCE(cliente_ot.cliente_id, cliente_recepcion.cliente_id) AS cliente_id,
        COALESCE(cliente_ot.nombre_completo, cliente_recepcion.nombre_completo) AS cliente_nombre,
        COALESCE(cliente_ot.telefono_principal, cliente_recepcion.telefono_principal) AS cliente_telefono,
        COALESCE(cliente_ot.correo, cliente_recepcion.correo) AS cliente_correo,
        COALESCE(cliente_ot.direccion, cliente_recepcion.direccion) AS cliente_direccion,

        COALESCE(bicicleta_ot.bicicleta_id, bicicleta_recepcion.bicicleta_id) AS bicicleta_id,
        COALESCE(bicicleta_ot.marca, bicicleta_recepcion.marca) AS bicicleta_marca,
        COALESCE(bicicleta_ot.modelo, bicicleta_recepcion.modelo) AS bicicleta_modelo,
        COALESCE(bicicleta_ot.ano, bicicleta_recepcion.ano) AS bicicleta_ano,
        COALESCE(bicicleta_ot.numero_serie_cuadro, bicicleta_recepcion.numero_serie_cuadro) AS bicicleta_serie,

        ot.subtotal_servicios,
        ot.subtotal_productos,
        ot.descuento_servicios,
        ot.descuento_productos,
        ot.subtotal_general,
        ot.impuesto,
        ot.total_orden,
        (
          SELECT os.usuario_id
          FROM admin.orden_servicios os
          WHERE os.orden_trabajo_id = ot.orden_trabajo_id AND os.usuario_id IS NOT NULL AND (os.activo IS DISTINCT FROM false)
          ORDER BY os.orden_servicio_id ASC
          LIMIT 1
        ) AS mecanico_usuario_id,
        COALESCE(u_ot.empresa_id, u_rec.empresa_id) AS empresa_id
      FROM admin.ordenes_trabajo ot
      LEFT JOIN admin.recepciones r ON ot.recepcion_id = r.recepcion_id
      LEFT JOIN admin.usuario u_ot ON ot.usuario_registro = u_ot.usuario_id
      LEFT JOIN admin.usuario u_rec ON r.usuario_creacion = u_rec.usuario_id
      LEFT JOIN admin.clientes cliente_ot ON cliente_ot.cliente_id = ot.cliente_id
      LEFT JOIN admin.clientes cliente_recepcion ON cliente_recepcion.cliente_id = r.cliente_id
      LEFT JOIN admin.bicicletas bicicleta_ot ON bicicleta_ot.bicicleta_id = ot.bicicleta_id
      LEFT JOIN admin.bicicletas bicicleta_recepcion ON bicicleta_recepcion.bicicleta_id = r.bicicleta_id
      LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
      LEFT JOIN admin.prioridad_orden_trabajo pot ON ot.prioridad_orden_id = pot.prioridad_orden_trabajo_id
      WHERE ot.orden_trabajo_id = $1 AND ot.activo = true
    `;

    const orderRes = await query<any>(orderSql, [ordenId]);
    if (!orderRes || orderRes.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "La orden solicitada no existe." }, { status: 404 });
    }

    const order = orderRes[0];

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
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), ui.correo_electronico, ('Mecánico #' || u.usuario_id::text)) AS mecanico_nombre
      FROM admin.orden_servicios os
      LEFT JOIN admin.tipo_servicio ts ON os.tipo_servicio_id = ts.tipo_servicio_id
      LEFT JOIN admin.estado_orden_servicio eos ON os.estado_orden_servicio_id = eos.estado_orden_servicio_id
      LEFT JOIN admin.usuario u ON os.usuario_id = u.usuario_id
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      WHERE os.orden_trabajo_id = $1 AND (os.activo IS DISTINCT FROM false)
      ORDER BY os.orden_servicio_id ASC
    `;
    const servRes = await query<any>(servSql, [ordenId]);

    // Populate mano_obra and productos for each service in servRes
    const srvIds = (servRes || []).map((s: any) => s.servicio_id);
    let allManoObra: any[] = [];
    let allProductos: any[] = [];

    if (srvIds.length > 0) {
      allManoObra = await query<any>(`
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
        WHERE mo.orden_servicio_id = ANY($1) 
          AND (mo.activo IS DISTINCT FROM false)
          AND mo.detalle_mano_obra IS NOT NULL
          AND BTRIM(mo.detalle_mano_obra) <> ''
        ORDER BY mo.orden_servicio_mano_obra_id ASC
      `, [srvIds]);

      allProductos = await query<any>(`
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
        WHERE op.orden_trabajo_id = $1 OR op.orden_servicio_id = ANY($2)
        ORDER BY op.orden_producto_id ASC
      `, [ordenId, srvIds]);
    } else {
      allProductos = await query<any>(`
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
        WHERE op.orden_trabajo_id = $1
        ORDER BY op.orden_producto_id ASC
      `, [ordenId]);
    }

    const pool = getPool();
    const serviciosEnriquecidos = await Promise.all((servRes || []).map(async (s: any) => {
      const serviceManoObra = allManoObra.filter((m: any) => m.orden_servicio_id === s.servicio_id);
      const serviceProductos = allProductos.filter((p: any) => p.orden_servicio_id === s.servicio_id);
      const cronStatus = await getCronometroStatus(pool, s.servicio_id);
      return {
        ...s,
        en_proceso_cronometro: cronStatus.activo,
        cronometro: cronStatus,
        mano_obra: serviceManoObra,
        productos: serviceProductos
      };
    }));

    // History query
    const histSql = `
      SELECT 
        ohe.orden_historial_estado_id AS historial_id,
        ohe.estado_anterior_id,
        e1.nombre AS estado_anterior_nombre,
        ohe.estado_nuevo_id,
        e2.nombre AS estado_nuevo_nombre,
        ohe.usuario_cambio AS usuario_id,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), u.usuario_id::text) AS usuario_nombre,
        COALESCE(ohe.comentario, 'Cambio de estado de la orden') AS observaciones,
        COALESCE(ohe.fecha_cambio, ohe.fecha_registro) AS fecha
      FROM admin.orden_historial_estado ohe
      LEFT JOIN admin.estado_orden_trabajo e1 ON ohe.estado_anterior_id = e1.estado_orden_id
      LEFT JOIN admin.estado_orden_trabajo e2 ON ohe.estado_nuevo_id = e2.estado_orden_id
      LEFT JOIN admin.usuario u ON ohe.usuario_cambio = u.usuario_id
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      WHERE ohe.orden_trabajo_id = $1 AND (ohe.activo IS DISTINCT FROM false)
      ORDER BY COALESCE(ohe.fecha_cambio, ohe.fecha_registro) DESC
    `;
    const histRes = await query<any>(histSql, [ordenId]);

    // Recalculate financial summary as single source of truth
    const summary = await recalculateWorkOrderTotals({ query }, ordenId);

    const resumen_financiero = {
      servicios: (servRes || []).map((s: any) => ({
        servicio_id: s.servicio_id,
        descripcion: s.tipo_servicio_nombre || s.descripcion_servicio || "Servicio",
        cantidad: Number(s.cantidad || 1),
        precio_unitario: Number(s.precio_unitario || s.precio_acordado || 0),
        descuento: Number(s.valor_descuento || 0),
        subtotal: Number(s.subtotal || 0)
      })),
      mano_obra: allManoObra.map((m: any) => ({
        mano_obra_id: m.mano_obra_id,
        servicio_id: m.orden_servicio_id,
        detalle_mano_obra: m.detalle_mano_obra || m.descripcion || m.observacion || "Mano de obra",
        horas_reales: Number(m.horas_reales || m.horas_trabajadas || 0),
        costo_hora: Number(m.costo_hora || 0),
        subtotal: Number(m.subtotal || 0)
      })),
      productos: allProductos.map((p: any) => ({
        orden_producto_id: p.orden_producto_id,
        servicio_id: p.orden_servicio_id,
        producto_nombre: p.producto_nombre || p.nombre || "Producto",
        cantidad: Number(p.cantidad || 1),
        precio_unitario: Number(p.precio_unitario || 0),
        descuento: Number(p.valor_descuento || 0),
        subtotal: Number(p.subtotal || 0)
      }))
    };

    // Compute progress metrics dynamically
    const catalogStatusRes = await query<{ estado_orden_servicio_id: number; codigo: string }>(`
      SELECT estado_orden_servicio_id, UPPER(codigo) AS codigo
      FROM admin.estado_orden_servicio
      WHERE (activo IS DISTINCT FROM false)
    `);

    const statusMap = new Map<string, number>();
    for (const r of catalogStatusRes || []) {
      statusMap.set(r.codigo, r.estado_orden_servicio_id);
    }

    const estadoPendienteId = statusMap.get("PENDIENTE") || 1;
    const estadoEnProcesoId = statusMap.get("EN_PROCESO") || 2;
    const estadoCompletadoId = statusMap.get("COMPLETADO") || 3;
    const estadoPausadoId = statusMap.get("SUSPENDIDO") || 5;

    // Technical timer seconds calculation across all services belonging to order ID
    const timerSumRes = await query<{ segundos_trabajados: number }>(`
      SELECT COALESCE(
        SUM(
          EXTRACT(
            EPOCH FROM (
              COALESCE(mo.fecha_finalizacion, NOW()) - mo.fecha_inicio
            )
          )
        ),
        0
      )::int AS segundos_trabajados
      FROM admin.orden_servicio_mano_obra mo
      JOIN admin.orden_servicios os ON mo.orden_servicio_id = os.orden_servicio_id
      WHERE os.orden_trabajo_id = $1
        AND (os.activo IS DISTINCT FROM false)
        AND (mo.detalle_mano_obra IS NULL OR BTRIM(mo.detalle_mano_obra) = '')
        AND (mo.observacion IS NULL OR BTRIM(mo.observacion) = '')
        AND mo.fecha_inicio IS NOT NULL
        AND (mo.activo IS DISTINCT FROM false)
    `, [ordenId]);

    const segundosTrabajados = Number(timerSumRes[0]?.segundos_trabajados || 0);
    const horasRegistradas = Math.round((segundosTrabajados / 3600.0) * 100) / 100;

    // Service counts by status (excluding CANCELADO, ANULADO, INACTIVO)
    const servStatsRes = await query<{
      total_servicios: number;
      servicios_pendientes: number;
      servicios_en_proceso: number;
      servicios_pausados: number;
      servicios_completados: number;
    }>(`
      SELECT 
        COUNT(*)::int AS total_servicios,
        COUNT(*) FILTER (WHERE os.estado_orden_servicio_id = $2)::int AS servicios_pendientes,
        COUNT(*) FILTER (WHERE os.estado_orden_servicio_id = $3)::int AS servicios_en_proceso,
        COUNT(*) FILTER (WHERE os.estado_orden_servicio_id = $4)::int AS servicios_pausados,
        COUNT(*) FILTER (WHERE os.estado_orden_servicio_id = $5)::int AS servicios_completados
      FROM admin.orden_servicios os
      WHERE os.orden_trabajo_id = $1 
        AND (os.activo IS DISTINCT FROM false)
        AND (os.estado_orden_servicio_id NOT IN (
          SELECT estado_orden_servicio_id
          FROM admin.estado_orden_servicio
          WHERE UPPER(codigo) IN ('CANCELADO', 'ANULADO', 'INACTIVO')
        ))
    `, [ordenId, estadoPendienteId, estadoEnProcesoId, estadoPausadoId, estadoCompletadoId]);

    const totalServicios = Number(servStatsRes[0]?.total_servicios || 0);
    const serviciosCompletados = Number(servStatsRes[0]?.servicios_completados || 0);
    const porcentajeProgreso = totalServicios > 0
      ? Math.min(100, Math.max(0, Math.round((serviciosCompletados / totalServicios) * 10000) / 100))
      : 0;

    // Horas estimadas calculation from catalog tipo_servicio
    const horasEstRes = await query<{ horas_estimadas: number }>(`
      SELECT SUM(ts.duracion_estimada_horas) AS horas_estimadas
      FROM admin.orden_servicios os
      JOIN admin.tipo_servicio ts ON os.tipo_servicio_id = ts.tipo_servicio_id
      WHERE os.orden_trabajo_id = $1 AND (os.activo IS DISTINCT FROM false)
    `, [ordenId]);
    const rawHorasEst = horasEstRes[0]?.horas_estimadas;
    const horasEstimadas = (rawHorasEst !== null && rawHorasEst !== undefined && !isNaN(Number(rawHorasEst)) && Number(rawHorasEst) > 0)
      ? Math.round(Number(rawHorasEst) * 10) / 10
      : undefined;

    const progresoObj = {
      total_servicios: totalServicios,
      servicios_pendientes: Number(servStatsRes[0]?.servicios_pendientes || 0),
      servicios_en_proceso: Number(servStatsRes[0]?.servicios_en_proceso || 0),
      servicios_pausados: Number(servStatsRes[0]?.servicios_pausados || 0),
      servicios_completados: serviciosCompletados,
      porcentaje: porcentajeProgreso,
      segundos_trabajados: segundosTrabajados,
      horas_registradas: horasRegistradas
    };

    return NextResponse.json({
      success: true,
      data: {
        ...order,
        subtotal_servicios: summary.subtotal_servicios,
        subtotal_mano_obra: summary.subtotal_mano_obra,
        subtotal_productos: summary.subtotal_productos,
        subtotal_repuestos: summary.subtotal_productos,
        descuento_servicios: summary.descuento_servicios,
        descuento_productos: summary.descuento_productos,
        otros_descuentos: summary.otros_descuentos,
        subtotal_bruto: summary.subtotal_bruto,
        subtotal_neto: summary.subtotal_neto,
        impuesto: summary.impuesto,
        total_orden: summary.total_orden,
        progreso: progresoObj,
        progreso_porcentaje: porcentajeProgreso,
        horas_registradas: horasRegistradas,
        horas_estimadas: horasEstimadas,
        resumen_financiero,
        servicios: serviciosEnriquecidos,
        historial: histRes || []
      }
    });

  } catch (error: any) {
    console.error("GET /api/taller/ordenes/[id] failed", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack
    });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "No pudimos cargar la orden."
      },
      { status: 500 }
    );
  }
}

// PUT /api/taller/ordenes/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Validar ID primero sin reservar cliente
  if (!id || typeof id !== "string" || !/^\d+$/.test(id.trim())) {
    return NextResponse.json(
      { error: "INVALID_ID", message: "Identificador de orden inválido." },
      { status: 400 }
    );
  }
  const ordenId = Number(id.trim());
  if (!Number.isSafeInteger(ordenId) || ordenId <= 0) {
    return NextResponse.json(
      { error: "INVALID_ID", message: "Identificador de orden inválido." },
      { status: 400 }
    );
  }

  // 2. Validar sesión primero
  const session = await getWorkshopSession();
  if (!session || !session.usuario_id) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Sesión inválida o expirada." },
      { status: 401 }
    );
  }

  // 3. Validar permisos de módulo
  const perms = await getModulePermissions("TALLER", session.usuario_id);

  // 4. Ahora sí adquirir conexión transaccional dedicada
  const pool = getPool();
  const client = await pool.connect();

  try {
    const body = await req.json();
    const {
      estado_orden_id,
      prioridad_id,
      prioridad_orden_id,
      observacion_interna,
      observacion_cambio_estado,
      diagnostico_inicial,
      fecha_entrega_estimada,
    } = body;

    const targetPrioridadId = prioridad_id !== undefined ? prioridad_id : prioridad_orden_id;

    await client.query("BEGIN");

    const orderRes = await client.query(`
      SELECT 
        ot.orden_trabajo_id, 
        ot.estado_orden_id, 
        ot.prioridad_orden_id, 
        ot.fecha_entrega_estimada, 
        ot.diagnostico_inicial, 
        ot.observacion_interna,
        r.empresa_id AS empresa_id
      FROM admin.ordenes_trabajo ot
      LEFT JOIN admin.recepciones r ON ot.recepcion_id = r.recepcion_id
      WHERE ot.orden_trabajo_id = $1 AND ot.activo = true
      FOR UPDATE OF ot
    `, [ordenId]);

    if (orderRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "NOT_FOUND", title: "Orden no encontrada", message: "Orden de trabajo no encontrada." },
        { status: 404 }
      );
    }

    const currentOrder = orderRes.rows[0];
    const currentStateId = currentOrder.estado_orden_id;

    if (
      session.empresa_id == null ||
      currentOrder.empresa_id == null ||
      Number(session.empresa_id) !== Number(currentOrder.empresa_id)
    ) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "FORBIDDEN_COMPANY",
          title: "No puedes editar esta orden",
          message: "La orden pertenece a otra empresa."
        },
        { status: 403 }
      );
    }

    if (currentStateId === 8) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "READ_ONLY_ORDER",
          title: "Orden entregada",
          message: "La orden se encuentra en estado ENTREGADA. Está en modo de solo lectura permanente."
        },
        { status: 409 }
      );
    }

    const isStateChangeRequested = estado_orden_id !== undefined && parseInt(estado_orden_id, 10) !== currentStateId;

    if (!isStateChangeRequested) {
      if (!perms.puede_editar) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            error: "FORBIDDEN",
            title: "No tienes permiso para editar esta orden",
            message: "Solicita acceso al módulo de Taller a un administrador."
          },
          { status: 403 }
        );
      }

      await client.query(`
        UPDATE admin.ordenes_trabajo
        SET 
          prioridad_orden_id = COALESCE($1, prioridad_orden_id),
          observacion_interna = COALESCE($2, observacion_interna),
          diagnostico_inicial = COALESCE($3, diagnostico_inicial),
          fecha_entrega_estimada = COALESCE($4, fecha_entrega_estimada),
          fecha_actualizacion = NOW(),
          usuario_actualizacion = $5
        WHERE orden_trabajo_id = $6
      `, [
        targetPrioridadId ? parseInt(targetPrioridadId, 10) : null,
        observacion_interna !== undefined ? observacion_interna : null,
        diagnostico_inicial !== undefined ? diagnostico_inicial : null,
        cleanFecha(fecha_entrega_estimada),
        session.usuario_id,
        ordenId
      ]);

      await client.query("COMMIT");
      return NextResponse.json({
        success: true,
        message: "Orden de trabajo actualizada correctamente."
      }, { status: 200 });
    }

    const targetStateId = parseInt(estado_orden_id, 10);

    const ALLOWED_TRANSITIONS: Record<number, number[]> = {
      1: [5],     // RECIBIDA -> REPARACION
      5: [7],     // REPARACION -> LISTA_ENTREGA
      7: [5, 8],  // LISTA_ENTREGA -> REPARACION (devolución) o ENTREGADA (entrega)
      8: []       // Read-only
    };

    if (!ALLOWED_TRANSITIONS[currentStateId]?.includes(targetStateId)) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "TRANSITION_NOT_ALLOWED",
          title: "No se puede cambiar el estado",
          message: `Transición de estado no permitida: del estado ${currentStateId} al estado ${targetStateId}.`
        },
        { status: 409 }
      );
    }

    if (currentStateId === 7 && targetStateId === 5) {
      if (!perms.puede_reabrir) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            error: "FORBIDDEN",
            title: "No tienes permiso para realizar esta acción",
            message: "Solicita acceso al módulo de Taller a un administrador."
          },
          { status: 403 }
        );
      }
    } else if (targetStateId === 8) {
      if (!perms.puede_cerrar) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            error: "FORBIDDEN",
            title: "No tienes permiso para realizar esta acción",
            message: "Solicita acceso al módulo de Taller a un administrador."
          },
          { status: 403 }
        );
      }
    } else {
      if (!perms.puede_mover && !perms.puede_editar) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            error: "FORBIDDEN",
            title: "No tienes permiso para realizar esta acción",
            message: "Solicita acceso al módulo de Taller a un administrador."
          },
          { status: 403 }
        );
      }
    }

    await client.query(`
      UPDATE admin.ordenes_trabajo
      SET 
        estado_orden_id = $1,
        prioridad_orden_id = COALESCE($2, prioridad_orden_id),
        observacion_interna = COALESCE($3, observacion_interna),
        fecha_inicio_trabajo = CASE WHEN $1 = 5 AND fecha_inicio_trabajo IS NULL THEN NOW() ELSE fecha_inicio_trabajo END,
        fecha_finalizacion = CASE WHEN $1 = 7 THEN NOW() WHEN $1 = 5 THEN NULL ELSE fecha_finalizacion END,
        fecha_entrega_real = CASE WHEN $1 = 8 THEN NOW() ELSE fecha_entrega_real END,
        observacion_entrega = CASE WHEN $1 = 8 THEN COALESCE($4, observacion_entrega) ELSE observacion_entrega END,
        fecha_actualizacion = NOW(),
        usuario_actualizacion = $5
      WHERE orden_trabajo_id = $6
    `, [
      targetStateId,
      targetPrioridadId ? parseInt(targetPrioridadId, 10) : null,
      observacion_interna !== undefined ? observacion_interna : null,
      observacion_cambio_estado !== undefined ? observacion_cambio_estado : null,
      session.usuario_id,
      ordenId
    ]);

    await client.query(`
      INSERT INTO admin.orden_historial_estado (
        orden_historial_estado_id, orden_trabajo_id, estado_anterior_id, estado_nuevo_id,
        usuario_cambio, comentario, fecha_cambio, activo, fecha_registro
      ) VALUES (
        (SELECT COALESCE(MAX(orden_historial_estado_id), 0) + 1 FROM admin.orden_historial_estado),
        $1, $2, $3, $4, $5, NOW(), true, NOW()
      )
    `, [
      ordenId,
      currentStateId,
      targetStateId,
      session.usuario_id,
      observacion_cambio_estado || observacion_interna || "Cambio de estado de la orden"
    ]);

    await client.query("COMMIT");
    return NextResponse.json({
      success: true,
      message: "Estado de la orden actualizado correctamente."
    }, { status: 200 });

  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    return NextResponse.json(
      {
        error: "SERVER_ERROR",
        title: "No pudimos guardar los cambios",
        message: "Inténtalo nuevamente en unos momentos."
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
