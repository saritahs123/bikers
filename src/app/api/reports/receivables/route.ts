import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

export async function GET(req: NextRequest) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    const perms = await getModulePermissions("REPORTES", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No cuenta con autorización para acceder al módulo de Reportes." },
        { status: 403 }
      );
    }

    const empresaId = session.empresa_id;
    const { searchParams } = new URL(req.url);

    // Filters
    const search = (searchParams.get("search") || "").trim();
    const fechaDesde = searchParams.get("fecha_desde") || "";
    const fechaHasta = searchParams.get("fecha_hasta") || "";
    const clienteId = searchParams.get("cliente_id") ? parseInt(searchParams.get("cliente_id")!, 10) : null;
    const estadoCobro = (searchParams.get("estado_cobro") || "TODOS").toUpperCase();
    const saldoMin = searchParams.get("saldo_min") ? parseFloat(searchParams.get("saldo_min")!) : null;
    const saldoMax = searchParams.get("saldo_max") ? parseFloat(searchParams.get("saldo_max")!) : null;
    const estadoVencimiento = (searchParams.get("vencimiento") || "TODOS").toUpperCase();
    const exportAll = searchParams.get("all") === "true";

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("page_size") || "25", 10)));
    const offset = (page - 1) * pageSize;

    const sortByParam = searchParams.get("sort_by") || "fecha_factura";
    const sortDirParam = (searchParams.get("sort_direction") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

    const sortColumns: Record<string, string> = {
      numero_factura: "f.numero_factura",
      fecha_factura: "f.fecha_factura",
      fecha_vencimiento: "f.fecha_vencimiento",
      cliente_nombre: "cliente_nombre",
      total_facturado: "total_facturado",
      total_pagado: "total_pagado",
      saldo_pendiente: "saldo_pendiente",
    };
    const sortSql = sortColumns[sortByParam] || "f.fecha_factura";

    // Base conditions: exclude voided invoices and require outstanding balance > 0
    const conditions: string[] = [
      "f.empresa_id = $1",
      "UPPER(COALESCE(f.estado, '')) NOT IN ('ANULADA', 'CANCELADA')",
      "COALESCE(f.balance_pendiente, (COALESCE(f.total, f.total_factura, 0) - COALESCE(f.monto_pagado, 0))) > 0"
    ];
    const params: unknown[] = [empresaId];
    let pIdx = 2;

    if (search) {
      conditions.push(
        `(f.numero_factura ILIKE $${pIdx} OR f.codigo_factura ILIKE $${pIdx} OR c.nombre_completo ILIKE $${pIdx} OR CONCAT(c.nombre, ' ', c.apellido) ILIKE $${pIdx} OR c.identificacion ILIKE $${pIdx})`
      );
      params.push(`%${search}%`);
      pIdx++;
    }

    if (fechaDesde) {
      conditions.push(`f.fecha_factura >= $${pIdx}`);
      params.push(`${fechaDesde} 00:00:00`);
      pIdx++;
    }

    if (fechaHasta) {
      conditions.push(`f.fecha_factura <= $${pIdx}`);
      params.push(`${fechaHasta} 23:59:59.999`);
      pIdx++;
    }

    if (clienteId && !isNaN(clienteId)) {
      conditions.push(`f.cliente_id = $${pIdx}`);
      params.push(clienteId);
      pIdx++;
    }

    if (saldoMin !== null && !isNaN(saldoMin)) {
      conditions.push(`COALESCE(f.balance_pendiente, (COALESCE(f.total, f.total_factura, 0) - COALESCE(f.monto_pagado, 0))) >= $${pIdx}`);
      params.push(saldoMin);
      pIdx++;
    }

    if (saldoMax !== null && !isNaN(saldoMax)) {
      conditions.push(`COALESCE(f.balance_pendiente, (COALESCE(f.total, f.total_factura, 0) - COALESCE(f.monto_pagado, 0))) <= $${pIdx}`);
      params.push(saldoMax);
      pIdx++;
    }

    if (estadoCobro === "PENDIENTE") {
      conditions.push("COALESCE(f.monto_pagado, 0) = 0");
    } else if (estadoCobro === "PAGO_PARCIAL") {
      conditions.push("COALESCE(f.monto_pagado, 0) > 0");
    }

    if (estadoVencimiento === "VENCIDAS") {
      conditions.push("f.fecha_vencimiento IS NOT NULL AND f.fecha_vencimiento < CURRENT_DATE");
    } else if (estadoVencimiento === "NO_VENCIDAS") {
      conditions.push("f.fecha_vencimiento IS NOT NULL AND f.fecha_vencimiento >= CURRENT_DATE");
    } else if (estadoVencimiento === "SIN_VENCIMIENTO") {
      conditions.push("f.fecha_vencimiento IS NULL");
    }

    const whereClause = conditions.join(" AND ");

    // 1. KPI Aggregation Query (over all filtered matching invoices)
    const kpiSql = `
      SELECT 
        COUNT(*)::int AS cantidad_facturas,
        COALESCE(SUM(COALESCE(f.total, f.total_factura, 0)), 0)::numeric AS total_facturado,
        COALESCE(SUM(COALESCE(f.monto_pagado, 0)), 0)::numeric AS total_cobrado,
        COALESCE(SUM(COALESCE(f.balance_pendiente, (COALESCE(f.total, f.total_factura, 0) - COALESCE(f.monto_pagado, 0)))), 0)::numeric AS saldo_pendiente_total
      FROM admin.facturas f
      JOIN admin.clientes c ON f.cliente_id = c.cliente_id
      WHERE ${whereClause}
    `;
    const kpiResult = await query(kpiSql, params);
    const kpiRow = kpiResult[0] || {
      cantidad_facturas: 0,
      total_facturado: 0,
      total_cobrado: 0,
      saldo_pendiente_total: 0,
    };

    const totalRecords = Number(kpiRow.cantidad_facturas || 0);
    const totalPages = exportAll ? 1 : Math.ceil(totalRecords / pageSize);

    // 2. Data Query
    const dataSql = `
      SELECT 
        f.factura_id,
        COALESCE(f.codigo_factura, f.numero_factura) AS numero_factura,
        f.fecha_factura,
        f.fecha_vencimiento,
        c.cliente_id,
        COALESCE(c.nombre_completo, CONCAT(c.nombre, ' ', c.apellido)) AS cliente_nombre,
        c.identificacion AS cliente_identificacion,
        c.telefono_principal AS cliente_telefono,
        COALESCE(f.total, f.total_factura, 0)::numeric AS total_facturado,
        COALESCE(f.monto_pagado, 0)::numeric AS total_pagado,
        COALESCE(f.balance_pendiente, (COALESCE(f.total, f.total_factura, 0) - COALESCE(f.monto_pagado, 0)))::numeric AS saldo_pendiente,
        CASE 
          WHEN COALESCE(f.monto_pagado, 0) > 0 THEN 'PAGO PARCIAL'
          ELSE 'PENDIENTE'
        END AS estado_cobro,
        CASE 
          WHEN f.fecha_vencimiento IS NOT NULL AND f.fecha_vencimiento < CURRENT_DATE THEN 'VENCIDA'
          WHEN f.fecha_vencimiento IS NOT NULL THEN 'AL_DIA'
          ELSE 'SIN_VENCIMIENTO'
        END AS estado_vencimiento
      FROM admin.facturas f
      JOIN admin.clientes c ON f.cliente_id = c.cliente_id
      WHERE ${whereClause}
      ORDER BY ${sortSql} ${sortDirParam}
      ${exportAll ? "" : `LIMIT $${pIdx} OFFSET $${pIdx + 1}`}
    `;

    const dataParams = exportAll ? params : [...params, pageSize, offset];
    const dataRows = await query(dataSql, dataParams);

    return NextResponse.json({
      kpis: {
        totalFacturado: Number(kpiRow.total_facturado || 0),
        totalCobrado: Number(kpiRow.total_cobrado || 0),
        saldoPendiente: Number(kpiRow.saldo_pendiente_total || 0),
        cantidadFacturas: totalRecords,
      },
      data: dataRows || [],
      pagination: {
        page: exportAll ? 1 : page,
        pageSize: exportAll ? totalRecords : pageSize,
        total: totalRecords,
        totalPages,
      },
      meta: {
        generatedAt: new Date().toISOString(),
        empresaId,
      }
    });
  } catch (error: unknown) {
    console.error("Error in /api/reports/receivables:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Error al generar el reporte de cuentas por cobrar." },
      { status: 500 }
    );
  }
}
