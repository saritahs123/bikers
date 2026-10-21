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
    const todayStr = new Date().toISOString().split("T")[0];
    const fechaDesde = searchParams.get("fecha_desde") || todayStr;
    const fechaHasta = searchParams.get("fecha_hasta") || todayStr;
    const tipoPagoId = searchParams.get("tipo_pago_id") ? parseInt(searchParams.get("tipo_pago_id")!, 10) : null;
    const usuarioId = searchParams.get("usuario_id") ? parseInt(searchParams.get("usuario_id")!, 10) : null;
    const estadoPago = (searchParams.get("estado_pago") || "TODOS").toUpperCase();
    const exportAll = searchParams.get("all") === "true";

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("page_size") || "25", 10)));
    const offset = (page - 1) * pageSize;

    const sortByParam = searchParams.get("sort_by") || "fecha_pago";
    const sortDirParam = (searchParams.get("sort_direction") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

    const sortColumns: Record<string, string> = {
      fecha_pago: "p.fecha_pago",
      numero_factura: "numero_factura",
      cliente_nombre: "cliente_nombre",
      metodo_pago: "tp.nombre",
      responsable_nombre: "responsable_nombre",
      importe: "p.monto_pago",
      estado_pago: "p.estado",
    };
    const sortSql = sortColumns[sortByParam] || "p.fecha_pago";

    // Base conditions: payments of the company, avoiding voided invoice duplicates
    const conditions: string[] = [
      "(f.empresa_id = $1 OR f.empresa_id IS NULL)",
      "UPPER(COALESCE(f.estado, '')) NOT IN ('ANULADA', 'CANCELADA')"
    ];
    const params: unknown[] = [empresaId];
    let pIdx = 2;

    if (fechaDesde) {
      conditions.push(`p.fecha_pago >= $${pIdx}`);
      params.push(`${fechaDesde} 00:00:00`);
      pIdx++;
    }

    if (fechaHasta) {
      conditions.push(`p.fecha_pago <= $${pIdx}`);
      params.push(`${fechaHasta} 23:59:59.999`);
      pIdx++;
    }

    if (tipoPagoId && !isNaN(tipoPagoId)) {
      conditions.push(`p.tipo_pago_id = $${pIdx}`);
      params.push(tipoPagoId);
      pIdx++;
    }

    if (usuarioId && !isNaN(usuarioId)) {
      conditions.push(`p.usuario_registro = $${pIdx}`);
      params.push(usuarioId);
      pIdx++;
    }

    if (estadoPago === "APLICADO") {
      conditions.push("UPPER(COALESCE(p.estado, 'APLICADO')) = 'APLICADO'");
    } else if (estadoPago === "ANULADO") {
      conditions.push("UPPER(p.estado) = 'ANULADO'");
    }

    if (search) {
      conditions.push(
        `(f.numero_factura ILIKE $${pIdx} OR f.codigo_factura ILIKE $${pIdx} OR c.nombre_completo ILIKE $${pIdx} OR CONCAT(c.nombre, ' ', c.apellido) ILIKE $${pIdx} OR p.referencia ILIKE $${pIdx} OR p.numero_transaccion ILIKE $${pIdx})`
      );
      params.push(`%${search}%`);
      pIdx++;
    }

    const whereClause = conditions.join(" AND ");

    // 1. KPI Query (Valid cash collections reconciliation)
    const kpiSql = `
      SELECT 
        COUNT(*)::int AS cantidad_transacciones,
        COALESCE(SUM(CASE WHEN UPPER(COALESCE(p.estado, 'APLICADO')) = 'APLICADO' THEN p.monto_pago ELSE 0 END), 0)::numeric AS total_cobros_efectivos,
        COALESCE(SUM(CASE WHEN UPPER(COALESCE(p.estado, 'APLICADO')) = 'APLICADO' AND tp.codigo = 'EFECTIVO' THEN p.monto_pago ELSE 0 END), 0)::numeric AS total_efectivo,
        COALESCE(SUM(CASE WHEN UPPER(COALESCE(p.estado, 'APLICADO')) = 'APLICADO' AND tp.codigo = 'TRANSFERENCIA' THEN p.monto_pago ELSE 0 END), 0)::numeric AS total_transferencia,
        COALESCE(SUM(CASE WHEN UPPER(COALESCE(p.estado, 'APLICADO')) = 'APLICADO' AND tp.codigo = 'TARJETA' THEN p.monto_pago ELSE 0 END), 0)::numeric AS total_tarjeta,
        COALESCE(SUM(CASE WHEN UPPER(COALESCE(p.estado, 'APLICADO')) = 'APLICADO' AND tp.codigo NOT IN ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA') THEN p.monto_pago ELSE 0 END), 0)::numeric AS total_otros
      FROM admin.pagos p
      LEFT JOIN admin.tipo_pago tp ON p.tipo_pago_id = tp.tipo_pago_id
      LEFT JOIN admin.facturas f ON p.factura_id = f.factura_id
      LEFT JOIN admin.clientes c ON f.cliente_id = c.cliente_id
      WHERE ${whereClause}
    `;

    const kpiResult = await query(kpiSql, params);
    const kpiRow = kpiResult[0] || {
      cantidad_transacciones: 0,
      total_cobros_efectivos: 0,
      total_efectivo: 0,
      total_transferencia: 0,
      total_tarjeta: 0,
      total_otros: 0,
    };

    const totalRecords = Number(kpiRow.cantidad_transacciones || 0);
    const totalPages = exportAll ? 1 : Math.ceil(totalRecords / pageSize);

    // 2. Summary by Payment Method
    const methodSummarySql = `
      SELECT 
        COALESCE(tp.nombre, 'Sin método') AS metodo_pago,
        COALESCE(tp.codigo, 'OTRO') AS metodo_codigo,
        COUNT(p.pago_id)::int AS cantidad,
        COALESCE(SUM(p.monto_pago), 0)::numeric AS total_monto
      FROM admin.pagos p
      LEFT JOIN admin.tipo_pago tp ON p.tipo_pago_id = tp.tipo_pago_id
      LEFT JOIN admin.facturas f ON p.factura_id = f.factura_id
      LEFT JOIN admin.clientes c ON f.cliente_id = c.cliente_id
      WHERE ${whereClause}
        AND UPPER(COALESCE(p.estado, 'APLICADO')) = 'APLICADO'
      GROUP BY tp.nombre, tp.codigo
      ORDER BY total_monto DESC
    `;
    const methodSummary = await query(methodSummarySql, params);

    // 3. Detail Data Query
    const dataSql = `
      SELECT 
        p.pago_id,
        p.fecha_pago,
        COALESCE(f.codigo_factura, f.numero_factura, CONCAT('PAGO-', p.pago_id)) AS numero_factura,
        f.factura_id,
        COALESCE(c.nombre_completo, CONCAT(c.nombre, ' ', c.apellido), 'Cliente General') AS cliente_nombre,
        COALESCE(tp.nombre, 'No especificado') AS metodo_pago,
        COALESCE(tp.codigo, 'OTRO') AS metodo_pago_codigo,
        COALESCE(NULLIF(TRIM(CONCAT(ui.nombre, ' ', ui.apellido)), ''), us.identificador_principal, ui.correo_electronico, 'Sistema') AS responsable_nombre,
        p.monto_pago::numeric AS importe,
        COALESCE(p.estado, 'APLICADO') AS estado_pago,
        p.referencia,
        p.numero_transaccion,
        p.banco
      FROM admin.pagos p
      LEFT JOIN admin.tipo_pago tp ON p.tipo_pago_id = tp.tipo_pago_id
      LEFT JOIN admin.facturas f ON p.factura_id = f.factura_id
      LEFT JOIN admin.clientes c ON f.cliente_id = c.cliente_id
      LEFT JOIN admin.usuario u ON p.usuario_registro = u.usuario_id
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      LEFT JOIN admin.usuario_seguridad us ON u.usuario_id = us.usuario_id
      WHERE ${whereClause}
      ORDER BY ${sortSql} ${sortDirParam}
      ${exportAll ? "" : `LIMIT $${pIdx} OFFSET $${pIdx + 1}`}
    `;

    const dataParams = exportAll ? params : [...params, pageSize, offset];
    const dataRows = await query(dataSql, dataParams);

    return NextResponse.json({
      kpis: {
        totalCobrosEfectivos: Number(kpiRow.total_cobros_efectivos || 0),
        totalEfectivo: Number(kpiRow.total_efectivo || 0),
        totalTransferencia: Number(kpiRow.total_transferencia || 0),
        totalTarjeta: Number(kpiRow.total_tarjeta || 0),
        totalOtros: Number(kpiRow.total_otros || 0),
        cantidadTransacciones: totalRecords,
      },
      methodSummary: methodSummary || [],
      data: dataRows || [],
      pagination: {
        page: exportAll ? 1 : page,
        pageSize: exportAll ? totalRecords : pageSize,
        total: totalRecords,
        totalPages,
      },
      meta: {
        fechaDesde,
        fechaHasta,
        generatedAt: new Date().toISOString(),
        empresaId,
      }
    });
  } catch (error: unknown) {
    console.error("Error in /api/reports/daily-cash:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Error al generar el reporte de cuadre de caja." },
      { status: 500 }
    );
  }
}
