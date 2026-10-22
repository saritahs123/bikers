import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getScreenPermissions } from "@/lib/workshop-session";

export interface WorkOrderDailyDetailRow {
  orden_trabajo_id: number;
  codigo_orden: string;
  fecha_dia: string;
  fecha_registro: string;
  fecha_entrega_real: string | null;
  cliente_id: number;
  cliente_nombre: string;
  cliente_telefono: string | null;
  bicicleta: string;
  bicicleta_serie: string | null;
  servicios_contratados: string | null;
  estado_orden_id: number;
  estado_nombre: string;
  estado_codigo: string;
  estado_color: string;
  mecanico_nombre: string;
  subtotal: number;
  descuento: number;
  impuestos: number;
  total_orden: number;
}

export interface WorkOrderDailyGroupSummary {
  fecha_dia: string;
  cantidad_ordenes: number;
  subtotal: number;
  descuento: number;
  impuestos: number;
  total_orden: number;
  ordenes?: WorkOrderDailyDetailRow[];
}

export async function GET(req: NextRequest) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const perms = await getScreenPermissions("/reports/work-orders-daily", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permisos para ver este reporte." }, { status: 403 });
    }

    const empresaId = session.empresa_id;
    const { searchParams } = new URL(req.url);

    const isExport = searchParams.get("export") === "true";
    if (isExport && !perms.puede_exportar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No cuenta con privilegios para exportar este reporte." }, { status: 403 });
    }

    const fechaDesde = searchParams.get("fechaDesde") || "";
    const fechaHasta = searchParams.get("fechaHasta") || "";
    const estadoId = (searchParams.get("estado_id") || searchParams.get("estado") || "TODOS").trim();
    const tipoServicioId = (searchParams.get("tipo_servicio_id") || "TODOS").trim();
    const search = (searchParams.get("search") || "").trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = isExport ? 5000 : Math.max(1, parseInt(searchParams.get("limit") || "10", 10));
    const offset = (page - 1) * limit;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    // Build conditions
    const whereConditions: string[] = ["c.empresa_id = $1", "ot.activo = true"];
    const queryParams: (string | number)[] = [empresaId];

    // Date range filter on fecha_registro in Santo Domingo timezone
    if (fechaDesde && dateRegex.test(fechaDesde)) {
      queryParams.push(fechaDesde);
      whereConditions.push(`(ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date >= $${queryParams.length}::date`);
    } else {
      // Default: Last 7 days in Santo Domingo timezone
      whereConditions.push(`(ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date >= ((NOW() AT TIME ZONE 'America/Santo_Domingo')::date - INTERVAL '6 days')::date`);
    }

    if (fechaHasta && dateRegex.test(fechaHasta)) {
      queryParams.push(fechaHasta);
      whereConditions.push(`(ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date <= $${queryParams.length}::date`);
    } else {
      whereConditions.push(`(ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date <= (NOW() AT TIME ZONE 'America/Santo_Domingo')::date`);
    }

    // Work Order Status filter
    if (estadoId && estadoId !== "TODOS") {
      if (!isNaN(Number(estadoId))) {
        queryParams.push(parseInt(estadoId, 10));
        whereConditions.push(`ot.estado_orden_id = $${queryParams.length}`);
      } else {
        queryParams.push(estadoId.toUpperCase());
        whereConditions.push(`UPPER(eot.codigo) = $${queryParams.length}`);
      }
    }

    // Service Type filter (avoids row duplication by using EXISTS subquery)
    if (tipoServicioId && tipoServicioId !== "TODOS" && !isNaN(Number(tipoServicioId))) {
      queryParams.push(parseInt(tipoServicioId, 10));
      whereConditions.push(`EXISTS (
        SELECT 1 FROM admin.orden_servicios os_sub
        WHERE os_sub.orden_trabajo_id = ot.orden_trabajo_id
          AND os_sub.tipo_servicio_id = $${queryParams.length}
          AND (os_sub.activo IS DISTINCT FROM false)
      )`);
    }

    // Search filter
    if (search) {
      queryParams.push(`%${search}%`);
      const sIdx = queryParams.length;
      whereConditions.push(`(
        ot.codigo_orden ILIKE $${sIdx} OR
        ot.orden_trabajo_id::text ILIKE $${sIdx} OR
        c.nombre ILIKE $${sIdx} OR
        c.apellido ILIKE $${sIdx} OR
        c.nombre_completo ILIKE $${sIdx} OR
        c.identificacion ILIKE $${sIdx} OR
        b.marca ILIKE $${sIdx} OR
        b.modelo ILIKE $${sIdx} OR
        b.numero_serie_cuadro ILIKE $${sIdx}
      )`);
    }

    const whereClause = whereConditions.join(" AND ");

    // Fetch full aggregated dataset (each order exactly once)
    const fullSql = `
      SELECT 
        (ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date::text AS fecha_dia,
        ot.orden_trabajo_id,
        ot.codigo_orden,
        ot.fecha_registro,
        ot.fecha_entrega_real,
        ot.cliente_id,
        COALESCE(c.nombre_completo, TRIM(CONCAT(c.nombre, ' ', c.apellido)), 'Cliente General') AS cliente_nombre,
        c.telefono_principal AS cliente_telefono,
        COALESCE(b.marca || ' ' || COALESCE(b.modelo, ''), 'Bicicleta') AS bicicleta,
        b.numero_serie_cuadro AS bicicleta_serie,
        ot.estado_orden_id,
        COALESCE(eot.nombre, 'Sin Estado') AS estado_nombre,
        COALESCE(eot.codigo, 'SIN_ESTADO') AS estado_codigo,
        COALESCE(eot.color_estado, '#64748B') AS estado_color,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''),
          u.estado,
          (
            SELECT COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui_os.nombre, ui_os.apellido)), ''), u_os.estado)
            FROM admin.orden_servicios os_mec
            JOIN admin.usuario u_os ON os_mec.usuario_id = u_os.usuario_id
            LEFT JOIN admin.usuario_identidad ui_os ON u_os.usuario_id = ui_os.usuario_id
            WHERE os_mec.orden_trabajo_id = ot.orden_trabajo_id AND (os_mec.activo IS DISTINCT FROM false)
            LIMIT 1
          ),
          'Por asignar'
        ) AS mecanico_nombre,
        (
          SELECT STRING_AGG(DISTINCT ts.nombre, ', ' ORDER BY ts.nombre)
          FROM admin.orden_servicios os
          JOIN admin.tipo_servicio ts ON os.tipo_servicio_id = ts.tipo_servicio_id
          WHERE os.orden_trabajo_id = ot.orden_trabajo_id AND (os.activo IS DISTINCT FROM false)
        ) AS servicios_contratados,
        ROUND(COALESCE(ot.subtotal_general, 0)::numeric, 2) AS subtotal,
        ROUND((COALESCE(ot.descuento_servicios, 0) + COALESCE(ot.descuento_productos, 0))::numeric, 2) AS descuento,
        ROUND(COALESCE(ot.impuesto, 0)::numeric, 2) AS impuestos,
        ROUND(COALESCE(ot.total_orden, ot.subtotal_general, 0)::numeric, 2) AS total_orden
      FROM admin.ordenes_trabajo ot
      JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
      LEFT JOIN admin.bicicletas b ON ot.bicicleta_id = b.bicicleta_id
      LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
      LEFT JOIN admin.usuario u ON ot.mecanico_id = u.usuario_id
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      WHERE ${whereClause}
      ORDER BY fecha_dia DESC, ot.orden_trabajo_id DESC
    `;

    const allRows = await query<WorkOrderDailyDetailRow>(fullSql, queryParams);

    // Compute KPIs and Daily Groups
    let totalOrdenes = 0;
    let ordenesCompletadas = 0;
    let ordenesActivas = 0;
    let totalSubtotal = 0;
    let totalDescuento = 0;
    let totalImpuestos = 0;
    let totalMontoTaller = 0;

    const dayGroupsMap = new Map<string, WorkOrderDailyGroupSummary>();

    for (const row of allRows) {
      totalOrdenes++;
      const sub = Number(row.subtotal) || 0;
      const desc = Number(row.descuento) || 0;
      const imp = Number(row.impuestos) || 0;
      const tot = Number(row.total_orden) || 0;

      totalSubtotal += sub;
      totalDescuento += desc;
      totalImpuestos += imp;
      totalMontoTaller += tot;

      // Status breakdown
      if (row.estado_codigo === "ENTREGADA" || row.estado_codigo === "LISTA_ENTREGA" || row.estado_orden_id === 7 || row.estado_orden_id === 8) {
        ordenesCompletadas++;
      } else if (row.estado_codigo !== "CANCELADA" && row.estado_orden_id !== 9) {
        ordenesActivas++;
      }

      // Grouping
      const dayKey = row.fecha_dia;
      let dayGroup = dayGroupsMap.get(dayKey);
      if (!dayGroup) {
        dayGroup = {
          fecha_dia: dayKey,
          cantidad_ordenes: 0,
          subtotal: 0,
          descuento: 0,
          impuestos: 0,
          total_orden: 0,
          ordenes: [],
        };
        dayGroupsMap.set(dayKey, dayGroup);
      }

      dayGroup.cantidad_ordenes++;
      dayGroup.subtotal = Number((dayGroup.subtotal + sub).toFixed(2));
      dayGroup.descuento = Number((dayGroup.descuento + desc).toFixed(2));
      dayGroup.impuestos = Number((dayGroup.impuestos + imp).toFixed(2));
      dayGroup.total_orden = Number((dayGroup.total_orden + tot).toFixed(2));
      dayGroup.ordenes?.push(row);
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
        totalOrdenes,
        montoTotalTaller: Number(totalMontoTaller.toFixed(2)),
        ordenesCompletadas,
        ordenesActivas,
        totalSubtotal: Number(totalSubtotal.toFixed(2)),
        totalDescuento: Number(totalDescuento.toFixed(2)),
        totalImpuestos: Number(totalImpuestos.toFixed(2)),
      },
      meta: {
        totalRecords: totalOrdenes,
        page,
        limit,
        totalPages: Math.ceil(totalOrdenes / limit) || 1,
      },
    });
  } catch (error: unknown) {
    console.error("Error in /api/reports/work-orders-daily:", error);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Error al generar el reporte diario de órdenes de trabajo." }, { status: 500 });
  }
}
