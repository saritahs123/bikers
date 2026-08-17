import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession } from "@/lib/workshop-session";

export async function GET(request: NextRequest) {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "NO_SESSION", message: "No hay sesión activa." }, { status: 401 });
    }

    const empresaId = session.empresa_id;
    if (!empresaId) {
      return NextResponse.json({ error: "FORBIDDEN_COMPANY", message: "No se pudo determinar la empresa del usuario." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const rawRange = (searchParams.get("range") || "7d").toLowerCase().trim();
    const rawFrom = searchParams.get("from");
    const rawTo = searchParams.get("to");

    let startDateStr = "";
    let endDateStr = "";
    let canonicalRange = "7d";

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (rawRange === "custom") {
      if (!rawFrom || !rawTo || !dateRegex.test(rawFrom) || !dateRegex.test(rawTo)) {
        return NextResponse.json({
          error: "INVALID_DATE_RANGE",
          message: "Para el rango personalizado debe proveer fechas válidas en formato YYYY-MM-DD."
        }, { status: 400 });
      }

      const dFrom = new Date(rawFrom);
      const dTo = new Date(rawTo);
      if (isNaN(dFrom.getTime()) || isNaN(dTo.getTime())) {
        return NextResponse.json({
          error: "INVALID_DATE_RANGE",
          message: "Las fechas ingresadas no son válidas."
        }, { status: 400 });
      }

      if (dFrom > dTo) {
        return NextResponse.json({
          error: "INVALID_DATE_RANGE",
          message: "La fecha desde no puede ser posterior a la fecha hasta."
        }, { status: 400 });
      }

      const diffDays = Math.ceil((dTo.getTime() - dFrom.getTime()) / (1000 * 3600 * 24));
      if (diffDays > 90) {
        return NextResponse.json({
          error: "RANGE_TOO_LARGE",
          message: "El rango personalizado no puede exceder 90 días."
        }, { status: 400 });
      }

      startDateStr = rawFrom;
      endDateStr = rawTo;
      canonicalRange = "custom";
    } else if (rawRange === "1d" || rawRange === "today") {
      canonicalRange = "1d";
    } else if (rawRange === "14d") {
      canonicalRange = "14d";
    } else if (rawRange === "30d" || rawRange === "month") {
      canonicalRange = "30d";
    } else {
      canonicalRange = "7d";
    }

    // Determine interval for predefined ranges
    if (canonicalRange !== "custom") {
      const datesRes = await query<any>(`
        SELECT 
          (CURRENT_DATE - INTERVAL '${canonicalRange === "1d" ? "0 days" : canonicalRange === "14d" ? "13 days" : canonicalRange === "30d" ? "29 days" : "6 days"}')::date::text AS from_date,
          CURRENT_DATE::text AS to_date
      `);
      startDateStr = datesRes[0].from_date;
      endDateStr = datesRes[0].to_date;
    }

    // --- 1. SNAPSHOT METRICS (ESTADO ACTUAL - INDEPENDIENTES DEL RANGO DE FECHA) ---
    
    // A. Órdenes Activas de la empresa (estado != 8)
    const ordActRows = await query<any>(`
      SELECT 
        COUNT(*)::int AS total_activas,
        COUNT(*) FILTER (WHERE ot.estado_orden_id = 5)::int AS en_proceso,
        COUNT(*) FILTER (WHERE ot.estado_orden_id = 1)::int AS recibidas,
        COUNT(*) FILTER (WHERE ot.estado_orden_id = 7)::int AS listas
      FROM admin.ordenes_trabajo ot
      JOIN admin.usuario u_ot ON u_ot.usuario_id = ot.usuario_registro
      WHERE u_ot.empresa_id = $1
        AND (ot.estado_orden_id IS NULL OR ot.estado_orden_id != 8)
        AND (ot.activo IS DISTINCT FROM false)
    `, [empresaId]);

    const ordenesActivasVal = ordActRows[0]?.total_activas || 0;
    const enProcesoVal = ordActRows[0]?.en_proceso || 0;
    const recibidasVal = ordActRows[0]?.recibidas || 0;
    const listasVal = ordActRows[0]?.listas || 0;

    // B. Carga Operativa Real de Mecánicos
    const mecWorkloadRows = await query<any>(`
      SELECT 
        u.usuario_id AS id,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), CONCAT('Mecánico #', u.usuario_id)) AS nombre,
        COUNT(DISTINCT os.orden_servicio_id)::int AS servicios_activos
      FROM admin.usuario u
      JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      LEFT JOIN admin.orden_servicios os 
        ON os.usuario_id = u.usuario_id 
        AND os.estado_orden_servicio_id NOT IN (3, 4) 
        AND (os.activo IS DISTINCT FROM false)
      WHERE u.empresa_id = $1 AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
      GROUP BY u.usuario_id, ui.nombre, ui.apellido
      ORDER BY servicios_activos DESC, u.usuario_id ASC
      LIMIT 6
    `, [empresaId]);

    const mecanicosCarga = (mecWorkloadRows || []).map((m: any) => ({
      id: m.id,
      nombre: m.nombre,
      servicios: Number(m.servicios_activos || 0)
    }));

    // C. Alertas de Stock Crítico Real
    const stockRows = await query<any>(`
      SELECT 
        p.producto_id AS id,
        p.codigo_producto AS codigo,
        p.nombre,
        COALESCE(ep.cantidad_actual, 0)::numeric AS stock,
        COALESCE(ep.stock_minimo, p.stock_minimo, 0)::numeric AS minimo
      FROM admin.productos p
      LEFT JOIN admin.existencias_producto ep ON p.producto_id = ep.producto_id
      JOIN admin.usuario u_prod ON u_prod.usuario_id = p.usuario_registro
      WHERE u_prod.empresa_id = $1
        AND (p.estado = 'ACTIVO' OR p.estado IS NULL)
        AND (
          (ep.cantidad_actual IS NOT NULL AND ep.cantidad_actual <= ep.stock_minimo)
          OR (ep.cantidad_actual IS NULL AND p.stock_minimo IS NOT NULL)
        )
      LIMIT 5
    `, [empresaId]);

    const lowStockItems = (stockRows || []).map((p: any) => ({
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      stock: Number(p.stock || 0),
      minimo: Number(p.minimo || 0)
    }));


    // --- 2. PERIOD METRICS (MÉTRICAS FILTRADAS POR EL RANGO DE FECHAS SELECCIONADO) ---

    // A. Facturación del Período
    const ingRows = await query<any>(`
      SELECT 
        COALESCE(SUM(f.total_factura), 0)::numeric AS facturacion_total,
        COALESCE(SUM(f.monto_pagado), 0)::numeric AS monto_pagado_total
      FROM admin.facturas f
      JOIN admin.usuario u_fac ON u_fac.usuario_id = f.usuario_registro
      WHERE u_fac.empresa_id = $1
        AND (f.estado IS NULL OR f.estado NOT IN ('ANULADA', 'CANCELADA'))
        AND f.fecha_factura::date BETWEEN $2::date AND $3::date
    `, [empresaId, startDateStr, endDateStr]);

    const facturacionPeriodo = Number(ingRows[0]?.facturacion_total || 0);

    // B. Nuevos Clientes en el Período
    const cliRows = await query<any>(`
      SELECT COUNT(*)::int AS total_clientes
      FROM admin.clientes c
      JOIN admin.usuario u_cli ON u_cli.usuario_id = c.usuario_creacion
      WHERE u_cli.empresa_id = $1
        AND (c.activo IS DISTINCT FROM false)
        AND c.fecha_creacion::date BETWEEN $2::date AND $3::date
    `, [empresaId, startDateStr, endDateStr]);

    const nuevosClientesVal = cliRows[0]?.total_clientes || 0;

    // C. Órdenes Entregadas en el Período (Prioridad 1: ot.fecha_entrega_real, Prioridad 2: historial transition to 8)
    const ordEntregadasRows = await query<any>(`
      SELECT COUNT(ot.orden_trabajo_id)::int AS total_entregadas
      FROM admin.ordenes_trabajo ot
      JOIN admin.usuario u_ot ON u_ot.usuario_id = ot.usuario_registro
      WHERE u_ot.empresa_id = $1
        AND ot.estado_orden_id = 8
        AND (ot.activo IS DISTINCT FROM false)
        AND COALESCE(
          ot.fecha_entrega_real,
          (
            SELECT h.fecha_cambio 
            FROM admin.orden_historial_estado h 
            WHERE h.orden_trabajo_id = ot.orden_trabajo_id 
              AND h.estado_nuevo_id = 8 
              AND (h.activo IS DISTINCT FROM false)
            ORDER BY h.orden_historial_estado_id DESC 
            LIMIT 1
          )
        )::date BETWEEN $2::date AND $3::date
    `, [empresaId, startDateStr, endDateStr]);

    const ordenesEntregadasVal = ordEntregadasRows[0]?.total_entregadas || 0;

    // D. Flujo Operativo Diario (generate_series entre startDateStr y endDateStr)
    const flujoRows = await query<any>(`
      WITH days AS (
        SELECT 
          d::date AS fecha,
          to_char(d, 'Dy') AS day_short,
          to_char(d, 'DD Mon') AS label_fmt
        FROM generate_series($2::date, $3::date, '1 day'::interval) d
      )
      SELECT 
        d.fecha::text AS fecha,
        d.day_short AS day,
        d.label_fmt AS label,
        COUNT(DISTINCT ot_reg.orden_trabajo_id)::int AS cantidad_ordenes,
        COALESCE(SUM(DISTINCT COALESCE(ot_reg.total_orden, ot_reg.subtotal_general, 0)), 0)::numeric AS monto_ordenes,
        COUNT(DISTINCT os_comp.orden_servicio_id)::int AS cantidad_servicios,
        COUNT(DISTINCT ot_ent.orden_trabajo_id)::int AS ordenes_entregadas,
        COUNT(DISTINCT ot_act.orden_trabajo_id)::int AS ordenes_activas
      FROM days d
      LEFT JOIN admin.ordenes_trabajo ot_reg 
        ON DATE(ot_reg.fecha_registro) = d.fecha 
        AND (ot_reg.activo IS DISTINCT FROM false)
        AND ot_reg.usuario_registro IN (SELECT usuario_id FROM admin.usuario WHERE empresa_id = $1)
      LEFT JOIN admin.orden_servicios os_comp 
        ON DATE(COALESCE(os_comp.fecha_finalizacion, os_comp.fecha_registro)) = d.fecha 
        AND os_comp.estado_orden_servicio_id = 3
        AND (os_comp.activo IS DISTINCT FROM false)
        AND os_comp.orden_trabajo_id IN (
          SELECT orden_trabajo_id FROM admin.ordenes_trabajo ot_sub 
          JOIN admin.usuario u_sub ON u_sub.usuario_id = ot_sub.usuario_registro 
          WHERE u_sub.empresa_id = $1
        )
      LEFT JOIN admin.ordenes_trabajo ot_ent 
        ON DATE(COALESCE(
          ot_ent.fecha_entrega_real,
          (
            SELECT h.fecha_cambio 
            FROM admin.orden_historial_estado h 
            WHERE h.orden_trabajo_id = ot_ent.orden_trabajo_id 
              AND h.estado_nuevo_id = 8 
              AND (h.activo IS DISTINCT FROM false)
            ORDER BY h.orden_historial_estado_id DESC 
            LIMIT 1
          )
        )) = d.fecha 
        AND ot_ent.estado_orden_id = 8
        AND (ot_ent.activo IS DISTINCT FROM false)
        AND ot_ent.usuario_registro IN (SELECT usuario_id FROM admin.usuario WHERE empresa_id = $1)
      LEFT JOIN admin.ordenes_trabajo ot_act 
        ON DATE(ot_act.fecha_registro) = d.fecha 
        AND (ot_act.estado_orden_id IS NULL OR ot_act.estado_orden_id != 8)
        AND (ot_act.activo IS DISTINCT FROM false)
        AND ot_act.usuario_registro IN (SELECT usuario_id FROM admin.usuario WHERE empresa_id = $1)
      GROUP BY d.fecha, d.day_short, d.label_fmt
      ORDER BY d.fecha ASC
    `, [empresaId, startDateStr, endDateStr]);

    const dayTranslationMap: Record<string, string> = {
      Mon: "Lun", Tue: "Mar", Wed: "Mié", Thu: "Jue", Fri: "Vie", Sat: "Sáb", Sun: "Dom"
    };

    const weeklyData = (flujoRows || []).map((row: any) => ({
      fecha: row.fecha,
      day: dayTranslationMap[String(row.day).trim()] || row.day,
      label: row.label,
      ordenes: Number(row.cantidad_ordenes || 0),
      ingresos: Number(row.monto_ordenes || 0),
      servicios: Number(row.cantidad_servicios || 0),
      entregadas: Number(row.ordenes_entregadas || 0),
      activas: Number(row.ordenes_activas || 0)
    }));

    // E. Servicios Realizados (Filtrados por estado_orden_servicio_id = 3 COMPLETADO y fecha de finalización)
    const catRows = await query<any>(`
      SELECT 
        COALESCE(ts.nombre, 'Servicio General') AS name,
        COUNT(os.orden_servicio_id)::int AS count_val
      FROM admin.orden_servicios os
      JOIN admin.ordenes_trabajo ot ON os.orden_trabajo_id = ot.orden_trabajo_id
      JOIN admin.usuario u_ot ON u_ot.usuario_id = ot.usuario_registro
      LEFT JOIN admin.tipo_servicio ts ON os.tipo_servicio_id = ts.tipo_servicio_id
      WHERE u_ot.empresa_id = $1
        AND os.estado_orden_servicio_id = 3
        AND (os.activo IS DISTINCT FROM false)
        AND COALESCE(os.fecha_finalizacion, os.fecha_registro)::date BETWEEN $2::date AND $3::date
      GROUP BY COALESCE(ts.nombre, 'Servicio General')
      ORDER BY count_val DESC
      LIMIT 5
    `, [empresaId, startDateStr, endDateStr]);

    const totalServiciosCat = catRows.reduce((sum: number, r: any) => sum + Number(r.count_val || 0), 0);
    const colors = ["#bfce7f", "#38bdf8", "#f59e0b", "#a855f7", "#ec4899"];

    const categoryBreakdown = (catRows || []).map((r: any, idx: number) => {
      const cnt = Number(r.count_val || 0);
      const pct = totalServiciosCat > 0 ? Math.round((cnt / totalServiciosCat) * 100) : 0;
      return {
        name: r.name,
        percentage: pct,
        count: `${cnt} servicio${cnt === 1 ? '' : 's'}`,
        color: colors[idx % colors.length]
      };
    });

    // F. Órdenes Recientes (Últimas 5)
    const recOrdRows = await query<any>(`
      SELECT 
        ot.orden_trabajo_id AS id,
        ot.codigo_orden AS codigo,
        COALESCE(c.nombre_completo, 'Cliente General') AS cliente,
        COALESCE(CONCAT(b.marca, ' ', b.modelo), 'Bicicleta') AS vehiculo,
        COALESCE(eot.nombre, 'En Reparación') AS estado,
        COALESCE(ts.nombre, 'Servicio de Taller') AS servicio,
        COALESCE(u_mec_id.nombre_completo, 'Por asignar') AS mecanico,
        TO_CHAR(ot.fecha_recepcion, 'DD/MM/YYYY') AS tiempo
      FROM admin.ordenes_trabajo ot
      JOIN admin.usuario u_ot ON u_ot.usuario_id = ot.usuario_registro
      LEFT JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
      LEFT JOIN admin.bicicletas b ON ot.bicicleta_id = b.bicicleta_id
      LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
      LEFT JOIN LATERAL (
        SELECT ts_sub.nombre
        FROM admin.orden_servicios os_sub
        LEFT JOIN admin.tipo_servicio ts_sub ON os_sub.tipo_servicio_id = ts_sub.tipo_servicio_id
        WHERE os_sub.orden_trabajo_id = ot.orden_trabajo_id AND (os_sub.activo IS DISTINCT FROM false)
        ORDER BY os_sub.orden_servicio_id ASC
        LIMIT 1
      ) ts ON true
      LEFT JOIN LATERAL (
        SELECT CONCAT(ui.nombre, ' ', ui.apellido) AS nombre_completo
        FROM admin.orden_servicios os
        JOIN admin.usuario_identidad ui ON os.usuario_id = ui.usuario_id
        WHERE os.orden_trabajo_id = ot.orden_trabajo_id AND os.usuario_id IS NOT NULL AND (os.activo IS DISTINCT FROM false)
        LIMIT 1
      ) u_mec_id ON true
      WHERE u_ot.empresa_id = $1
        AND (ot.activo IS DISTINCT FROM false)
      ORDER BY ot.orden_trabajo_id DESC
      LIMIT 5
    `, [empresaId]);

    // Summary calculations
    const totalOrdenesPeriodo = weeklyData.reduce((acc: number, curr: any) => acc + curr.ordenes, 0);
    const montoTotalPeriodo = weeklyData.reduce((acc: number, curr: any) => acc + curr.ingresos, 0);
    const totalServiciosPeriodo = weeklyData.reduce((acc: number, curr: any) => acc + curr.servicios, 0);

    return NextResponse.json({
      success: true,
      range: canonicalRange,
      startDate: startDateStr,
      endDate: endDateStr,
      data: {
        ordenesActivas: ordenesActivasVal,
        desgloseEstados: {
          enProceso: enProcesoVal,
          recibidas: recibidasVal,
          listas: listasVal
        },
        facturacionPeriodo,
        nuevosClientesSemana: nuevosClientesVal,
        ordenesEntregadasPeriodo: ordenesEntregadasVal,
        resumenGrafico: {
          totalOrdenes: totalOrdenesPeriodo,
          montoTotal: montoTotalPeriodo,
          totalServicios: totalServiciosPeriodo,
          totalEntregadas: ordenesEntregadasVal,
          periodoTexto: canonicalRange === 'custom' 
            ? `${startDateStr} a ${endDateStr}` 
            : canonicalRange === '14d' 
            ? 'Últimos 14 días' 
            : canonicalRange === '30d' 
            ? 'Últimos 30 días' 
            : 'Últimos 7 días'
        },
        weeklyData,
        categoryBreakdown,
        recentOrders: recOrdRows || [],
        mecanicosCarga,
        lowStockItems
      }
    });

  } catch (error: any) {
    console.error("GET /api/dashboard Error:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al cargar las métricas del dashboard." }, { status: 500 });
  }
}
