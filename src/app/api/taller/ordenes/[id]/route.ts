import { NextRequest, NextResponse } from "next/server";
import { getPool, query } from "@/lib/db";
import { recalculateWorkOrderTotals } from "@/lib/workshop/recalculateWorkOrderTotals";
import { getCronometroStatus } from "@/lib/workshop/getCronometroStatus";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { queryIncompleteServicesAndTimers } from "@/lib/workshop/validateOrderState";
import { recordUserActivity, recordUserAudit, computeDiff } from "@/lib/auditLogger";

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

    const session = await getWorkshopSession();
    if (!session || !session.usuario_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión inválida o expirada." },
        { status: 401 }
      );
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permiso para consultar esta orden." },
        { status: 403 }
      );
    }

    const existenceCheckSql = `
      SELECT
        ot.orden_trabajo_id,
        ot.recepcion_id,
        ot.cliente_id,
        ot.estado_orden_id,
        ot.activo,
        c.empresa_id AS order_empresa_id
      FROM admin.ordenes_trabajo ot
      JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
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

    const orderEmpresaId = otCheck.order_empresa_id ?? null;
    if (
      session.empresa_id == null ||
      orderEmpresaId == null ||
      Number(session.empresa_id) !== Number(orderEmpresaId)
    ) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "La orden solicitada no existe o no pertenece a su empresa." },
        { status: 404 }
      );
    }

    // Load full order details joining mecanico_id from admin.ordenes_trabajo
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
        ot.descripcion_cliente,
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
        ot.mecanico_id,
        ot.total_tiempo_transcurrido,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui_mec.nombre, ui_mec.apellido)), ''), ui_mec.correo_electronico, ('Mecánico #' || u_mec.usuario_id::text)) AS mecanico_nombre,
        c_mec.nombre AS mecanico_cargo,
        tu_mec.nombre AS mecanico_tipo,
        u_mec.usuario_id AS mecanico_id_val,
        c.empresa_id AS empresa_id
      FROM admin.ordenes_trabajo ot
      JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
      LEFT JOIN admin.recepciones r ON ot.recepcion_id = r.recepcion_id
      LEFT JOIN admin.bicicletas bicicleta_ot ON bicicleta_ot.bicicleta_id = ot.bicicleta_id
      LEFT JOIN admin.bicicletas bicicleta_recepcion ON bicicleta_recepcion.bicicleta_id = r.bicicleta_id
      LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
      LEFT JOIN admin.prioridad_orden_trabajo pot ON ot.prioridad_orden_id = pot.prioridad_orden_trabajo_id
      LEFT JOIN admin.usuario u_mec ON ot.mecanico_id = u_mec.usuario_id
      LEFT JOIN admin.usuario_identidad ui_mec ON u_mec.usuario_id = ui_mec.usuario_id
      LEFT JOIN admin.cargo c_mec ON ui_mec.cargo_id = c_mec.cargo_id
      LEFT JOIN admin.tipo_usuario tu_mec ON u_mec.tipo_usuario_id = tu_mec.tipo_usuario_id
      WHERE ot.orden_trabajo_id = $1 AND ot.activo = true
    `;

    const orderRes = await query<any>(orderSql, [ordenId]);
    if (!orderRes || orderRes.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "La orden solicitada no existe." }, { status: 404 });
    }

    const order = orderRes[0];

    // Services query joining bicicleta_componentes & estado_componente
    const servSql = `
      SELECT 
        os.orden_servicio_id AS servicio_id,
        os.orden_servicio_id,
        os.codigo_servicio,
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
        os.observacion_tecnica,
        os.fecha_inicio,
        os.fecha_finalizacion,
        COALESCE(os.tiempo_transcurrido, 0) AS tiempo_transcurrido,
        os.bicicleta_componente_id,
        cat.nombre AS componente_categoria,
        bc.marca AS componente_marca,
        bc.modelo AS componente_modelo,
        bc.numero_serie AS componente_numero_serie,
        bc.estado_componente_id AS componente_estado_actual_id,
        est_actual.nombre AS componente_estado_actual_nombre,
        est_actual.nivel_desgaste AS componente_estado_actual_porcentaje,
        os.nuevo_estado_componente_id,
        est_nuevo.nombre AS nuevo_estado_componente_nombre
      FROM admin.orden_servicios os
      LEFT JOIN admin.tipo_servicio ts ON os.tipo_servicio_id = ts.tipo_servicio_id
      LEFT JOIN admin.estado_orden_servicio eos ON os.estado_orden_servicio_id = eos.estado_orden_servicio_id
      LEFT JOIN admin.bicicleta_componentes bc ON os.bicicleta_componente_id = bc.bicicleta_componente_id
      LEFT JOIN admin.categoria_componente cat ON bc.categoria_componente_id = cat.categoria_componente_id
      LEFT JOIN admin.estado_componente est_actual ON bc.estado_componente_id = est_actual.estado_componente_id
      LEFT JOIN admin.estado_componente est_nuevo ON os.nuevo_estado_componente_id = est_nuevo.estado_componente_id
      WHERE os.orden_trabajo_id = $1 AND (os.activo IS DISTINCT FROM false)
      ORDER BY os.orden_servicio_id ASC
    `;
    const servRes = await query<any>(servSql, [ordenId]);

    // Populate mano_obra and productos for each service
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
    }

    allProductos = await query<any>(`
      SELECT
        op.orden_producto_id,
        op.orden_producto_id AS id,
        op.orden_trabajo_id,
        op.orden_servicio_id,
        op.producto_id,
        COALESCE(p.codigo_producto, 'PRD-' || LPAD(op.producto_id::text, 3, '0')) AS codigo,
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

    const pool = getPool();
    const serviciosEnriquecidos = await Promise.all((servRes || []).map(async (s: any) => {
      const serviceManoObra = allManoObra.filter((m: any) => m.orden_servicio_id === s.servicio_id);
      const serviceProductos = allProductos.filter((p: any) => p.orden_servicio_id === s.servicio_id);
      const cronStatus = await getCronometroStatus(pool, s.servicio_id);
      return {
        ...s,
        componente: s.bicicleta_componente_id ? {
          id: s.bicicleta_componente_id,
          categoria: s.componente_categoria || "Componente",
          marca: s.componente_marca || "",
          modelo: s.componente_modelo || "",
          numero_serie: s.componente_numero_serie || "",
          estado_actual_id: s.componente_estado_actual_id,
          estado_actual_nombre: s.componente_estado_actual_nombre || "",
          estado_actual_porcentaje: s.componente_estado_actual_porcentaje || 0
        } : null,
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

    // Recalculate financial summary
    const summary = await recalculateWorkOrderTotals({ query }, ordenId);

    // Query all active open timer sessions grouped by service, calculating live seconds since start
    const openSessions = await query<any>(`
      SELECT
          osm.orden_servicio_id,
          COUNT(*)::integer AS sesiones_abiertas,
          MIN(osm.fecha_inicio) AS fecha_inicio_abierta,
          EXTRACT(EPOCH FROM (NOW() - MIN(osm.fecha_inicio)))::bigint AS segundos_abiertos
      FROM admin.orden_servicio_mano_obra osm
      JOIN admin.orden_servicios os ON os.orden_servicio_id = osm.orden_servicio_id
      JOIN admin.estado_orden_servicio eos ON eos.estado_orden_servicio_id = os.estado_orden_servicio_id
      WHERE os.orden_trabajo_id = $1
        AND os.activo IS DISTINCT FROM false
        AND eos.codigo = 'EN_PROCESO'
        AND osm.fecha_finalizacion IS NULL
        AND osm.activo IS DISTINCT FROM false
        AND (osm.detalle_mano_obra IS NULL OR BTRIM(osm.detalle_mano_obra) = '')
        AND (osm.observacion IS NULL OR BTRIM(osm.observacion) = '')
      GROUP BY osm.orden_servicio_id
    `, [ordenId]);

    const duplicados: number[] = [];
    let segundosAbiertosSum = 0;
    let tiempoTotalConfiable = true;

    for (const row of openSessions) {
      if (row.sesiones_abiertas > 1) {
        duplicados.push(row.orden_servicio_id);
        tiempoTotalConfiable = false;
      } else if (tiempoTotalConfiable) {
        segundosAbiertosSum += Number(row.segundos_abiertos || 0);
      }
    }

    const totalPersistido = Number(order.total_tiempo_transcurrido || 0);
    const totalVivo = tiempoTotalConfiable ? (totalPersistido + segundosAbiertosSum) : totalPersistido;

    const nowRes = await query<any>(`SELECT NOW() AS calculado_en`);
    const calculadoEn = nowRes[0]?.calculado_en || new Date();

    const resumen_financiero = {
      servicios: (servRes || []).map((s: any) => ({
        servicio_id: s.servicio_id,
        descripcion: s.tipo_servicio_nombre || s.descripcion_servicio || "Servicio",
        observacion_tecnica: s.observacion_tecnica || s.motivo_sin_mano_obra || "",
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

    // Compute progress metrics
    const catalogStatusRes = await query<{ estado_orden_servicio_id: number; codigo: string }>(`
      SELECT estado_orden_servicio_id, UPPER(codigo) AS codigo
      FROM admin.estado_orden_servicio
      WHERE (activo IS DISTINCT FROM false)
    `);

    const statusMap = new Map<string, number>();
    for (const r of catalogStatusRes || []) {
      statusMap.set(r.codigo, r.estado_orden_servicio_id);
    }

    const idCompletado = statusMap.get("COMPLETADO") || 3;
    const idCancelado = statusMap.get("CANCELADO") || 4;

    const applicableServices = (servRes || []).filter(
      (s: any) => s.estado_servicio_id !== idCancelado
    );
    const totalApplicable = applicableServices.length;
    const completedServices = applicableServices.filter(
      (s: any) => s.estado_servicio_id === idCompletado
    ).length;

    const progresoPorcentaje = totalApplicable > 0
      ? Math.round((completedServices / totalApplicable) * 100)
      : 0;

    const totalSegundosTrabajados = allManoObra.reduce((sum: number, m: any) => {
      const mins = Number(m.minutos_trabajados || 0);
      return sum + Math.max(0, Math.floor(mins * 60));
    }, 0);

    const totalHorasRegistradas = Math.round((totalSegundosTrabajados / 3600.0) * 10) / 10;

    const getInitials = (name: string) => {
      if (!name) return "MC";
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return parts[0].substring(0, 2).toUpperCase();
    };

    return NextResponse.json({
      success: true,
      data: {
        ...order,
        total_tiempo_transcurrido: totalPersistido,
        total_tiempo_transcurrido_vivo: totalVivo,
        tiempo_total_calculado_en: new Date(calculadoEn).toISOString(),
        tiempo_total_confiable: tiempoTotalConfiable,
        servicios_con_sesiones_duplicadas: duplicados,
        tiempo_total: {
          segundos_persistidos: totalPersistido,
          segundos_en_vivo: totalVivo,
          calculado_en: new Date(calculadoEn).toISOString(),
          tiempo_total_confiable: tiempoTotalConfiable,
          servicios_con_sesiones_duplicadas: duplicados
        },
        bicicleta_id: Number(order.bicicleta_id || 0),
        bicicleta: order.bicicleta_id ? {
          bicicleta_id: Number(order.bicicleta_id),
          marca: order.bicicleta_marca || "",
          modelo: order.bicicleta_modelo || "",
          ano: order.bicicleta_ano || null,
          serie: order.bicicleta_serie || ""
        } : null,
        mecanico_id: order.mecanico_id || null,
        mecanico_nombre: order.mecanico_nombre || null,
        mecanico: order.mecanico_id ? {
          id: order.mecanico_id,
          nombre_completo: order.mecanico_nombre,
          iniciales: getInitials(order.mecanico_nombre),
          cargo_nombre: order.mecanico_cargo || order.mecanico_tipo || "Técnico de Taller"
        } : null,
        subtotal_servicios: summary.subtotal_servicios,
        subtotal_mano_obra: summary.subtotal_mano_obra,
        subtotal_productos: summary.subtotal_productos,
        total_descuentos: (summary.descuento_servicios || 0) + (summary.descuento_productos || 0) + (summary.otros_descuentos || 0),
        subtotal_bruto: summary.subtotal_bruto,
        subtotal_neto: summary.subtotal_neto,
        impuesto: summary.impuesto,
        total_orden: summary.total_orden,
        progreso: {
          porcentaje: progresoPorcentaje,
          servicios_totales: totalApplicable,
          servicios_completados: completedServices,
          segundos_trabajados: totalSegundosTrabajados,
          horas_registradas: totalHorasRegistradas
        },
        servicios: serviciosEnriquecidos,
        productos: (allProductos || []).map((p: any) => ({
          orden_producto_id: p.orden_producto_id,
          producto_id: p.producto_id,
          codigo: p.codigo || p.codigo_producto || `PRD-${String(p.producto_id).padStart(3, "0")}`,
          nombre: p.producto_nombre || p.nombre || "Producto / Repuesto",
          cantidad: Number(p.cantidad || 1),
          precio_unitario: Number(p.precio_unitario || 0),
          subtotal: Number(p.subtotal || 0),
          observacion: p.observacion || null
        })),
        historial: histRes || [],
        resumen_financiero
      }
    });
  } catch (error: any) {
    console.error("GET /api/taller/ordenes/[id] exception:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Ocurrió un error al procesar la solicitud." },
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

  if (!id || typeof id !== "string" || !/^\d+$/.test(id.trim())) {
    return NextResponse.json(
      { error: "INVALID_ID", message: "Identificador de orden inválido." },
      { status: 400 }
    );
  }
  const ordenId = Number(id.trim());

  const session = await getWorkshopSession();
  if (!session || !session.usuario_id) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Sesión inválida o expirada." },
      { status: 401 }
    );
  }

  const perms = await getModulePermissions("TALLER", session.usuario_id);

  const pool = getPool();
  const client = await pool.connect();

  try {
    const body = await req.json();
    const {
      accion,
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

    // Lock Order Row & join clientes for canonical empresa_id safely
    const orderRes = await client.query(`
      SELECT 
        ot.orden_trabajo_id, 
        ot.codigo_orden,
        ot.estado_orden_id, 
        ot.prioridad_orden_id, 
        ot.fecha_entrega_estimada, 
        ot.diagnostico_inicial, 
        ot.observacion_interna,
        ot.usuario_registro,
        ot.mecanico_id,
        ot.facturado,
        ot.fecha_facturacion,
        ot.usuario_facturacion_id,
        COALESCE(ot.total_orden, ot.subtotal_general, 0) AS total_orden,
        c.empresa_id AS empresa_id
      FROM admin.ordenes_trabajo ot
      JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
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
          error: "NOT_FOUND",
          title: "Orden no encontrada",
          message: "Orden de trabajo no encontrada."
        },
        { status: 404 }
      );
    }

    // Resolve Status Catalog from admin.estado_orden_trabajo
    const catalogRes = await client.query(`
      SELECT estado_orden_id, UPPER(codigo) AS codigo, nombre
      FROM admin.estado_orden_trabajo
      WHERE (activo IS DISTINCT FROM false)
    `);

    const codeToIdMap = new Map<string, number>();
    const idToCodeMap = new Map<number, { id: number; codigo: string; nombre: string }>();

    for (const row of catalogRes.rows || []) {
      codeToIdMap.set(row.codigo, row.estado_orden_id);
      idToCodeMap.set(row.estado_orden_id, { id: row.estado_orden_id, codigo: row.codigo, nombre: row.nombre });
    }

    const estadoRecibidaId = codeToIdMap.get("RECIBIDA") || 1;
    const estadoReparacionId = codeToIdMap.get("REPARACION") || 5;
    const estadoListaEntregaId = codeToIdMap.get("LISTA_ENTREGA") || 7;
    const estadoEntregadaId = codeToIdMap.get("ENTREGADA") || 8;

    if (currentStateId === estadoEntregadaId) {
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

    let requestedStateId: number | undefined = undefined;
    if (accion === "MARCAR_LISTA_ENTREGA") {
      requestedStateId = estadoListaEntregaId;
    } else if (accion === "INICIAR_REPARACION" || accion === "REABRIR_REPARACION") {
      requestedStateId = estadoReparacionId;
    } else if (estado_orden_id !== undefined && estado_orden_id !== null && estado_orden_id !== "") {
      requestedStateId = parseInt(String(estado_orden_id), 10);
    }

    const isStateChangeRequested = requestedStateId !== undefined && requestedStateId !== currentStateId;

    if (!isStateChangeRequested) {
      if (!perms.puede_editar) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            error: "FORBIDDEN",
            title: "No tienes permiso para editar esta orden",
            message: "No tienes permiso para cambiar la configuración de esta orden."
          },
          { status: 403 }
        );
      }

      let validatedMecanicoId = currentOrder.mecanico_id;
      if (body.mecanico_id !== undefined) {
        if (body.mecanico_id === null || body.mecanico_id === "" || body.mecanico_id === 0) {
          validatedMecanicoId = null;
        } else {
          const mId = parseInt(body.mecanico_id, 10);
          if (!isNaN(mId) && mId > 0) {
            const mecCheck = await client.query(
              `SELECT usuario_id FROM admin.usuario WHERE usuario_id = $1 AND empresa_id = $2 AND (estado = 'ACTIVO' OR estado IS NULL) LIMIT 1`,
              [mId, session.empresa_id]
            );
            if (!mecCheck.rows.length) {
              await client.query("ROLLBACK");
              return NextResponse.json({
                error: "INVALID_MECHANIC",
                message: "El mecánico asignado no pertenece a su empresa o no está activo."
              }, { status: 400 });
            }
            validatedMecanicoId = mId;
          }
        }
      }

      const updateRes = await client.query(`
        UPDATE admin.ordenes_trabajo
        SET 
          prioridad_orden_id = COALESCE($1, prioridad_orden_id),
          observacion_interna = COALESCE($2, observacion_interna),
          diagnostico_inicial = COALESCE($3, diagnostico_inicial),
          fecha_entrega_estimada = COALESCE($4, fecha_entrega_estimada),
          mecanico_id = $5,
          fecha_actualizacion = NOW(),
          usuario_actualizacion = $6
        WHERE orden_trabajo_id = $7
        RETURNING *
      `, [
        targetPrioridadId ? parseInt(targetPrioridadId, 10) : null,
        observacion_interna !== undefined ? observacion_interna : null,
        diagnostico_inicial !== undefined ? diagnostico_inicial : null,
        cleanFecha(fecha_entrega_estimada),
        validatedMecanicoId,
        session.usuario_id,
        ordenId
      ]);

      const afterOrder = updateRes.rows[0];
      const diff = computeDiff(currentOrder, afterOrder);

      if (diff.hasChanges) {
        if (currentOrder.mecanico_id !== validatedMecanicoId) {
          await recordUserAudit({
            userId: session.usuario_id,
            accion: "ASIGNAR_MECANICO_ORDEN",
            valorAnterior: { mecanico_id: currentOrder.mecanico_id },
            valorNuevo: { mecanico_id: validatedMecanicoId },
            motivo: "Reasignación de mecánico de orden",
            resultado: "COMPLETADO",
            client,
            throwOnError: true
          });

          await recordUserActivity({
            userId: session.usuario_id,
            modulo: "TALLER_ORDENES",
            evento: "WORK_ORDER_MECHANIC_ASSIGNED",
            descripcion: `Mecánico #${validatedMecanicoId || 'Ninguno'} asignado a la orden #${ordenId}`,
            resultado: "Exitoso",
            req
          });
        }

        await recordUserAudit({
          userId: session.usuario_id,
          accion: "ACTUALIZAR_ORDEN_TRABAJO",
          valorAnterior: diff.valorAnterior,
          valorNuevo: diff.valorNuevo,
          motivo: "Actualización de datos generales de la orden",
          resultado: "COMPLETADO",
          client,
          throwOnError: true
        });
      }

      await client.query("COMMIT");

      await recordUserActivity({
        userId: session.usuario_id,
        modulo: "TALLER_ORDENES",
        evento: "WORK_ORDER_UPDATED",
        descripcion: `Orden #${ordenId} (${currentOrder.codigo_orden}) actualizada exitosamente`,
        resultado: "Exitoso",
        req
      });

      return NextResponse.json({
        success: true,
        message: "Orden de trabajo actualizada correctamente."
      }, { status: 200 });
    }

    const targetStateId = requestedStateId!;

    // State Machine allowed transitions
    const ALLOWED_TRANSITIONS: Record<number, number[]> = {
      [estadoRecibidaId]: [estadoReparacionId],
      [estadoReparacionId]: [estadoListaEntregaId],
      [estadoListaEntregaId]: [estadoReparacionId, estadoEntregadaId],
      [estadoEntregadaId]: []
    };

    if (!ALLOWED_TRANSITIONS[currentStateId]?.includes(targetStateId)) {
      await client.query("ROLLBACK");
      await recordUserActivity({
        userId: session.usuario_id,
        modulo: "TALLER_ORDENES",
        evento: "WORK_ORDER_STATE_CHANGE_DENIED",
        descripcion: `Transición no permitida para orden #${ordenId} de estado #${currentStateId} a #${targetStateId}`,
        resultado: "Denegado",
        req
      });
      return NextResponse.json(
        {
          error: "TRANSITION_NOT_ALLOWED",
          title: "No se puede cambiar el estado",
          message: "El cambio de estado solicitado no está permitido."
        },
        { status: 409 }
      );
    }

    // Permission Checks
    if (targetStateId === estadoReparacionId) {
      if (!perms.puede_mover && !perms.puede_editar && !perms.puede_crear && !perms.puede_reabrir) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "FORBIDDEN", message: "No tienes permiso para reanudar o reabrir la reparación de esta orden." },
          { status: 403 }
        );
      }
    } else if (targetStateId === estadoListaEntregaId) {
      if (!perms.puede_mover && !perms.puede_editar) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "FORBIDDEN", message: "No tienes permiso para cambiar el estado de esta orden." },
          { status: 403 }
        );
      }

      // Check if order has at least one active item (services or products)
      const itemsCountRes = await client.query(`
        SELECT 
          (SELECT COUNT(*)::int FROM admin.orden_servicios WHERE orden_trabajo_id = $1 AND (activo IS DISTINCT FROM false)) AS total_servicios,
          (SELECT COUNT(*)::int FROM admin.orden_productos WHERE orden_trabajo_id = $1) AS total_productos
      `, [ordenId]);

      const totalItems = Number(itemsCountRes.rows[0]?.total_servicios || 0) + Number(itemsCountRes.rows[0]?.total_productos || 0);
      if (totalItems === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            success: false,
            error: "ORDER_WITHOUT_ITEMS",
            message: "La orden debe tener al menos un servicio o repuesto antes de marcarse como lista para entrega."
          },
          { status: 409 }
        );
      }

      // Check incomplete services and active timers
      const combinedIncomplete = await queryIncompleteServicesAndTimers(client, ordenId);

      if (combinedIncomplete.length > 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            success: false,
            error: "ORDER_HAS_INCOMPLETE_SERVICES",
            message: "No puedes marcar la orden como lista para entrega mientras existan servicios pendientes, en proceso o pausados.",
            data: {
              servicios_incompletos: combinedIncomplete
            }
          },
          { status: 409 }
        );
      }
    } else {
      if (!perms.puede_mover && !perms.puede_editar) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "FORBIDDEN", message: "No tienes permiso para cambiar el estado de esta orden." },
          { status: 403 }
        );
      }
    }

    // Query assigned mechanic/user details for history & response
    const effectiveMecanicoId = currentOrder.mecanico_id || session.usuario_id;
    const mecRes = await client.query(`
      SELECT
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), ui.correo_electronico, ('Usuario #' || u.usuario_id::text)) AS nombre_completo,
        c.nombre AS cargo_nombre
      FROM admin.usuario u
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      LEFT JOIN admin.cargo c ON c.cargo_id = ui.cargo_id
      WHERE u.usuario_id = $1
    `, [session.usuario_id]);

    const sessionUserName = mecRes.rows[0]?.nombre_completo || `Usuario #${session.usuario_id}`;
    const mecanicoNombre = sessionUserName;
    const mecanicoCargo = mecRes.rows[0]?.cargo_nombre || "Técnico de Taller";

    let historyComment = "";
    const isReopening = (targetStateId === estadoReparacionId && currentStateId === estadoListaEntregaId);
    let reopenedServiceCode: string | null = null;

    if (targetStateId === estadoEntregadaId) {
      // ATOMIC DELIVERY & INVOICING
      // Validations:
      if (currentStateId !== estadoListaEntregaId) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            success: false,
            error: "ORDER_NOT_READY_FOR_DELIVERY",
            title: "Orden aún no disponible para entrega",
            message: "La orden debe estar lista para entrega antes de entregarla al cliente."
          },
          { status: 409 }
        );
      }

      if (currentOrder.facturado || currentOrder.fecha_facturacion || currentOrder.usuario_facturacion_id) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            success: false,
            error: "ORDER_ALREADY_INVOICED",
            title: "Orden ya procesada",
            message: "Esta orden ya fue entregada y facturada."
          },
          { status: 409 }
        );
      }

      // Check incomplete services and active timers
      const combinedIncompleteDelivery = await queryIncompleteServicesAndTimers(client, ordenId);

      if (combinedIncompleteDelivery.length > 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            success: false,
            error: "ORDER_HAS_INCOMPLETE_SERVICES",
            title: "Orden con servicios pendientes",
            message: "La orden tiene servicios sin completar y no puede entregarse al cliente.",
            data: { servicios_incompletos: combinedIncompleteDelivery }
          },
          { status: 409 }
        );
      }

      const totalOrdenVal = parseFloat(currentOrder.total_orden || 0);
      if (totalOrdenVal <= 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            success: false,
            error: "INVALID_ORDER_TOTAL",
            title: "Total inválido",
            message: "El total de la orden debe ser mayor que cero para realizar la entrega y facturación."
          },
          { status: 409 }
        );
      }

      const updateDelivRes = await client.query(`
        UPDATE admin.ordenes_trabajo
        SET
          estado_orden_id = $1::integer,
          fecha_entrega_real = COALESCE(fecha_entrega_real, NOW()),
          facturado = true,
          fecha_facturacion = NOW(),
          usuario_facturacion_id = $2::integer,
          fecha_actualizacion = NOW(),
          usuario_actualizacion = $2::integer,
          observacion_entrega = COALESCE($3, observacion_entrega)
        WHERE orden_trabajo_id = $4::integer
          AND estado_orden_id = $5::integer
          AND (facturado = false OR facturado IS NULL)
        RETURNING
          orden_trabajo_id,
          codigo_orden,
          estado_orden_id,
          fecha_entrega_real,
          facturado,
          fecha_facturacion,
          usuario_facturacion_id,
          total_orden
      `, [
        estadoEntregadaId,
        session.usuario_id,
        observacion_cambio_estado !== undefined ? observacion_cambio_estado : (observacion_interna !== undefined ? observacion_interna : null),
        ordenId,
        estadoListaEntregaId
      ]);

      if (updateDelivRes.rowCount !== 1) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            success: false,
            error: "ORDER_ALREADY_INVOICED",
            title: "Orden ya procesada",
            message: "La orden no pudo entregarse porque ya fue procesada o su estado cambió."
          },
          { status: 409 }
        );
      }

      const formattedTotal = Number(currentOrder.total_orden || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      historyComment = `Orden entregada al cliente y marcada como facturada por ${sessionUserName}. Total: RD$ ${formattedTotal}.`;

    } else if (targetStateId === estadoReparacionId && currentStateId === estadoListaEntregaId) {
      // REOPENING FROM LISTA_ENTREGA TO REPARACION (REABRIR REPARACION)
      if (currentOrder.facturado || currentOrder.fecha_facturacion || currentOrder.usuario_facturacion_id) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            success: false,
            error: "ORDER_ALREADY_INVOICED",
            title: "Orden ya facturada",
            message: "No se puede reabrir una orden que ya fue facturada y entregada."
          },
          { status: 409 }
        );
      }

      const motivoReapertura = (body.motivo_reapertura || body.observacion || observacion_cambio_estado || observacion_interna || "").trim();

      await client.query(`
        UPDATE admin.ordenes_trabajo
        SET
          estado_orden_id = $1::integer,
          fecha_finalizacion = NULL,
          prioridad_orden_id = COALESCE($2::integer, prioridad_orden_id),
          observacion_interna = COALESCE($3, observacion_interna),
          fecha_actualizacion = NOW(),
          usuario_actualizacion = $4::integer
        WHERE orden_trabajo_id = $5::integer
          AND estado_orden_id = $6::integer
          AND (facturado = false OR facturado IS NULL)
      `, [
        estadoReparacionId,
        targetPrioridadId ? parseInt(targetPrioridadId, 10) : null,
        motivoReapertura ? motivoReapertura : (observacion_interna !== undefined ? observacion_interna : null),
        session.usuario_id,
        ordenId,
        estadoListaEntregaId
      ]);

      // If an optional service was selected to be reopened
      const targetServiceId = body.orden_servicio_id || body.servicio_id_reabrir;
      reopenedServiceCode = null;

      if (targetServiceId !== undefined && targetServiceId !== null && targetServiceId !== "" && !isNaN(Number(targetServiceId))) {
        const srvId = parseInt(String(targetServiceId), 10);
        if (srvId > 0) {
          const srvCheck = await client.query(`
            SELECT os.orden_servicio_id, os.codigo_servicio, os.estado_orden_servicio_id, UPPER(eos.codigo) AS estado_codigo
            FROM admin.orden_servicios os
            LEFT JOIN admin.estado_orden_servicio eos ON os.estado_orden_servicio_id = eos.estado_orden_servicio_id
            WHERE os.orden_servicio_id = $1
              AND os.orden_trabajo_id = $2
              AND (os.activo IS DISTINCT FROM false)
            FOR UPDATE OF os
          `, [srvId, ordenId]);

          if (srvCheck.rows.length === 0) {
            await client.query("ROLLBACK");
            return NextResponse.json(
              {
                success: false,
                error: "SERVICE_NOT_FOUND",
                message: "El servicio seleccionado no pertenece a esta orden o no está activo."
              },
              { status: 404 }
            );
          }

          const srvRow = srvCheck.rows[0];
          if (srvRow.estado_codigo !== "COMPLETADO" && srvRow.estado_codigo !== "FINALIZADO" && Number(srvRow.estado_orden_servicio_id) !== 3) {
            await client.query("ROLLBACK");
            return NextResponse.json(
              {
                success: false,
                error: "SERVICE_NOT_CLOSED",
                message: "El servicio seleccionado no se encuentra en un estado completado/cerrado que permita reapertura."
              },
              { status: 409 }
            );
          }

          await client.query(`
            UPDATE admin.orden_servicios
            SET
              estado_orden_servicio_id = 1,
              fecha_finalizacion = NULL,
              fecha_actualizacion = NOW(),
              usuario_actualizacion = $1::integer
            WHERE orden_servicio_id = $2::integer
          `, [session.usuario_id, srvId]);

          reopenedServiceCode = srvRow.codigo_servicio || `#${srvId}`;
        }
      }

      if (reopenedServiceCode) {
        historyComment = `Orden reabierta para reparación por ${sessionUserName}. También se reabrió el servicio ${reopenedServiceCode}. Motivo: ${motivoReapertura || "Ajustes técnicos"}.`;
      } else {
        historyComment = `Orden reabierta para reparación por ${sessionUserName}. Motivo: ${motivoReapertura || "Ajustes técnicos"}.`;
      }

    } else {
      // Normal state update (e.g. RECIBIDA -> REPARACION or REPARACION -> LISTA_ENTREGA)
      await client.query(`
        UPDATE admin.ordenes_trabajo
        SET
          estado_orden_id = $1::integer,
          mecanico_id = CASE
            WHEN mecanico_id IS NULL THEN $2::integer
            ELSE mecanico_id
          END,
          prioridad_orden_id = COALESCE($3::integer, prioridad_orden_id),
          observacion_interna = COALESCE($4, observacion_interna),
          fecha_inicio_trabajo = COALESCE(fecha_inicio_trabajo, CASE WHEN $1::integer = $5::integer THEN NOW() ELSE NULL END),
          fecha_finalizacion = CASE WHEN $1::integer = $6::integer THEN NOW() WHEN $1::integer = $5::integer THEN NULL ELSE fecha_finalizacion END,
          fecha_actualizacion = NOW(),
          usuario_actualizacion = $2::integer
        WHERE orden_trabajo_id = $7::integer
      `, [
        targetStateId,
        session.usuario_id,
        targetPrioridadId ? parseInt(targetPrioridadId, 10) : null,
        observacion_interna !== undefined ? observacion_interna : null,
        estadoReparacionId,
        estadoListaEntregaId,
        ordenId
      ]);

      historyComment = targetStateId === estadoReparacionId
        ? `Reparación iniciada por ${sessionUserName}`
        : (body.motivo_reapertura || observacion_cambio_estado || observacion_interna || "Cambio de estado de la orden");
    }

    // Insert Single History Record using PostgreSQL sequence
    await client.query(`
      INSERT INTO admin.orden_historial_estado (
        orden_trabajo_id, estado_anterior_id, estado_nuevo_id,
        usuario_cambio, comentario, fecha_cambio, activo, fecha_registro
      ) VALUES (
        $1, $2, $3, $4, $5, NOW(), true, NOW()
      ) RETURNING orden_historial_estado_id
    `, [
      ordenId,
      currentStateId,
      targetStateId,
      session.usuario_id,
      historyComment
    ]);

    const estadoAnteriorObj = idToCodeMap.get(currentStateId) || { id: currentStateId, codigo: "DESCONOCIDO", nombre: "Desconocido" };
    const estadoNuevoObj = idToCodeMap.get(targetStateId) || { id: targetStateId, codigo: "DESCONOCIDO", nombre: "Desconocido" };

    if (isReopening) {
      await recordUserAudit({
        userId: session.usuario_id,
        accion: "REAPERTURA_ORDEN",
        valorAnterior: { estado_orden_id: currentStateId, estado_codigo: estadoAnteriorObj.codigo },
        valorNuevo: { estado_orden_id: targetStateId, estado_codigo: estadoNuevoObj.codigo, servicio_reabierto: reopenedServiceCode || null },
        motivo: historyComment,
        resultado: "COMPLETADO",
        client,
        throwOnError: true
      });
    } else {
      await recordUserAudit({
        userId: session.usuario_id,
        accion: "CAMBIO_ESTADO_ORDEN",
        valorAnterior: { estado_orden_id: currentStateId, estado_codigo: estadoAnteriorObj.codigo },
        valorNuevo: { estado_orden_id: targetStateId, estado_codigo: estadoNuevoObj.codigo },
        motivo: historyComment,
        resultado: "COMPLETADO",
        client,
        throwOnError: true
      });
    }

    await client.query("COMMIT");

    if (isReopening) {
      await recordUserActivity({
        userId: session.usuario_id,
        modulo: "TALLER_ORDENES",
        evento: "WORK_ORDER_REOPENED",
        descripcion: `Orden #${ordenId} reabierta a estado ${estadoNuevoObj.nombre}. Motivo: ${historyComment}`,
        resultado: "Exitoso",
        req
      });
    } else {
      await recordUserActivity({
        userId: session.usuario_id,
        modulo: "TALLER_ORDENES",
        evento: "WORK_ORDER_STATE_CHANGED",
        descripcion: `Estado de orden #${ordenId} cambiado de ${estadoAnteriorObj.nombre} a ${estadoNuevoObj.nombre}`,
        resultado: "Exitoso",
        req
      });
    }

    return NextResponse.json({
      success: true,
      message: targetStateId === estadoReparacionId
        ? "La reparación fue iniciada correctamente."
        : targetStateId === estadoListaEntregaId
        ? "La orden fue marcada como lista para entrega."
        : "Estado de la orden actualizado correctamente.",
      data: {
        orden_id: ordenId,
        orden_trabajo_id: ordenId,
        estado_anterior: {
          id: currentStateId,
          codigo: estadoAnteriorObj.codigo,
          nombre: estadoAnteriorObj.nombre
        },
        estado_actual: {
          id: targetStateId,
          codigo: estadoNuevoObj.codigo,
          nombre: estadoNuevoObj.nombre
        },
        mecanico: {
          usuario_id: effectiveMecanicoId,
          nombre: mecanicoNombre,
          cargo: mecanicoCargo
        }
      }
    }, { status: 200 });

  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("PUT /api/taller/ordenes/[id] exception:", err);

    return NextResponse.json(
      {
        success: false,
        error: "SERVER_ERROR",
        message: err.message || "Error al actualizar el estado de la orden."
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
