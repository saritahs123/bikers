import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getScreenPermissions } from "@/lib/workshop-session";

export interface InvoiceDailyDetailRow {
  factura_id: number;
  fecha_dia: string;
  fecha_emision: string;
  numero_factura: string;
  cliente_id: number;
  cliente_nombre: string;
  cliente_identificacion: string | null;
  orden_trabajo_id: number | null;
  codigo_orden: string | null;
  condicion_pago: string;
  estado_factura: string;
  subtotal: number;
  descuento: number;
  impuestos: number;
  total_facturado: number;
  monto_pagado: number;
  saldo_pendiente: number;
}

export interface InvoiceDailyGroupSummary {
  fecha_dia: string;
  cantidad_facturas: number;
  cantidad_activas: number;
  cantidad_anuladas: number;
  subtotal: number;
  descuento: number;
  impuestos: number;
  total_facturado: number;
  monto_pagado: number;
  saldo_pendiente: number;
  facturas?: InvoiceDailyDetailRow[];
}

export async function GET(req: NextRequest) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const perms = await getScreenPermissions("/reports/invoices-daily", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permisos para ver este reporte." }, { status: 403 });
    }

    const empresaId = session.empresa_id;
    const { searchParams } = new URL(req.url);

    const isExport = searchParams.get("export") === "true";
    if (isExport && !perms.puede_exportar) {
      return NextResponse.json({ error: "FORBIDDEN_EXPORT", message: "No posee permisos para exportar este reporte." }, { status: 403 });
    }

    const fechaDesde = searchParams.get("fechaDesde") || "";
    const fechaHasta = searchParams.get("fechaHasta") || "";
    const estado = (searchParams.get("estado") || "TODOS").trim().toUpperCase();
    const condicion = (searchParams.get("condicion") || "TODOS").trim().toUpperCase();
    const search = (searchParams.get("search") || "").trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = isExport ? 5000 : Math.max(1, parseInt(searchParams.get("limit") || "10", 10));
    const offset = (page - 1) * limit;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    // Build conditions
    const whereConditions: string[] = ["f.empresa_id = $1"];
    const queryParams: (string | number)[] = [empresaId];

    // Date range filter
    if (fechaDesde && dateRegex.test(fechaDesde)) {
      queryParams.push(fechaDesde);
      whereConditions.push(`(f.fecha_factura AT TIME ZONE 'America/Santo_Domingo')::date >= $${queryParams.length}::date`);
    } else {
      // Default: Last 7 days in Santo Domingo timezone
      whereConditions.push(`(f.fecha_factura AT TIME ZONE 'America/Santo_Domingo')::date >= ((NOW() AT TIME ZONE 'America/Santo_Domingo')::date - INTERVAL '6 days')::date`);
    }

    if (fechaHasta && dateRegex.test(fechaHasta)) {
      queryParams.push(fechaHasta);
      whereConditions.push(`(f.fecha_factura AT TIME ZONE 'America/Santo_Domingo')::date <= $${queryParams.length}::date`);
    } else {
      whereConditions.push(`(f.fecha_factura AT TIME ZONE 'America/Santo_Domingo')::date <= (NOW() AT TIME ZONE 'America/Santo_Domingo')::date`);
    }

    // Status filter
    if (estado && estado !== "TODOS") {
      queryParams.push(estado);
      whereConditions.push(`UPPER(f.estado) = $${queryParams.length}`);
    }

    // Payment condition filter (condicion_venta in admin.facturas)
    if (condicion && condicion !== "TODOS") {
      queryParams.push(condicion);
      whereConditions.push(`UPPER(COALESCE(f.condicion_venta, 'CONTADO')) = $${queryParams.length}`);
    }

    // Search filter
    if (search) {
      queryParams.push(`%${search}%`);
      const sIdx = queryParams.length;
      whereConditions.push(`(
        f.numero_factura ILIKE $${sIdx} OR
        c.nombre ILIKE $${sIdx} OR
        c.apellido ILIKE $${sIdx} OR
        c.nombre_completo ILIKE $${sIdx} OR
        c.identificacion ILIKE $${sIdx} OR
        ot.codigo_orden ILIKE $${sIdx}
      )`);
    }

    const whereClause = whereConditions.join(" AND ");

    // 1. Fetch full aggregated dataset to compute exact day summaries and global KPIs
    const fullSql = `
      SELECT 
        (f.fecha_factura AT TIME ZONE 'America/Santo_Domingo')::date::text AS fecha_dia,
        f.factura_id,
        f.numero_factura,
        f.fecha_factura AS fecha_emision,
        f.cliente_id,
        COALESCE(c.nombre_completo, TRIM(CONCAT(c.nombre, ' ', c.apellido)), 'Cliente General') AS cliente_nombre,
        c.identificacion AS cliente_identificacion,
        f.orden_trabajo_id,
        ot.codigo_orden,
        COALESCE(f.condicion_venta, 'CONTADO') AS condicion_pago,
        UPPER(COALESCE(f.estado, 'PENDIENTE')) AS estado_factura,
        ROUND(COALESCE(f.subtotal, 0)::numeric, 2) AS subtotal,
        ROUND(COALESCE(f.descuento_total, f.descuento, 0)::numeric, 2) AS descuento,
        ROUND(COALESCE(f.impuesto_total, f.impuesto, 0)::numeric, 2) AS impuestos,
        ROUND(COALESCE(f.total_factura, f.total, 0)::numeric, 2) AS total_facturado,
        ROUND(COALESCE(f.monto_pagado, 0)::numeric, 2) AS monto_pagado,
        ROUND(COALESCE(f.balance_pendiente, 0)::numeric, 2) AS saldo_pendiente
      FROM admin.facturas f
      JOIN admin.clientes c ON f.cliente_id = c.cliente_id
      LEFT JOIN admin.ordenes_trabajo ot ON f.orden_trabajo_id = ot.orden_trabajo_id
      WHERE ${whereClause}
      ORDER BY fecha_dia DESC, f.factura_id DESC
    `;

    const allRows = await query<InvoiceDailyDetailRow>(fullSql, queryParams);

    // Compute KPIs (excluding ANULADA from active monetary totals)
    let totalFacturas = 0;
    let totalActivas = 0;
    let totalAnuladas = 0;
    let montoAnulado = 0;
    let facturasCobradas = 0;
    let facturasPendientes = 0;
    let totalSubtotal = 0;
    let totalDescuento = 0;
    let totalImpuestos = 0;
    let totalFacturado = 0;
    let totalCobrado = 0;
    let totalSaldoPendiente = 0;

    // Grouping by day
    const dayGroupsMap = new Map<string, InvoiceDailyGroupSummary>();

    for (const row of allRows) {
      totalFacturas++;
      const isAnulada = row.estado_factura === "ANULADA";
      if (isAnulada) {
        totalAnuladas++;
        montoAnulado += Number(row.total_facturado) || 0;
      } else {
        totalActivas++;
        totalSubtotal += Number(row.subtotal) || 0;
        totalDescuento += Number(row.descuento) || 0;
        totalImpuestos += Number(row.impuestos) || 0;
        totalFacturado += Number(row.total_facturado) || 0;
        totalCobrado += Number(row.monto_pagado) || 0;
        totalSaldoPendiente += Number(row.saldo_pendiente) || 0;

        if (Number(row.monto_pagado) > 0 || row.estado_factura === "PAGADA") {
          facturasCobradas++;
        }
        if (Number(row.saldo_pendiente) > 0) {
          facturasPendientes++;
        }
      }

      // Grouping
      const dayKey = row.fecha_dia;
      let dayGroup = dayGroupsMap.get(dayKey);
      if (!dayGroup) {
        dayGroup = {
          fecha_dia: dayKey,
          cantidad_facturas: 0,
          cantidad_activas: 0,
          cantidad_anuladas: 0,
          subtotal: 0,
          descuento: 0,
          impuestos: 0,
          total_facturado: 0,
          monto_pagado: 0,
          saldo_pendiente: 0,
          facturas: [],
        };
        dayGroupsMap.set(dayKey, dayGroup);
      }

      dayGroup.cantidad_facturas++;
      if (isAnulada) {
        dayGroup.cantidad_anuladas++;
      } else {
        dayGroup.cantidad_activas++;
        dayGroup.subtotal = Number((dayGroup.subtotal + (Number(row.subtotal) || 0)).toFixed(2));
        dayGroup.descuento = Number((dayGroup.descuento + (Number(row.descuento) || 0)).toFixed(2));
        dayGroup.impuestos = Number((dayGroup.impuestos + (Number(row.impuestos) || 0)).toFixed(2));
        dayGroup.total_facturado = Number((dayGroup.total_facturado + (Number(row.total_facturado) || 0)).toFixed(2));
        dayGroup.monto_pagado = Number((dayGroup.monto_pagado + (Number(row.monto_pagado) || 0)).toFixed(2));
        dayGroup.saldo_pendiente = Number((dayGroup.saldo_pendiente + (Number(row.saldo_pendiente) || 0)).toFixed(2));
      }

      dayGroup.facturas?.push(row);
    }

    const daySummaries = Array.from(dayGroupsMap.values());

    // Paginated slice for the detailed table
    const paginatedRows = isExport ? allRows : allRows.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      data: paginatedRows,
      allRows: isExport ? allRows : undefined,
      daySummaries,
      kpis: {
        totalFacturas,
        totalActivas,
        totalAnuladas,
        montoAnulado: Number(montoAnulado.toFixed(2)),
        facturasCobradas,
        facturasPendientes,
        totalSubtotal: Number(totalSubtotal.toFixed(2)),
        totalDescuento: Number(totalDescuento.toFixed(2)),
        totalImpuestos: Number(totalImpuestos.toFixed(2)),
        totalFacturado: Number(totalFacturado.toFixed(2)),
        totalCobrado: Number(totalCobrado.toFixed(2)),
        totalSaldoPendiente: Number(totalSaldoPendiente.toFixed(2)),
      },
      meta: {
        totalRecords: totalFacturas,
        page,
        limit,
        totalPages: Math.ceil(totalFacturas / limit) || 1,
      },
    });
  } catch (error: unknown) {
    console.error("Error in /api/reports/invoices-daily:", error);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Error al generar el reporte diario de facturas." }, { status: 500 });
  }
}
