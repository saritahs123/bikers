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

    // Determine interval for predefined ranges in America/Santo_Domingo timezone
    if (canonicalRange !== "custom") {
      const datesRes = await query<any>(`
        SELECT
          ((NOW() AT TIME ZONE 'America/Santo_Domingo')::date - INTERVAL '${canonicalRange === "1d" ? "0 days" : canonicalRange === "14d" ? "13 days" : canonicalRange === "30d" ? "29 days" : "6 days"}')::date::text AS from_date,
          (NOW() AT TIME ZONE 'America/Santo_Domingo')::date::text AS to_date
      `);
      startDateStr = datesRes[0].from_date;
      endDateStr = datesRes[0].to_date;
    }

    // --- 1. SNAPSHOT METRICS (ESTADO ACTUAL - INDEPENDIENTES DEL RANGO DE FECHA) ---
    
    // A. Total de Órdenes y desglose de estados (Snapshot)
    const ordActRows = await query<any>(`
      SELECT 
        COUNT(ot.orden_trabajo_id)::int AS total_ordenes,
        COUNT(ot.orden_trabajo_id) FILTER (WHERE eot.codigo IN ('RECIBIDA', 'REPARACION', 'LISTA_ENTREGA'))::int AS total_activas,
        COUNT(ot.orden_trabajo_id) FILTER (WHERE eot.codigo = 'REPARACION')::int AS en_proceso,
        COUNT(ot.orden_trabajo_id) FILTER (WHERE eot.codigo = 'RECIBIDA')::int AS recibidas,
        COUNT(ot.orden_trabajo_id) FILTER (WHERE eot.codigo = 'LISTA_ENTREGA')::int AS listas,
        COUNT(ot.orden_trabajo_id) FILTER (WHERE eot.codigo = 'ENTREGADA' OR ot.estado_orden_id = 8)::int AS entregadas
      FROM admin.ordenes_trabajo ot
      JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
      LEFT JOIN admin.estado_orden_trabajo eot ON eot.estado_orden_id = ot.estado_orden_id
      WHERE (c.empresa_id = $1 OR ot.usuario_registro IN (SELECT usuario_id FROM admin.usuario WHERE empresa_id = $1))
        AND (ot.activo IS DISTINCT FROM false);
    `, [empresaId]);

    const totalOrdenesVal = ordActRows[0]?.total_ordenes || 0;
    const ordenesActivasVal = ordActRows[0]?.total_activas || 0;
    const enProcesoVal = ordActRows[0]?.en_proceso || 0;
    const recibidasVal = ordActRows[0]?.recibidas || 0;
    const listasVal = ordActRows[0]?.listas || 0;
    const entregadasVal = ordActRows[0]?.entregadas || 0;

    // B. Monto Pendiente de Entrega (Suma total de órdenes activas no entregadas)
    const pendingMontoRows = await query<any>(`
      SELECT
        COALESCE(SUM(COALESCE(ot.total_orden, 0)), 0)::numeric AS monto_pendiente,
        COUNT(ot.orden_trabajo_id)::int AS ordenes_pendientes
      FROM admin.ordenes_trabajo ot
      JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
      LEFT JOIN admin.estado_orden_trabajo eot ON eot.estado_orden_id = ot.estado_orden_id
      WHERE (c.empresa_id = $1 OR ot.usuario_registro IN (SELECT usuario_id FROM admin.usuario WHERE empresa_id = $1))
        AND (ot.activo IS DISTINCT FROM false)
        AND eot.codigo IN ('RECIBIDA', 'REPARACION', 'LISTA_ENTREGA');
    `, [empresaId]);

    const montoPendienteVal = Number(pendingMontoRows[0]?.monto_pendiente || 0);
    const ordenesPendientesVal = Number(pendingMontoRows[0]?.ordenes_pendientes || 0);

    // C. Carga Operativa Real de Mecánicos
    const mecWorkloadRows = await query<any>(`
      SELECT 
        u.usuario_id AS id,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), CONCAT('Técnico #', u.usuario_id)) AS nombre,
        COUNT(DISTINCT ot.orden_trabajo_id) FILTER (WHERE eot.codigo IN ('RECIBIDA', 'REPARACION', 'LISTA_ENTREGA'))::int AS servicios_activos
      FROM admin.usuario u
      JOIN admin.tipo_usuario tu ON tu.tipo_usuario_id = u.tipo_usuario_id
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      LEFT JOIN admin.cargo c ON c.cargo_id = ui.cargo_id
      LEFT JOIN admin.ordenes_trabajo ot ON ot.mecanico_id = u.usuario_id AND (ot.activo IS DISTINCT FROM false)
      LEFT JOIN admin.estado_orden_trabajo eot ON eot.estado_orden_id = ot.estado_orden_id
      WHERE u.empresa_id = $1
        AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
        AND (tu.codigo = 'MECANICO' OR c.nombre ILIKE '%Mecánico%' OR c.nombre ILIKE '%Técnico%')
      GROUP BY u.usuario_id, ui.nombre, ui.apellido
      ORDER BY servicios_activos DESC, u.usuario_id ASC
      LIMIT 6;
    `, [empresaId]);

    const mecanicosCarga = (mecWorkloadRows || []).map((m: any) => ({
      id: m.id,
      nombre: m.nombre,
      servicios: Number(m.servicios_activos || 0)
    }));

    // D. Alertas de Stock Crítico Real
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

    // A. Facturación del Período (Órdenes ENTREGADAS dentro del rango según fecha de entrega/facturación)
    const facturacionRows = await query<any>(`
      SELECT 
        COALESCE(SUM(COALESCE(ot.total_orden, 0)), 0)::numeric AS facturacion_periodo,
        COUNT(ot.orden_trabajo_id)::int AS ordenes_facturadas
      FROM admin.ordenes_trabajo ot
      JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
      JOIN admin.estado_orden_trabajo eot ON eot.estado_orden_id = ot.estado_orden_id
      WHERE (c.empresa_id = $1 OR ot.usuario_registro IN (SELECT usuario_id FROM admin.usuario WHERE empresa_id = $1))
        AND (ot.activo IS DISTINCT FROM false)
        AND (eot.codigo = 'ENTREGADA' OR ot.estado_orden_id = 8)
        AND (COALESCE(ot.fecha_entrega_real, ot.fecha_facturacion, ot.fecha_finalizacion, ot.fecha_registro) AT TIME ZONE 'America/Santo_Domingo')::date BETWEEN $2::date AND $3::date;
    `, [empresaId, startDateStr, endDateStr]);

    const facturacionPeriodo = Number(facturacionRows[0]?.facturacion_periodo || 0);
    const ordenesFacturadasPeriodo = Number(facturacionRows[0]?.ordenes_facturadas || 0);

    // B. Nuevos Clientes en el Período
    const cliRows = await query<any>(`
      SELECT COUNT(*)::int AS total_clientes
      FROM admin.clientes c
      WHERE c.empresa_id = $1
        AND (c.activo IS DISTINCT FROM false)
        AND (c.fecha_creacion AT TIME ZONE 'America/Santo_Domingo')::date BETWEEN $2::date AND $3::date;
    `, [empresaId, startDateStr, endDateStr]);

    const nuevosClientesVal = cliRows[0]?.total_clientes || 0;

    // C. Órdenes Entregadas en el Período
    const ordenesEntregadasVal = ordenesFacturadasPeriodo;

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
        COUNT(DISTINCT ot_reg.orden_trabajo_id)::int AS ordenes_registradas,
        COUNT(DISTINCT ot_ent.orden_trabajo_id)::int AS ordenes_entregadas,
        COUNT(DISTINCT os_comp.orden_servicio_id)::int AS servicios_realizados
      FROM days d
      LEFT JOIN admin.ordenes_trabajo ot_reg
        ON (ot_reg.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date = d.fecha
        AND (ot_reg.activo IS DISTINCT FROM false)
        AND (ot_reg.cliente_id IN (SELECT cliente_id FROM admin.clientes WHERE empresa_id = $1) OR ot_reg.usuario_registro IN (SELECT usuario_id FROM admin.usuario WHERE empresa_id = $1))
      LEFT JOIN admin.ordenes_trabajo ot_ent
        ON (COALESCE(ot_ent.fecha_entrega_real, ot_ent.fecha_facturacion, ot_ent.fecha_finalizacion, ot_ent.fecha_registro) AT TIME ZONE 'America/Santo_Domingo')::date = d.fecha
        AND ot_ent.estado_orden_id = 8
        AND (ot_ent.activo IS DISTINCT FROM false)
        AND (ot_ent.cliente_id IN (SELECT cliente_id FROM admin.clientes WHERE empresa_id = $1) OR ot_ent.usuario_registro IN (SELECT usuario_id FROM admin.usuario WHERE empresa_id = $1))
      LEFT JOIN admin.orden_servicios os_comp
        ON (COALESCE(os_comp.fecha_finalizacion, os_comp.fecha_registro) AT TIME ZONE 'America/Santo_Domingo')::date = d.fecha
        AND (os_comp.estado_orden_servicio_id = 3)
        AND (os_comp.activo IS DISTINCT FROM false)
        AND os_comp.orden_trabajo_id IN (
          SELECT orden_trabajo_id FROM admin.ordenes_trabajo ot_sub
          WHERE (ot_sub.cliente_id IN (SELECT cliente_id FROM admin.clientes WHERE empresa_id = $1) OR ot_sub.usuario_registro IN (SELECT usuario_id FROM admin.usuario WHERE empresa_id = $1))
        )
      GROUP BY d.fecha, d.day_short, d.label_fmt
      ORDER BY d.fecha ASC;
    `, [empresaId, startDateStr, endDateStr]);

    const dayTranslationMap: Record<string, string> = {
      Mon: "Lun", Tue: "Mar", Wed: "Mié", Thu: "Jue", Fri: "Vie", Sat: "Sáb", Sun: "Dom"
    };

    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    const weeklyData = (flujoRows || []).map((row: any) => {
      const parts = String(row.fecha).split("-");
      const monthIdx = parseInt(parts[1] || "1", 10) - 1;
      const dayNum = parts[2] || "";
      const dayShort = dayTranslationMap[String(row.day).trim()] || row.day;
      const etiqueta = `${dayShort} ${dayNum}`;
      const label = `${dayNum} ${monthNames[monthIdx] || ""}`;

      return {
        fecha: row.fecha,
        day: dayShort,
        etiqueta,
        label,
        ordenes_registradas: Number(row.ordenes_registradas || 0),
        ordenes_entregadas: Number(row.ordenes_entregadas || 0),
        servicios_realizados: Number(row.servicios_realizados || 0),
        // For backwards compatibility:
        ordenes: Number(row.ordenes_registradas || 0),
        entregadas: Number(row.ordenes_entregadas || 0),
        servicios: Number(row.servicios_realizados || 0),
        ingresos: 0
      };
    });

    // E. Servicios Realizados (Filtrados por COMPLETADO y fecha de finalización)
    const catRows = await query<any>(`
      SELECT 
        COALESCE(ts.nombre, 'Servicio General') AS name,
        COUNT(os.orden_servicio_id)::int AS count_val
      FROM admin.orden_servicios os
      JOIN admin.ordenes_trabajo ot ON os.orden_trabajo_id = ot.orden_trabajo_id
      JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
      LEFT JOIN admin.tipo_servicio ts ON os.tipo_servicio_id = ts.tipo_servicio_id
      LEFT JOIN admin.estado_orden_servicio eos ON eos.estado_orden_servicio_id = os.estado_orden_servicio_id
      WHERE (c.empresa_id = $1 OR ot.usuario_registro IN (SELECT usuario_id FROM admin.usuario WHERE empresa_id = $1))
        AND (eos.codigo = 'COMPLETADO' OR os.estado_orden_servicio_id = 3)
        AND (os.activo IS DISTINCT FROM false)
        AND (COALESCE(os.fecha_finalizacion, os.fecha_registro) AT TIME ZONE 'America/Santo_Domingo')::date BETWEEN $2::date AND $3::date
      GROUP BY COALESCE(ts.nombre, 'Servicio General')
      ORDER BY count_val DESC
      LIMIT 5;
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
        COALESCE(c.nombre, 'Cliente General') AS cliente,
        COALESCE(CONCAT(b.marca, ' ', b.modelo), 'Bicicleta') AS vehiculo,
        COALESCE(eot.nombre, 'En Reparación') AS estado,
        COALESCE(ts.nombre, 'Servicio de Taller') AS servicio,
        COALESCE(u_mec_id.nombre_completo, 'Por asignar') AS mecanico,
        TO_CHAR(ot.fecha_recepcion AT TIME ZONE 'America/Santo_Domingo', 'DD/MM/YYYY') AS tiempo
      FROM admin.ordenes_trabajo ot
      JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
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
        SELECT CONCAT_WS(' ', ui.nombre, ui.apellido) AS nombre_completo
        FROM admin.usuario u_m
        JOIN admin.usuario_identidad ui ON u_m.usuario_id = ui.usuario_id
        WHERE u_m.usuario_id = ot.mecanico_id
        LIMIT 1
      ) u_mec_id ON true
      WHERE (c.empresa_id = $1 OR ot.usuario_registro IN (SELECT usuario_id FROM admin.usuario WHERE empresa_id = $1))
        AND (ot.activo IS DISTINCT FROM false)
      ORDER BY ot.orden_trabajo_id DESC
      LIMIT 5;
    `, [empresaId]);

    // Summary calculations
    const totalOrdenesRegistradas = weeklyData.reduce((acc: number, curr: any) => acc + curr.ordenes_registradas, 0);
    const totalOrdenesEntregadas = weeklyData.reduce((acc: number, curr: any) => acc + curr.ordenes_entregadas, 0);
    const totalServiciosPeriodo = weeklyData.reduce((acc: number, curr: any) => acc + curr.servicios_realizados, 0);

    const numDays = Math.max(1, weeklyData.length);
    const promedioDiario = Number((totalOrdenesRegistradas / numDays).toFixed(2));

    // Dia de mayor actividad (most recent if tie)
    let maxCount = 0;
    let maxDayObj: any = null;
    for (const r of weeklyData) {
      if (r.ordenes_registradas >= maxCount && r.ordenes_registradas > 0) {
        maxCount = r.ordenes_registradas;
        maxDayObj = r;
      }
    }

    const diaMayorActividad = maxDayObj
      ? {
          fecha: maxDayObj.fecha,
          etiqueta: maxDayObj.etiqueta,
          cantidad: maxCount
        }
      : {
          fecha: "",
          etiqueta: "Sin actividad",
          cantidad: 0
        };

    return NextResponse.json({
      success: true,
      range: canonicalRange,
      startDate: startDateStr,
      endDate: endDateStr,
      data: {
        totalOrdenes: totalOrdenesVal,
        total_ordenes: totalOrdenesVal,
        ordenesActivas: ordenesActivasVal,
        desgloseEstados: {
          enProceso: enProcesoVal,
          recibidas: recibidasVal,
          listas: listasVal,
          entregadas: entregadasVal
        },
        facturacionPeriodo,
        facturacion_periodo: facturacionPeriodo,
        ordenes_facturadas_periodo: ordenesFacturadasPeriodo,
        montoPendienteEntrega: montoPendienteVal,
        monto_pendiente_entrega: montoPendienteVal,
        ordenesPendientesEntrega: ordenesPendientesVal,
        ordenes_pendientes_entrega: ordenesPendientesVal,
        nuevosClientesSemana: nuevosClientesVal,
        ordenesEntregadasPeriodo: ordenesEntregadasVal,
        resumenGrafico: {
          totalOrdenes: totalOrdenesRegistradas,
          totalOrdenesRegistradas,
          totalOrdenesEntregadas,
          totalEntregadas: totalOrdenesEntregadas,
          totalServicios: totalServiciosPeriodo,
          promedioDiario,
          diaMayorActividad,
          facturacionPeriodo,
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
