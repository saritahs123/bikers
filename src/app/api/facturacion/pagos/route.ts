import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

export const dynamic = "force-dynamic";

interface PagoListRow {
  pago_id: number;
  empresa_id: number;
  factura_id: number;
  codigo_factura: string;
  factura_estado: string;
  factura_total: number | string;
  factura_monto_pagado: number | string;
  factura_balance_pendiente: number | string;
  cliente_id: number | null;
  cliente_nombre: string | null;
  cliente_identificacion: string | null;
  cliente_telefono: string | null;
  tipo_pago_id: number;
  tipo_pago_codigo: string;
  tipo_pago_nombre: string;
  monto: number | string;
  referencia: string | null;
  observacion: string | null;
  fecha_pago: string | Date;
  estado: string;
  fecha_creacion: string | Date;
  usuario_id: number | null;
  usuario_nombre: string | null;
}

interface MetricasPagosRow {
  total_pagos: number | string;
  total_cobrado: number | string;
  efectivo: number | string;
  tarjeta: number | string;
  transferencia: number | string;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    const perms = await getModulePermissions("FACTURACION", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permisos para consultar pagos de facturación." },
        { status: 403 }
      );
    }

    const empresaId = session.empresa_id;
    const { searchParams } = new URL(request.url);

    const search = (searchParams.get("search") || "").trim();
    const tipoPago = (searchParams.get("tipo_pago") || "").trim();
    const fechaDesde = (searchParams.get("fecha_desde") || "").trim();
    const fechaHasta = (searchParams.get("fecha_hasta") || "").trim();

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));
    const offset = (page - 1) * limit;

    const sortByParam = (searchParams.get("sortBy") || "fecha").toLowerCase();
    const sortOrderParam = (searchParams.get("sortOrder") || "desc").toUpperCase() === "ASC" ? "ASC" : "DESC";

    // Whitelist segura para ordenamiento (Sección 14)
    const sortColumns: Record<string, string> = {
      fecha: "p.fecha_pago",
      fecha_pago: "p.fecha_pago",
      factura: "f.codigo_factura",
      codigo_factura: "f.codigo_factura",
      cliente: "COALESCE(c.nombre_completo, 'Consumidor Final')",
      tipo_pago: "tp.nombre",
      monto: "p.monto",
      pago_id: "p.pago_id"
    };
    const sortColumn = sortColumns[sortByParam] || "p.fecha_pago";

    // Filtro estricto multitenant (Sección 15)
    const conditions: string[] = ["p.empresa_id = $1", "f.empresa_id = $1"];
    const params: (number | string)[] = [empresaId];
    let paramIndex = 2;

    if (search) {
      conditions.push(
        `(f.codigo_factura ILIKE $${paramIndex} OR c.nombre_completo ILIKE $${paramIndex} OR c.identificacion ILIKE $${paramIndex} OR p.referencia ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (tipoPago && tipoPago !== "TODOS") {
      if (!isNaN(Number(tipoPago))) {
        conditions.push(`p.tipo_pago_id = $${paramIndex}`);
        params.push(Number(tipoPago));
      } else {
        conditions.push(`tp.codigo = $${paramIndex}`);
        params.push(tipoPago);
      }
      paramIndex++;
    }

    if (fechaDesde) {
      conditions.push(`(p.fecha_pago AT TIME ZONE 'America/Santo_Domingo')::date >= $${paramIndex}::date`);
      params.push(fechaDesde);
      paramIndex++;
    }

    if (fechaHasta) {
      conditions.push(`(p.fecha_pago AT TIME ZONE 'America/Santo_Domingo')::date <= $${paramIndex}::date`);
      params.push(fechaHasta);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    // 1. Consulta agregada de métricas respetando filtros activos (Sección 3 & 12)
    const metricasSql = `
      SELECT
        COUNT(*)::int AS total_pagos,
        COALESCE(SUM(CASE WHEN p.estado = 'APLICADO' THEN p.monto ELSE 0 END), 0)::numeric AS total_cobrado,
        COALESCE(SUM(CASE WHEN p.estado = 'APLICADO' AND UPPER(tp.codigo) = 'EFECTIVO' THEN p.monto ELSE 0 END), 0)::numeric AS efectivo,
        COALESCE(SUM(CASE WHEN p.estado = 'APLICADO' AND UPPER(tp.codigo) = 'TARJETA' THEN p.monto ELSE 0 END), 0)::numeric AS tarjeta,
        COALESCE(SUM(CASE WHEN p.estado = 'APLICADO' AND UPPER(tp.codigo) = 'TRANSFERENCIA' THEN p.monto ELSE 0 END), 0)::numeric AS transferencia
      FROM admin.pagos p
      JOIN admin.tipo_pago tp ON p.tipo_pago_id = tp.tipo_pago_id
      JOIN admin.facturas f ON p.factura_id = f.factura_id
      LEFT JOIN admin.clientes c ON f.cliente_id = c.cliente_id
      WHERE ${whereClause};
    `;
    const metricasRes = await query<MetricasPagosRow>(metricasSql, params);
    const metricasRow = metricasRes[0] || {
      total_pagos: 0,
      total_cobrado: 0,
      efectivo: 0,
      tarjeta: 0,
      transferencia: 0
    };

    const totalRecords = Number(metricasRow.total_pagos || 0);
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));

    // 2. Consulta de pagos paginados (Sección 4, 11, 20)
    const listParams = [...params, limit, offset];
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const listSql = `
      SELECT
        p.pago_id,
        p.empresa_id,
        p.factura_id,
        f.codigo_factura,
        f.estado AS factura_estado,
        f.total AS factura_total,
        f.monto_pagado AS factura_monto_pagado,
        f.balance_pendiente AS factura_balance_pendiente,
        f.cliente_id,
        COALESCE(c.nombre_completo, 'Consumidor Final') AS cliente_nombre,
        c.identificacion AS cliente_identificacion,
        c.telefono_principal AS cliente_telefono,
        p.tipo_pago_id,
        tp.codigo AS tipo_pago_codigo,
        tp.nombre AS tipo_pago_nombre,
        p.monto,
        p.referencia,
        p.observacion,
        p.fecha_pago,
        p.estado,
        p.fecha_creacion,
        p.usuario_id,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), ui.correo_electronico, 'Usuario no disponible') AS usuario_nombre
      FROM admin.pagos p
      JOIN admin.tipo_pago tp ON p.tipo_pago_id = tp.tipo_pago_id
      JOIN admin.facturas f ON p.factura_id = f.factura_id
      LEFT JOIN admin.clientes c ON f.cliente_id = c.cliente_id
      LEFT JOIN admin.usuario u ON p.usuario_id = u.usuario_id
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${sortOrderParam}, p.pago_id DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex};
    `;

    const rawRows = await query<PagoListRow>(listSql, listParams);

    const data = (rawRows || []).map((row) => ({
      pago_id: Number(row.pago_id),
      factura_id: Number(row.factura_id),
      codigo_factura: row.codigo_factura,
      factura_estado: row.factura_estado,
      factura_total: parseFloat(Number(row.factura_total || 0).toFixed(2)),
      factura_monto_pagado: parseFloat(Number(row.factura_monto_pagado || 0).toFixed(2)),
      factura_balance_pendiente: parseFloat(Number(row.factura_balance_pendiente || 0).toFixed(2)),
      cliente_id: row.cliente_id ? Number(row.cliente_id) : null,
      cliente_nombre: row.cliente_nombre || "Consumidor Final",
      cliente_identificacion: row.cliente_identificacion || null,
      cliente_telefono: row.cliente_telefono || null,
      tipo_pago_id: Number(row.tipo_pago_id),
      tipo_pago_codigo: row.tipo_pago_codigo,
      tipo_pago_nombre: row.tipo_pago_nombre,
      monto: parseFloat(Number(row.monto || 0).toFixed(2)),
      referencia: row.referencia || null,
      observacion: row.observacion || null,
      fecha_pago: row.fecha_pago,
      estado: row.estado,
      usuario_id: row.usuario_id ? Number(row.usuario_id) : null,
      usuario_nombre: row.usuario_nombre || "Usuario no disponible"
    }));

    return NextResponse.json({
      success: true,
      data,
      summary: {
        total_cobrado: parseFloat(Number(metricasRow.total_cobrado || 0).toFixed(2)),
        efectivo: parseFloat(Number(metricasRow.efectivo || 0).toFixed(2)),
        tarjeta: parseFloat(Number(metricasRow.tarjeta || 0).toFixed(2)),
        transferencia: parseFloat(Number(metricasRow.transferencia || 0).toFixed(2)),
        total_pagos: totalRecords
      },
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages
      }
    });
  } catch (err: unknown) {
    console.error("Error en GET /api/facturacion/pagos:", err);
    const errorMessage = err instanceof Error ? err.message : "Error al obtener historial de pagos.";
    return NextResponse.json(
      { error: "ERROR_LISTADO_PAGOS", message: errorMessage },
      { status: 500 }
    );
  }
}
