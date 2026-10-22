import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getScreenPermissions } from "@/lib/workshop-session";

interface DateRow {
  from_date: string;
  to_date: string;
}

interface PrevPeriodRow {
  prev_start: string;
  prev_end: string;
}

interface EstadoRow {
  estado_orden_id: number;
  codigo: string;
  nombre: string;
  color_estado?: string;
  orden_visual?: number;
}

interface TipoServicioRow {
  tipo_servicio_id: number;
  nombre: string;
  categoria_nombre: string;
}

interface TipoPagoRow {
  tipo_pago_id: number;
  codigo: string;
  nombre: string;
}

interface OrdActRow {
  total_ordenes: number;
  total_activas: number;
  en_proceso: number;
  recibidas: number;
  listas: number;
  entregadas: number;
}

interface OrderKpisRow {
  total_ordenes: number;
  clientes_unicos: number;
  total_servicios: number;
  total_productos: number;
  monto_total_ordenes?: string | number;
}

interface DeliveredKpisRow {
  total_entregadas: number;
  total_servicios: number;
  total_productos: number;
}

interface ActiveWorkshopKpisRow {
  total_activas: number;
  pendientes: number;
  en_reparacion: number;
  para_entrega: number;
  en_hold: number;
}

interface TotalClientesRow {
  total_clientes: number;
}

interface CuentasPorPagarRow {
  cuentas_por_pagar: string | number;
  total_compras_pendientes?: number;
}

interface FacturacionPeriodoRow {
  total_facturado: string | number;
  facturas_emitidas_count: number;
  ordenes_facturadas_count: number;
  cuentas_por_cobrar: string | number;
  facturas_pendientes_count: number;
  total_facturado_periodo?: string | number;
}

interface PendingBillingRow {
  monto_pendiente_facturar: string | number;
  ordenes_pendientes_facturar_count: number;
}


interface FlujoRow {
  fecha: string;
  day: string;
  label: string;
  ordenes_registradas: number;
  ordenes_entregadas: number;
  servicios_realizados: number;
}

interface OrderByTypeRow {
  tipo_servicio_id: number;
  name: string;
  categoria: string;
  count_val: number;
}

interface AssociatedOrderRow {
  id: number;
  codigo: string;
  cliente: string;
  vehiculo: string;
  estado: string;
  estado_codigo: string;
  color_estado: string;
  servicio: string;
  mecanico: string;
  fecha: string;
  fecha_iso: string;
  fecha_registro_iso?: string;
  fecha_entrega_iso?: string | null;
  total: number;
}

interface RawPaymentRow {
  pago_id: number;
  fecha: string;
  fecha_fmt: string;
  monto_total_pago: number | string;
  tipo_pago_id: number;
  metodo_codigo: string;
  metodo_nombre: string;
  factura_id: number;
  numero_factura: string;
  fecha_factura?: string;
  orden_trabajo_id: number | null;
  codigo_orden: string | null;
  fecha_orden?: string | null;
  cliente_nombre: string;
  origen_principal: string;
  monto_servicios_taller: number | string;
  monto_repuestos: number | string;
  monto_venta_directa: number | string;
}

interface FilteredPayment extends RawPaymentRow {
  monto_efectivo: number;
}

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

    const perms = await getScreenPermissions("/", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No posees permisos para acceder al Dashboard." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const rawFrom = searchParams.get("from")?.trim() || "";
    const rawTo = searchParams.get("to")?.trim() || "";

    // Optional filters for Orders
    const rawEstadoId = searchParams.get("estado_id")?.trim() || "";
    const rawTipoOrdenId = searchParams.get("tipo_orden_id")?.trim() || "";

    // Optional filters for Income
    const rawMetodoPagoId = searchParams.get("metodo_pago_id")?.trim() || "";
    const rawOrigen = (searchParams.get("origen") || "TODOS").toUpperCase().trim();

    let startDateStr = "";
    let endDateStr = "";

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (rawFrom || rawTo) {
      if (!rawFrom || !rawTo || !dateRegex.test(rawFrom) || !dateRegex.test(rawTo)) {
        return NextResponse.json({
          error: "INVALID_DATE_RANGE",
          message: "Debe proveer fechas válidas en formato YYYY-MM-DD para 'Desde' y 'Hasta'."
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
          message: "La fecha 'Desde' no puede ser posterior a la fecha 'Hasta'."
        }, { status: 400 });
      }

      const diffDays = Math.ceil((dTo.getTime() - dFrom.getTime()) / (1000 * 3600 * 24));
      if (diffDays > 365) {
        return NextResponse.json({
          error: "RANGE_TOO_LARGE",
          message: "El rango de fechas no puede exceder 365 días."
        }, { status: 400 });
      }

      startDateStr = rawFrom;
      endDateStr = rawTo;
    } else {
      // Default to last 7 calendar days in America/Santo_Domingo (including today)
      const datesRes = await query<DateRow>(`
        SELECT
          ((NOW() AT TIME ZONE 'America/Santo_Domingo')::date - INTERVAL '6 days')::date::text AS from_date,
          (NOW() AT TIME ZONE 'America/Santo_Domingo')::date::text AS to_date
      `);
      startDateStr = datesRes[0].from_date;
      endDateStr = datesRes[0].to_date;
    }

    // Calculate Previous Period Dates for comparison
    const prevPeriodRes = await query<PrevPeriodRow>(`
      SELECT
        ($1::date - ($2::date - $1::date + 1))::date::text AS prev_start,
        ($1::date - 1)::date::text AS prev_end
    `, [startDateStr, endDateStr]);
    const prevStartDateStr = prevPeriodRes[0]?.prev_start || startDateStr;
    const prevEndDateStr = prevPeriodRes[0]?.prev_end || endDateStr;

    // --- 0. CATALOGS FOR DASHBOARD FILTERS ---
    const [estadosCatalog, tiposOrdenCatalog, metodosPagoCatalog] = await Promise.all([
      query<EstadoRow>(`
        SELECT estado_orden_id, codigo, nombre, color_estado, orden_visual
        FROM admin.estado_orden_trabajo
        WHERE activo = true
        ORDER BY orden_visual ASC
      `),
      query<TipoServicioRow>(`
        SELECT DISTINCT ts.tipo_servicio_id, ts.nombre, COALESCE(cs.nombre, 'General') AS categoria_nombre
        FROM admin.tipo_servicio ts
        LEFT JOIN admin.categoria_servicio cs ON ts.categoria_servicio_id = cs.categoria_servicio_id
        WHERE ts.activo = true
        ORDER BY ts.nombre ASC
      `),
      query<TipoPagoRow>(`
        SELECT tipo_pago_id, codigo, nombre
        FROM admin.tipo_pago
        WHERE estado = 'ACTIVO'
        ORDER BY tipo_pago_id ASC
      `)
    ]);

    const origenesCatalog = [
      { id: "TODOS", nombre: "Todos los orígenes" },
      { id: "VENTA_DIRECTA", nombre: "Venta Directa" },
      { id: "TALLER", nombre: "Órdenes de Taller" },
      { id: "REPUESTOS", nombre: "Repuestos" }
    ];

    // --- 1. SNAPSHOT METRICS (ESTADO ACTUAL GLOBAL DE LA EMPRESA) ---
    const [ordActRows, totalClientesRows, cxpRows] = await Promise.all([
      query<OrdActRow>(`
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
      `, [empresaId]),
      query<TotalClientesRow>(`
        SELECT COUNT(*)::int AS total_clientes
        FROM admin.clientes c
        WHERE c.empresa_id = $1
          AND c.fecha_eliminacion IS NULL
          AND (c.activo IS DISTINCT FROM false);
      `, [empresaId]),
      query<CuentasPorPagarRow>(`
        SELECT
          COALESCE(SUM(oc.total_compra), 0)::numeric AS cuentas_por_pagar,
          COUNT(oc.orden_compra_id)::int AS total_compras_pendientes
        FROM admin.orden_compra oc
        JOIN admin.proveedores p ON oc.proveedor_id = p.proveedor_id
        JOIN admin.estado_compra ec ON oc.estado_compra_id = ec.estado_compra_id
        WHERE p.empresa_id = $1
          AND ec.codigo NOT IN ('ANULADA', 'CERRADA');
      `, [empresaId])
    ]);

    const totalOrdenesVal = ordActRows[0]?.total_ordenes || 0;
    const totalClientesVal = totalClientesRows[0]?.total_clientes || 0;
    const cuentasPorPagarVal = Number(cxpRows[0]?.cuentas_por_pagar || 0);
    const cuentasPorPagarComprasPendientes = Number(cxpRows[0]?.total_compras_pendientes || 0);

    // --- 2. ÓRDENES DE TRABAJO: MÉTRICAS Y GRÁFICOS (FILTRADOS) ---

    // Build filter clauses for orders
    const orderFilterConditions: string[] = [
      `(ot.cliente_id IN (SELECT cliente_id FROM admin.clientes WHERE empresa_id = $1) OR ot.usuario_registro IN (SELECT usuario_id FROM admin.usuario WHERE empresa_id = $1))`,
      `(ot.activo IS DISTINCT FROM false)`
    ];
    const orderQueryParams: (string | number)[] = [empresaId, startDateStr, endDateStr];

    if (rawEstadoId && !isNaN(Number(rawEstadoId))) {
      orderQueryParams.push(Number(rawEstadoId));
      orderFilterConditions.push(`ot.estado_orden_id = $${orderQueryParams.length}`);
    }

    if (rawTipoOrdenId && !isNaN(Number(rawTipoOrdenId))) {
      orderQueryParams.push(Number(rawTipoOrdenId));
      orderFilterConditions.push(`ot.orden_trabajo_id IN (
        SELECT os_f.orden_trabajo_id FROM admin.orden_servicios os_f
        WHERE os_f.tipo_servicio_id = $${orderQueryParams.length} AND (os_f.activo IS DISTINCT FROM false)
      )`);
    }

    const orderWhereSql = orderFilterConditions.join(" AND ");

    // Filter conditions for workshop active capacity (filtered by state & service type without date boundaries)
    const workshopFilterConditions: string[] = [
      `(ot.cliente_id IN (SELECT cliente_id FROM admin.clientes WHERE empresa_id = $1) OR ot.usuario_registro IN (SELECT usuario_id FROM admin.usuario WHERE empresa_id = $1))`,
      `(ot.activo IS DISTINCT FROM false)`
    ];
    const workshopQueryParams: (string | number)[] = [empresaId];

    if (rawEstadoId && !isNaN(Number(rawEstadoId))) {
      workshopQueryParams.push(Number(rawEstadoId));
      workshopFilterConditions.push(`ot.estado_orden_id = $${workshopQueryParams.length}`);
    }

    if (rawTipoOrdenId && !isNaN(Number(rawTipoOrdenId))) {
      workshopQueryParams.push(Number(rawTipoOrdenId));
      workshopFilterConditions.push(`ot.orden_trabajo_id IN (
        SELECT os_f.orden_trabajo_id FROM admin.orden_servicios os_f
        WHERE os_f.tipo_servicio_id = $${workshopQueryParams.length} AND (os_f.activo IS DISTINCT FROM false)
      )`);
    }

    const workshopWhereSql = workshopFilterConditions.join(" AND ");

    // A. Gráfico de cantidad de órdenes por día (Registradas y Entregadas)
    const flujoRows = await query<FlujoRow>(`
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
        AND ${orderWhereSql.replace(/ot\./g, "ot_reg.")}
      LEFT JOIN admin.ordenes_trabajo ot_ent
        ON (
          (ot_ent.fecha_entrega_real IS NOT NULL AND (ot_ent.fecha_entrega_real AT TIME ZONE 'America/Santo_Domingo')::date = d.fecha)
          OR (ot_ent.fecha_entrega_real IS NULL AND (ot_ent.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date = d.fecha)
        )
        AND (ot_ent.estado_orden_id = 8 OR ot_ent.estado_orden_id IN (SELECT estado_orden_id FROM admin.estado_orden_trabajo WHERE codigo = 'ENTREGADA'))
        AND (ot_ent.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date BETWEEN $2::date AND $3::date
        AND ${orderWhereSql.replace(/ot\./g, "ot_ent.")}
      LEFT JOIN admin.orden_servicios os_comp
        ON (COALESCE(os_comp.fecha_finalizacion, os_comp.fecha_registro) AT TIME ZONE 'America/Santo_Domingo')::date = d.fecha
        AND (os_comp.estado_orden_servicio_id = 3)
        AND (os_comp.activo IS DISTINCT FROM false)
        ${rawTipoOrdenId && !isNaN(Number(rawTipoOrdenId)) ? `AND os_comp.tipo_servicio_id = ${Number(rawTipoOrdenId)}` : ''}
        AND os_comp.orden_trabajo_id IN (
          SELECT ot_sub.orden_trabajo_id FROM admin.ordenes_trabajo ot_sub
          WHERE ${orderWhereSql.replace(/ot\./g, "ot_sub.")}
        )
      GROUP BY d.fecha, d.day_short, d.label_fmt
      ORDER BY d.fecha ASC;
    `, orderQueryParams);

    const dayTranslationMap: Record<string, string> = {
      Mon: "Lun", Tue: "Mar", Wed: "Mié", Thu: "Jue", Fri: "Vie", Sat: "Sáb", Sun: "Dom"
    };

    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    const weeklyData = (flujoRows || []).map((row: FlujoRow) => {
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
        // Compatibility:
        total_ordenes: Number(row.ordenes_registradas || 0),
        ordenes: Number(row.ordenes_registradas || 0),
        entregadas: Number(row.ordenes_entregadas || 0),
        servicios: Number(row.servicios_realizados || 0),
        ingresos: 0
      };
    });

    // B. Gráfico de cantidad de órdenes por tipo (Servicios / Categoría)
    const ordersByTypeRows = await query<OrderByTypeRow>(`
      SELECT
        ts.tipo_servicio_id,
        COALESCE(ts.nombre, 'Servicio General') AS name,
        COALESCE(cs.nombre, 'General') AS categoria,
        COUNT(DISTINCT ot.orden_trabajo_id)::int AS count_val
      FROM admin.orden_servicios os
      JOIN admin.ordenes_trabajo ot ON os.orden_trabajo_id = ot.orden_trabajo_id
      LEFT JOIN admin.tipo_servicio ts ON os.tipo_servicio_id = ts.tipo_servicio_id
      LEFT JOIN admin.categoria_servicio cs ON ts.categoria_servicio_id = cs.categoria_servicio_id
      WHERE ${orderWhereSql}
        AND (os.activo IS DISTINCT FROM false)
        ${rawTipoOrdenId && !isNaN(Number(rawTipoOrdenId)) ? `AND os.tipo_servicio_id = ${Number(rawTipoOrdenId)}` : ''}
        AND (ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date BETWEEN $2::date AND $3::date
      GROUP BY ts.tipo_servicio_id, COALESCE(ts.nombre, 'Servicio General'), cs.nombre
      ORDER BY count_val DESC
      LIMIT 10;
    `, orderQueryParams);

    const totalOrdersByType = ordersByTypeRows.reduce((sum: number, r: OrderByTypeRow) => sum + Number(r.count_val || 0), 0);
    const chartPalette = ["#bfce7f", "#38bdf8", "#f59e0b", "#a855f7", "#ec4899", "#10b981", "#6366f1", "#f97316"];

    const ordersByTypeData = (ordersByTypeRows || []).map((r: OrderByTypeRow, idx: number) => {
      const cnt = Number(r.count_val || 0);
      const pct = totalOrdersByType > 0 ? Math.round((cnt / totalOrdersByType) * 100) : 0;
      return {
        tipo_servicio_id: r.tipo_servicio_id,
        name: r.name,
        categoria: r.categoria,
        count: cnt,
        percentage: pct,
        color: chartPalette[idx % chartPalette.length]
      };
    });

    // Compatibility categoryBreakdown for existing UI
    const categoryBreakdown = ordersByTypeData.map((d) => ({
      name: d.name,
      percentage: d.percentage,
      count: `${d.count} orden${d.count === 1 ? '' : 'es'}`,
      color: d.color
    }));

    // C. Consulta de órdenes asociadas a los filtros aplicados (Permite consultar las órdenes)
    const associatedOrdersRows = await query<AssociatedOrderRow>(`
      SELECT
        ot.orden_trabajo_id AS id,
        ot.codigo_orden AS codigo,
        COALESCE(c.nombre, 'Cliente General') AS cliente,
        COALESCE(CONCAT(b.marca, ' ', b.modelo), 'Bicicleta') AS vehiculo,
        COALESCE(eot.nombre, 'En Reparación') AS estado,
        COALESCE(eot.codigo, 'REPARACION') AS estado_codigo,
        COALESCE(eot.color_estado, '#38bdf8') AS color_estado,
        COALESCE(ts.nombre, 'Servicio de Taller') AS servicio,
        COALESCE(u_mec.nombre_completo, 'Por asignar') AS mecanico,
        COALESCE(
          CASE
            WHEN (eot.codigo = 'ENTREGADA' OR ot.estado_orden_id = 8) AND ot.fecha_entrega_real IS NOT NULL
              THEN TO_CHAR(ot.fecha_entrega_real AT TIME ZONE 'America/Santo_Domingo', 'DD/MM/YYYY')
            ELSE TO_CHAR(ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo', 'DD/MM/YYYY')
          END,
          TO_CHAR(ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo', 'DD/MM/YYYY')
        ) AS fecha,
        COALESCE(
          CASE
            WHEN (eot.codigo = 'ENTREGADA' OR ot.estado_orden_id = 8) AND ot.fecha_entrega_real IS NOT NULL
              THEN (ot.fecha_entrega_real AT TIME ZONE 'America/Santo_Domingo')::date::text
            ELSE (ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date::text
          END,
          (ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date::text
        ) AS fecha_iso,
        (ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date::text AS fecha_registro_iso,
        CASE
          WHEN ot.fecha_entrega_real IS NOT NULL
            THEN (ot.fecha_entrega_real AT TIME ZONE 'America/Santo_Domingo')::date::text
          ELSE NULL
        END AS fecha_entrega_iso,
        COALESCE(ot.total_orden, 0)::numeric(12,2) AS total
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
      ) u_mec ON true
      WHERE ${orderWhereSql}
        AND (ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date BETWEEN $2::date AND $3::date
      ORDER BY ot.fecha_registro DESC, ot.orden_trabajo_id DESC
      LIMIT 100;
    `, orderQueryParams);

    // Query exact KPIs for the 5 cards:
    const [regKpisRows, delKpisRows, actKpisRows, workshopActivesFilteredRows, scopeCliRows] = await Promise.all([
      // 1. Registered orders in period with actual services & products count
      query<OrderKpisRow>(`
        WITH target_orders AS (
          SELECT DISTINCT ot.orden_trabajo_id, ot.cliente_id,
            COALESCE(ot.total_orden, (COALESCE(ot.subtotal_servicios, 0) + COALESCE(ot.subtotal_productos, 0) - COALESCE(ot.descuento_servicios, 0) - COALESCE(ot.descuento_productos, 0) + COALESCE(ot.impuesto, 0))) AS total_orden
          FROM admin.ordenes_trabajo ot
          JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
          WHERE ${orderWhereSql}
            AND (ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date BETWEEN $2::date AND $3::date
        )
        SELECT
          (SELECT COUNT(*)::int FROM target_orders) AS total_ordenes,
          (SELECT COALESCE(SUM(total_orden), 0)::numeric FROM target_orders) AS monto_total_ordenes,
          (SELECT COUNT(DISTINCT cliente_id)::int FROM target_orders) AS clientes_unicos,
          (SELECT COUNT(*)::int FROM admin.orden_servicios os
           WHERE os.orden_trabajo_id IN (SELECT orden_trabajo_id FROM target_orders)
             AND (os.activo IS DISTINCT FROM false)
             ${rawTipoOrdenId && !isNaN(Number(rawTipoOrdenId)) ? `AND os.tipo_servicio_id = ${Number(rawTipoOrdenId)}` : ''}) AS total_servicios,
          (SELECT COUNT(*)::int FROM admin.orden_productos op
           WHERE op.orden_trabajo_id IN (SELECT orden_trabajo_id FROM target_orders)) AS total_productos;
      `, orderQueryParams),

      // 2. Delivered orders belonging to period cohort
      query<DeliveredKpisRow>(`
        WITH delivered_orders AS (
          SELECT DISTINCT ot.orden_trabajo_id
          FROM admin.ordenes_trabajo ot
          JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
          LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
          WHERE ${orderWhereSql}
            AND (ot.estado_orden_id = 8 OR eot.codigo = 'ENTREGADA')
            AND (ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date BETWEEN $2::date AND $3::date
        )
        SELECT
          (SELECT COUNT(*)::int FROM delivered_orders) AS total_entregadas,
          (SELECT COUNT(*)::int FROM admin.orden_servicios os
           WHERE os.orden_trabajo_id IN (SELECT orden_trabajo_id FROM delivered_orders)
             AND (os.activo IS DISTINCT FROM false)
             ${rawTipoOrdenId && !isNaN(Number(rawTipoOrdenId)) ? `AND os.tipo_servicio_id = ${Number(rawTipoOrdenId)}` : ''}) AS total_servicios,
          (SELECT COUNT(*)::int FROM admin.orden_productos op
           WHERE op.orden_trabajo_id IN (SELECT orden_trabajo_id FROM delivered_orders)) AS total_productos;
      `, orderQueryParams),

      // 3. Active in workshop by real states: Pendientes (RECIBIDA), En reparación (REPARACION), Para entrega (LISTA_ENTREGA)
      query<ActiveWorkshopKpisRow>(`
        SELECT
          COUNT(DISTINCT ot.orden_trabajo_id) FILTER (WHERE eot.codigo IN ('RECIBIDA', 'HOLD', 'REPARACION', 'LISTA_ENTREGA'))::int AS total_activas,
          COUNT(DISTINCT ot.orden_trabajo_id) FILTER (WHERE eot.codigo = 'RECIBIDA')::int AS pendientes,
          COUNT(DISTINCT ot.orden_trabajo_id) FILTER (WHERE eot.codigo = 'REPARACION')::int AS en_reparacion,
          COUNT(DISTINCT ot.orden_trabajo_id) FILTER (WHERE eot.codigo = 'LISTA_ENTREGA')::int AS para_entrega,
          COUNT(DISTINCT ot.orden_trabajo_id) FILTER (WHERE eot.codigo = 'HOLD')::int AS en_hold
        FROM admin.ordenes_trabajo ot
        JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
        LEFT JOIN admin.estado_orden_trabajo eot ON eot.estado_orden_id = ot.estado_orden_id
        WHERE ${orderWhereSql}
          AND (ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date BETWEEN $2::date AND $3::date;
      `, orderQueryParams),

      // 4. Workshop active orders matching filters across whole shop
      query<ActiveWorkshopKpisRow>(`
        SELECT
          COUNT(DISTINCT ot.orden_trabajo_id) FILTER (WHERE eot.codigo IN ('RECIBIDA', 'HOLD', 'REPARACION', 'LISTA_ENTREGA'))::int AS total_activas,
          COUNT(DISTINCT ot.orden_trabajo_id) FILTER (WHERE eot.codigo = 'RECIBIDA')::int AS pendientes,
          COUNT(DISTINCT ot.orden_trabajo_id) FILTER (WHERE eot.codigo = 'REPARACION')::int AS en_reparacion,
          COUNT(DISTINCT ot.orden_trabajo_id) FILTER (WHERE eot.codigo = 'LISTA_ENTREGA')::int AS para_entrega,
          COUNT(DISTINCT ot.orden_trabajo_id) FILTER (WHERE eot.codigo = 'HOLD')::int AS en_hold
        FROM admin.ordenes_trabajo ot
        JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
        LEFT JOIN admin.estado_orden_trabajo eot ON eot.estado_orden_id = ot.estado_orden_id
        WHERE ${workshopWhereSql};
      `, workshopQueryParams),

      // 5. Unique clients associated with the orders meeting the filters in the period
      query<{ clientes_unicos: number }>(`
        SELECT COUNT(DISTINCT ot.cliente_id)::int AS clientes_unicos
        FROM admin.ordenes_trabajo ot
        JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
        WHERE ${orderWhereSql}
          AND (ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date BETWEEN $2::date AND $3::date;
      `, orderQueryParams)
    ]);

    const totalOrdenesPeriodo = regKpisRows[0]?.total_ordenes || 0;
    const montoTotalOrdenesPeriodo = Number(regKpisRows[0]?.monto_total_ordenes || 0);
    const clientesUnicosPeriodo = scopeCliRows[0]?.clientes_unicos || regKpisRows[0]?.clientes_unicos || 0;
    const totalServiciosPeriodo = regKpisRows[0]?.total_servicios || 0;
    const totalProductosPeriodo = regKpisRows[0]?.total_productos || 0;

    const totalEntregadasPeriodo = delKpisRows[0]?.total_entregadas || 0;
    const totalServiciosEntregadasPeriodo = delKpisRows[0]?.total_servicios || 0;
    const totalProductosEntregadasPeriodo = delKpisRows[0]?.total_productos || 0;

    const totalActivasPeriodo = actKpisRows[0]?.total_activas || 0;
    const pendientesVal = actKpisRows[0]?.pendientes || 0;
    const enReparacionVal = actKpisRows[0]?.en_reparacion || 0;
    const paraEntregaVal = actKpisRows[0]?.para_entrega || 0;
    const enHoldVal = actKpisRows[0]?.en_hold || 0;

    const workshopTotalActivas = workshopActivesFilteredRows[0]?.total_activas || 0;

    // Daily average rounded UP with Math.ceil to next integer (as required by specification)
    const numDaysPeriodo = Math.max(1, weeklyData.length);
    const promedioDiarioEntero = totalOrdenesPeriodo > 0 ? Math.ceil(totalOrdenesPeriodo / numDaysPeriodo) : 0;

    let maxOrderCount = 0;
    let maxOrderDayObj: FlujoRow | null = null;
    for (const r of weeklyData) {
      if (r.ordenes_registradas >= maxOrderCount && r.ordenes_registradas > 0) {
        maxOrderCount = r.ordenes_registradas;
        maxOrderDayObj = r;
      }
    }

    const diaMayorActividad = maxOrderDayObj
      ? {
          fecha: maxOrderDayObj.fecha,
          etiqueta: maxOrderDayObj.label ? `${maxOrderDayObj.day} ${maxOrderDayObj.label}` : maxOrderDayObj.fecha,
          cantidad: maxOrderCount
        }
      : {
          fecha: "",
          etiqueta: "Sin actividad",
          cantidad: 0
        };

    // --- 3. INGRESOS: MÉTRICAS, CLASIFICACIONES Y GRÁFICOS (PAGOS REALES) ---

    // Build filter clauses for payments
    const incomeFilterConditions: string[] = [
      `f.empresa_id = $1`,
      `f.estado != 'ANULADA'`,
      `(p.estado = 'APLICADO' OR p.estado IS NULL)`
    ];
    const incomeQueryParams: (string | number)[] = [empresaId, startDateStr, endDateStr];

    if (rawMetodoPagoId && !isNaN(Number(rawMetodoPagoId))) {
      incomeQueryParams.push(Number(rawMetodoPagoId));
      incomeFilterConditions.push(`p.tipo_pago_id = $${incomeQueryParams.length}`);
    }

    const incomeWhereSql = incomeFilterConditions.join(" AND ");

    // Query all valid payments in current period with their share calculation
    const currentPaymentsQuery = `
      WITH invoice_shares AS (
        SELECT
          f.factura_id,
          f.orden_trabajo_id,
          f.estado AS estado_factura,
          f.empresa_id,
          (f.fecha_factura AT TIME ZONE 'America/Santo_Domingo')::date AS fecha_factura_date,
          COALESCE(SUM(CASE WHEN df.tipo_detalle = 'SERVICIO' THEN df.subtotal ELSE 0 END), 0) AS subtotal_servicios,
          COALESCE(SUM(CASE WHEN df.tipo_detalle = 'PRODUCTO' AND f.orden_trabajo_id IS NOT NULL THEN df.subtotal ELSE 0 END), 0) AS subtotal_repuestos,
          COALESCE(SUM(CASE WHEN df.tipo_detalle = 'PRODUCTO' AND f.orden_trabajo_id IS NULL THEN df.subtotal ELSE 0 END), 0) AS subtotal_venta_directa,
          COALESCE(SUM(df.subtotal), 0) AS subtotal_items
        FROM admin.facturas f
        LEFT JOIN admin.detalle_factura df ON f.factura_id = df.factura_id
        WHERE f.empresa_id = $1 AND f.estado != 'ANULADA'
        GROUP BY f.factura_id, f.orden_trabajo_id, f.estado, f.empresa_id, f.fecha_factura
      )
      SELECT
        p.pago_id,
        (p.fecha_pago AT TIME ZONE 'America/Santo_Domingo')::date::text AS fecha,
        TO_CHAR(p.fecha_pago AT TIME ZONE 'America/Santo_Domingo', 'DD/MM/YYYY') AS fecha_fmt,
        p.monto_pago::numeric(12,2) AS monto_total_pago,
        tp.tipo_pago_id,
        tp.codigo AS metodo_codigo,
        tp.nombre AS metodo_nombre,
        f.factura_id,
        f.numero_factura,
        s.fecha_factura_date::text AS fecha_factura,
        f.orden_trabajo_id,
        ot.codigo_orden,
        (ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date::text AS fecha_orden,
        COALESCE(c.nombre, 'Cliente Mostrador') AS cliente_nombre,
        CASE
          WHEN s.orden_trabajo_id IS NULL THEN 'VENTA_DIRECTA'
          WHEN s.subtotal_repuestos > 0 AND s.subtotal_servicios = 0 THEN 'REPUESTOS'
          ELSE 'TALLER'
        END AS origen_principal,
        CASE
          WHEN s.subtotal_items > 0 AND s.orden_trabajo_id IS NOT NULL
            THEN ROUND(p.monto_pago * (s.subtotal_servicios / s.subtotal_items), 2)
          WHEN s.subtotal_items = 0 AND s.orden_trabajo_id IS NOT NULL
            THEN p.monto_pago
          ELSE 0
        END AS monto_servicios_taller,
        CASE
          WHEN s.subtotal_items > 0 AND s.orden_trabajo_id IS NOT NULL
            THEN ROUND(p.monto_pago * (s.subtotal_repuestos / s.subtotal_items), 2)
          ELSE 0
        END AS monto_repuestos,
        CASE
          WHEN s.orden_trabajo_id IS NULL
            THEN p.monto_pago
          ELSE 0
        END AS monto_venta_directa
      FROM admin.pagos p
      JOIN invoice_shares s ON p.factura_id = s.factura_id
      JOIN admin.facturas f ON p.factura_id = f.factura_id
      JOIN admin.tipo_pago tp ON p.tipo_pago_id = tp.tipo_pago_id
      LEFT JOIN admin.ordenes_trabajo ot ON f.orden_trabajo_id = ot.orden_trabajo_id
      LEFT JOIN admin.clientes c ON f.cliente_id = c.cliente_id
      WHERE ${incomeWhereSql}
        AND (p.fecha_pago AT TIME ZONE 'America/Santo_Domingo')::date BETWEEN $2::date AND $3::date
      ORDER BY p.fecha_pago DESC, p.pago_id DESC;
    `;

    const [allPaymentsRows, facturacionRows, pendingBillingRows] = await Promise.all([
      query<RawPaymentRow>(currentPaymentsQuery, incomeQueryParams),
      query<FacturacionPeriodoRow>(`
        WITH pagos_agg AS (
          SELECT
            p.factura_id,
            COALESCE(SUM(p.monto_pago), 0)::numeric AS total_pagado
          FROM admin.pagos p
          WHERE (p.estado = 'APLICADO' OR p.estado IS NULL)
          GROUP BY p.factura_id
        )
        SELECT
          COALESCE(SUM(COALESCE(f.total_factura, f.total, 0)), 0)::numeric AS total_facturado,
          COUNT(DISTINCT f.factura_id)::int AS facturas_emitidas_count,
          COUNT(DISTINCT f.orden_trabajo_id) FILTER (WHERE f.orden_trabajo_id IS NOT NULL)::int AS ordenes_facturadas_count,
          COALESCE(SUM(GREATEST(0, COALESCE(f.total_factura, f.total, 0) - COALESCE(pa.total_pagado, 0))), 0)::numeric AS cuentas_por_cobrar,
          COUNT(DISTINCT f.factura_id) FILTER (WHERE GREATEST(0, COALESCE(f.total_factura, f.total, 0) - COALESCE(pa.total_pagado, 0)) > 0.009)::int AS facturas_pendientes_count,
          COALESCE(SUM(COALESCE(f.total_factura, f.total, 0)), 0)::numeric AS total_facturado_periodo
        FROM admin.facturas f
        LEFT JOIN pagos_agg pa ON f.factura_id = pa.factura_id
        WHERE f.empresa_id = $1
          AND UPPER(COALESCE(f.estado, '')) NOT IN ('ANULADA', 'CANCELADA')
          AND (f.fecha_factura AT TIME ZONE 'America/Santo_Domingo')::date BETWEEN $2::date AND $3::date;
      `, [empresaId, startDateStr, endDateStr]),
      query<PendingBillingRow>(`
        SELECT
          COALESCE(SUM(COALESCE(ot.total_orden, (COALESCE(ot.subtotal_servicios, 0) + COALESCE(ot.subtotal_productos, 0) - COALESCE(ot.descuento_servicios, 0) - COALESCE(ot.descuento_productos, 0) + COALESCE(ot.impuesto, 0)))), 0)::numeric AS monto_pendiente_facturar,
          COUNT(ot.orden_trabajo_id)::int AS ordenes_pendientes_facturar_count
        FROM admin.ordenes_trabajo ot
        WHERE ${orderWhereSql}
          AND (ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date BETWEEN $2::date AND $3::date
          AND (ot.facturado IS DISTINCT FROM true)
          AND NOT EXISTS (
            SELECT 1 FROM admin.facturas f
            WHERE f.orden_trabajo_id = ot.orden_trabajo_id
              AND UPPER(COALESCE(f.estado, '')) NOT IN ('ANULADA', 'CANCELADA')
          );
      `, orderQueryParams)
    ]);

    const totalFacturadoVal = Number(facturacionRows[0]?.total_facturado || 0);
    const facturasEmitidasCount = Number(facturacionRows[0]?.facturas_emitidas_count || 0);
    const ordenesFacturadasCount = Number(facturacionRows[0]?.ordenes_facturadas_count || 0);
    const cuentasPorCobrarVal = Number(facturacionRows[0]?.cuentas_por_cobrar || 0);
    const facturasPendientesCobroCount = Number(facturacionRows[0]?.facturas_pendientes_count || 0);

    const montoPendienteFacturarVal = Number(pendingBillingRows[0]?.monto_pendiente_facturar || 0);
    const ordenesPendientesFacturarCount = Number(pendingBillingRows[0]?.ordenes_pendientes_facturar_count || 0);

    // Apply exact filter by Origen del ingreso
    const filteredPayments: FilteredPayment[] = allPaymentsRows.filter((p: RawPaymentRow) => {
      if (rawOrigen === "TODOS") return true;
      if (rawOrigen === "VENTA_DIRECTA") return Number(p.monto_venta_directa) > 0;
      if (rawOrigen === "TALLER") return Number(p.monto_servicios_taller) > 0;
      if (rawOrigen === "REPUESTOS") return Number(p.monto_repuestos) > 0;
      return true;
    }).map((p: RawPaymentRow): FilteredPayment => {
      let montoEfectivo = Number(p.monto_total_pago);
      if (rawOrigen === "VENTA_DIRECTA") montoEfectivo = Number(p.monto_venta_directa);
      else if (rawOrigen === "TALLER") montoEfectivo = Number(p.monto_servicios_taller);
      else if (rawOrigen === "REPUESTOS") montoEfectivo = Number(p.monto_repuestos);

      return {
        ...p,
        monto_efectivo: montoEfectivo
      };
    });

    // Total Recibido en RD$ en el período actual
    const totalRecibidoActual = filteredPayments.reduce((sum: number, p: FilteredPayment) => sum + p.monto_efectivo, 0);
    const promedioDiarioIngresos = Number((totalRecibidoActual / numDaysPeriodo).toFixed(2));
    const cantidadPagosPeriodo = filteredPayments.length;

    // Desglose Recaudado: Taller vs Venta Directa vs Facturas Anteriores
    let recaudadoFacturasAnteriores = 0;
    let recaudadoTaller = 0;
    let recaudadoVentaDirecta = 0;

    for (const p of filteredPayments) {
      // Si el pago proviene de una orden de trabajo, la fecha determinante para evaluar si es del período
      // es la fecha de creación de la OT (ot.fecha_registro). Si es venta directa, la fecha de la factura.
      const fechaOrigen = p.orden_trabajo_id !== null && p.fecha_orden ? p.fecha_orden : p.fecha_factura;
      const isAnterior = fechaOrigen ? fechaOrigen < startDateStr : false;

      if (isAnterior) {
        recaudadoFacturasAnteriores += p.monto_efectivo;
      } else if (p.orden_trabajo_id !== null) {
        recaudadoTaller += p.monto_efectivo;
      } else {
        recaudadoVentaDirecta += p.monto_efectivo;
      }
    }

    const desgloseRecaudado = {
      taller: Number(recaudadoTaller.toFixed(2)),
      ventaDirecta: Number(recaudadoVentaDirecta.toFixed(2)),
      facturasAnteriores: Number(recaudadoFacturasAnteriores.toFixed(2))
    };

    // Previous Period Payments calculation for comparison
    const prevIncomeQueryParams = [empresaId, prevStartDateStr, prevEndDateStr, ...incomeQueryParams.slice(3)];
    const prevPaymentsRows = await query<RawPaymentRow>(currentPaymentsQuery, prevIncomeQueryParams);
    const filteredPrevPayments = prevPaymentsRows.filter((p: RawPaymentRow) => {
      if (rawOrigen === "TODOS") return true;
      if (rawOrigen === "VENTA_DIRECTA") return Number(p.monto_venta_directa) > 0;
      if (rawOrigen === "TALLER") return Number(p.monto_servicios_taller) > 0;
      if (rawOrigen === "REPUESTOS") return Number(p.monto_repuestos) > 0;
      return true;
    }).map((p: RawPaymentRow): number => {
      let montoEfectivo = Number(p.monto_total_pago);
      if (rawOrigen === "VENTA_DIRECTA") montoEfectivo = Number(p.monto_venta_directa);
      else if (rawOrigen === "TALLER") montoEfectivo = Number(p.monto_servicios_taller);
      else if (rawOrigen === "REPUESTOS") montoEfectivo = Number(p.monto_repuestos);
      return montoEfectivo;
    });

    const totalRecibidoAnterior = filteredPrevPayments.reduce((sum: number, m: number) => sum + m, 0);
    const diferenciaPeriodo = Number((totalRecibidoActual - totalRecibidoAnterior).toFixed(2));

    let porcentajeCambioPeriodo = 0;
    let tendencia: "up" | "down" | "neutral" = "neutral";
    if (totalRecibidoAnterior > 0) {
      porcentajeCambioPeriodo = Number((((totalRecibidoActual - totalRecibidoAnterior) / totalRecibidoAnterior) * 100).toFixed(1));
      tendencia = porcentajeCambioPeriodo > 0 ? "up" : porcentajeCambioPeriodo < 0 ? "down" : "neutral";
    } else if (totalRecibidoActual > 0) {
      porcentajeCambioPeriodo = 100;
      tendencia = "up";
    }

    // Daily Income Data aggregated across the days series
    const incomeByDateMap = new Map<string, { total: number; taller: number; repuestos: number; venta_directa: number; count: number }>();
    for (const p of filteredPayments) {
      const existing = incomeByDateMap.get(p.fecha) || { total: 0, taller: 0, repuestos: 0, venta_directa: 0, count: 0 };
      existing.total += p.monto_efectivo;
      existing.taller += Number(p.monto_servicios_taller);
      existing.repuestos += Number(p.monto_repuestos);
      existing.venta_directa += Number(p.monto_venta_directa);
      existing.count += 1;
      incomeByDateMap.set(p.fecha, existing);
    }

    const incomeDailyData = (flujoRows || []).map((row: FlujoRow) => {
      const parts = String(row.fecha).split("-");
      const monthIdx = parseInt(parts[1] || "1", 10) - 1;
      const dayNum = parts[2] || "";
      const dayShort = dayTranslationMap[String(row.day).trim()] || row.day;
      const etiqueta = `${dayShort} ${dayNum}`;
      const label = `${dayNum} ${monthNames[monthIdx] || ""}`;

      const rec = incomeByDateMap.get(row.fecha) || { total: 0, taller: 0, repuestos: 0, venta_directa: 0, count: 0 };

      return {
        fecha: row.fecha,
        day: dayShort,
        etiqueta,
        label,
        monto_total: Number(rec.total.toFixed(2)),
        monto_servicios_taller: Number(rec.taller.toFixed(2)),
        monto_repuestos: Number(rec.repuestos.toFixed(2)),
        monto_venta_directa: Number(rec.venta_directa.toFixed(2)),
        count_pagos: rec.count
      };
    });

    let maxIncomeAmount = 0;
    let maxIncomeDayObj: { fecha: string; etiqueta: string; monto_total: number } | null = null;
    for (const d of incomeDailyData) {
      if (d.monto_total >= maxIncomeAmount && d.monto_total > 0) {
        maxIncomeAmount = d.monto_total;
        maxIncomeDayObj = d;
      }
    }
    const diaMayorRecaudacion = maxIncomeDayObj
      ? {
          fecha: maxIncomeDayObj.fecha,
          etiqueta: maxIncomeDayObj.etiqueta,
          monto: maxIncomeAmount
        }
      : {
          fecha: "",
          etiqueta: "Sin cobros",
          monto: 0
        };

    // Breakdown by Método de Pago (Category distribution)
    const incomeByMethodMap = new Map<number, { name: string; codigo: string; total: number; count: number }>();
    for (const p of filteredPayments) {
      const mId = p.tipo_pago_id;
      const existing = incomeByMethodMap.get(mId) || { name: p.metodo_nombre, codigo: p.metodo_codigo, total: 0, count: 0 };
      existing.total += p.monto_efectivo;
      existing.count += 1;
      incomeByMethodMap.set(mId, existing);
    }

    const methodColorMap: Record<string, string> = {
      EFECTIVO: "#10b981",
      TARJETA: "#38bdf8",
      TRANSFERENCIA: "#bfce7f",
      CHEQUE: "#f59e0b",
      CREDITO: "#a855f7"
    };

    const incomeByMethod = Array.from(incomeByMethodMap.entries()).map(([tipo_pago_id, data], idx) => {
      const pct = totalRecibidoActual > 0 ? Math.round((data.total / totalRecibidoActual) * 100) : 0;
      return {
        tipo_pago_id,
        name: data.name,
        codigo: data.codigo,
        count: data.count,
        total: Number(data.total.toFixed(2)),
        percentage: pct,
        color: methodColorMap[data.codigo] || chartPalette[idx % chartPalette.length]
      };
    }).sort((a, b) => b.total - a.total);

    // Breakdown by Origen del Ingreso (Venta directa, órdenes de taller, repuestos)
    const totalServiciosCobrados = filteredPayments.reduce((s, p) => s + Number(p.monto_servicios_taller), 0);
    const totalRepuestosCobrados = filteredPayments.reduce((s, p) => s + Number(p.monto_repuestos), 0);
    const totalVentaDirectaCobrada = filteredPayments.reduce((s, p) => s + Number(p.monto_venta_directa), 0);
    const sumAllOrigins = totalServiciosCobrados + totalRepuestosCobrados + totalVentaDirectaCobrada;

    const incomeByOrigin = [
      {
        id: "TALLER",
        name: "Órdenes de Taller (Servicios)",
        total: Number(totalServiciosCobrados.toFixed(2)),
        percentage: sumAllOrigins > 0 ? Math.round((totalServiciosCobrados / sumAllOrigins) * 100) : 0,
        color: "#bfce7f"
      },
      {
        id: "REPUESTOS",
        name: "Repuestos en Taller",
        total: Number(totalRepuestosCobrados.toFixed(2)),
        percentage: sumAllOrigins > 0 ? Math.round((totalRepuestosCobrados / sumAllOrigins) * 100) : 0,
        color: "#38bdf8"
      },
      {
        id: "VENTA_DIRECTA",
        name: "Venta Directa / Mostrador",
        total: Number(totalVentaDirectaCobrada.toFixed(2)),
        percentage: sumAllOrigins > 0 ? Math.round((totalVentaDirectaCobrada / sumAllOrigins) * 100) : 0,
        color: "#f59e0b"
      }
    ].sort((a, b) => b.total - a.total);

    // Payments list for consultation
    const paymentsList = filteredPayments.slice(0, 50).map((p: FilteredPayment) => ({
      pago_id: p.pago_id,
      fecha: p.fecha_fmt || p.fecha,
      fecha_iso: p.fecha,
      monto: Number(p.monto_efectivo.toFixed(2)),
      monto_total_factura: Number(p.monto_total_pago),
      metodo_nombre: p.metodo_nombre,
      metodo_codigo: p.metodo_codigo,
      factura_numero: p.numero_factura,
      factura_id: p.factura_id,
      orden_id: p.orden_trabajo_id,
      orden_codigo: p.codigo_orden,
      cliente_nombre: p.cliente_nombre,
      origen_principal: p.origen_principal
    }));

    // Period text for display
    const periodoTexto = `${startDateStr} a ${endDateStr}`;

    const periodoAnteriorTexto = `${prevStartDateStr} a ${prevEndDateStr}`;

    return NextResponse.json({
      success: true,
      startDate: startDateStr,
      endDate: endDateStr,
      data: {
        // Catalogs for filters
        catalogs: {
          estados: estadosCatalog || [],
          tipos_orden: tiposOrdenCatalog || [],
          metodos_pago: metodosPagoCatalog || [],
          origenes: origenesCatalog
        },

        // Active filters reflected in response
        activeFilters: {
          from: startDateStr,
          to: endDateStr,
          estado_id: rawEstadoId ? Number(rawEstadoId) : null,
          tipo_orden_id: rawTipoOrdenId ? Number(rawTipoOrdenId) : null,
          metodo_pago_id: rawMetodoPagoId ? Number(rawMetodoPagoId) : null,
          origen: rawOrigen
        },

        // 1. ÓRDENES DE TRABAJO
        ordenes: {
          total: totalOrdenesPeriodo,
          promedioDiario: promedioDiarioEntero,
          totalRegistradas: totalOrdenesPeriodo,
          totalEntregadas: totalEntregadasPeriodo,
          totalServicios: totalServiciosPeriodo,
          totalProductos: totalProductosPeriodo,
          serviciosEntregadas: totalServiciosEntregadasPeriodo,
          productosEntregadas: totalProductosEntregadasPeriodo,
          totalGlobal: totalOrdenesVal,
          totalActivas: totalActivasPeriodo,
          totalActivasGlobal: workshopTotalActivas,
          totalActivasTaller: workshopTotalActivas,
          diaMayorActividad,
          desgloseActivas: {
            pendientes: pendientesVal,
            enReparacion: enReparacionVal,
            paraEntrega: paraEntregaVal,
            enHold: enHoldVal
          },
          desgloseEstados: {
            enProceso: enReparacionVal,
            recibidas: pendientesVal,
            listas: paraEntregaVal,
            entregadas: totalEntregadasPeriodo
          },
          desgloseEstadosTaller: {
            enProceso: workshopActivesFilteredRows[0]?.en_reparacion || 0,
            recibidas: workshopActivesFilteredRows[0]?.pendientes || 0,
            listas: workshopActivesFilteredRows[0]?.para_entrega || 0,
            entregadas: 0
          },
          clientesUnicos: clientesUnicosPeriodo,
          dailyData: weeklyData,
          byType: ordersByTypeData,
          ordersList: associatedOrdersRows || []
        },

        // 2. INGRESOS Y FACTURACIÓN
        ingresos: {
          montoTotalOrdenes: Number(montoTotalOrdenesPeriodo.toFixed(2)),
          totalOrdenes: totalOrdenesPeriodo,
          totalFacturado: Number(totalFacturadoVal.toFixed(2)),
          facturasEmitidasCount,
          ordenesFacturadasCount,
          montoPendienteFacturar: Number(montoPendienteFacturarVal.toFixed(2)),
          ordenesPendientesFacturarCount,
          totalRecibido: Number(totalRecibidoActual.toFixed(2)),
          desgloseRecaudado,
          promedioDiario: promedioDiarioIngresos,
          cantidadPagos: cantidadPagosPeriodo,
          cuentasPorCobrar: Number(cuentasPorCobrarVal.toFixed(2)),
          facturasPendientesCobroCount,
          cuentasPorPagar: Number(cuentasPorPagarVal.toFixed(2)),
          cuentasPorPagarComprasPendientes,
          comparacionPeriodoAnterior: {
            totalActual: Number(totalRecibidoActual.toFixed(2)),
            totalAnterior: Number(totalRecibidoAnterior.toFixed(2)),
            diferencia: diferenciaPeriodo,
            porcentajeCambio: porcentajeCambioPeriodo,
            tendencia,
            periodoAnteriorTexto
          },
          dailyData: incomeDailyData,
          diaMayorRecaudacion,
          byMetodoPago: incomeByMethod,
          byOrigen: incomeByOrigin,
          paymentsList
        },

        // Global Snapshot & Backwards Compatibility
        desgloseRecaudado,
        montoTotalOrdenes: Number(montoTotalOrdenesPeriodo.toFixed(2)),
        totalFacturado: Number(totalFacturadoVal.toFixed(2)),
        facturasEmitidasCount,
        ordenesFacturadasCount,
        montoPendienteFacturar: Number(montoPendienteFacturarVal.toFixed(2)),
        ordenesPendientesFacturarCount,
        totalOrdenes: totalOrdenesPeriodo,
        total_ordenes: totalOrdenesPeriodo,
        totalClientes: clientesUnicosPeriodo,
        total_clientes: clientesUnicosPeriodo,
        totalClientesDirectorio: totalClientesVal,
        ordenesActivas: totalActivasPeriodo,
        ordenesActivasTaller: workshopTotalActivas,
        cuentasPorCobrar: Number(cuentasPorCobrarVal.toFixed(2)),
        facturasPendientesCobroCount,
        cuentasPorPagar: Number(cuentasPorPagarVal.toFixed(2)),
        cuentasPorPagarComprasPendientes,
        desgloseEstados: {
          enProceso: enReparacionVal,
          recibidas: pendientesVal,
          listas: paraEntregaVal,
          entregadas: totalEntregadasPeriodo
        },
        resumenGrafico: {
          totalOrdenes: totalOrdenesPeriodo,
          totalOrdenesRegistradas: totalOrdenesPeriodo,
          totalOrdenesEntregadas: totalEntregadasPeriodo,
          totalEntregadas: totalEntregadasPeriodo,
          totalServicios: totalServiciosPeriodo,
          promedioDiario: promedioDiarioEntero,
          diaMayorActividad,
          periodoTexto
        },
        weeklyData,
        categoryBreakdown,
        recentOrders: associatedOrdersRows.slice(0, 5)
      }
    });

  } catch (error: unknown) {
    console.error("GET /api/dashboard Error:", error);
    const msg = error instanceof Error ? error.message : "Error desconocido al cargar métricas.";
    return NextResponse.json({ error: "SERVER_ERROR", message: `Error al cargar las métricas del dashboard: ${msg}` }, { status: 500 });
  }
}
