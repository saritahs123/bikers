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
    const fechaCorte = searchParams.get("fecha_corte") || new Date().toISOString().split("T")[0];
    const categoria = (searchParams.get("categoria") || "TODOS").toUpperCase();
    const antiguedadMin = searchParams.get("antiguedad_min") ? parseInt(searchParams.get("antiguedad_min")!, 10) : null;
    const antiguedadMax = searchParams.get("antiguedad_max") ? parseInt(searchParams.get("antiguedad_max")!, 10) : null;
    const clienteId = searchParams.get("cliente_id") ? parseInt(searchParams.get("cliente_id")!, 10) : null;
    const estadoCliente = (searchParams.get("estado_cliente") || "TODOS").toUpperCase();
    const exportAll = searchParams.get("all") === "true";

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("page_size") || "25", 10)));
    const offset = (page - 1) * pageSize;

    const sortByParam = searchParams.get("sort_by") || "fecha_ultimo_servicio";
    const sortDirParam = (searchParams.get("sort_direction") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

    const sortColumns: Record<string, string> = {
      cliente_nombre: "cliente_nombre",
      telefono_principal: "telefono_principal",
      fecha_ultimo_servicio: "fecha_ultimo_servicio",
      dias_transcurridos: "dias_transcurridos",
      total_ordenes: "total_ordenes",
      monto_historico: "monto_historico",
    };
    const sortSql = sortColumns[sortByParam] || "fecha_ultimo_servicio";

    // Build subquery with CTE
    const baseConditions: string[] = [
      "c.empresa_id = $1",
      "c.fecha_eliminacion IS NULL"
    ];
    const params: unknown[] = [empresaId, fechaCorte];
    let pIdx = 3;

    if (estadoCliente === "ACTIVO") {
      baseConditions.push("c.activo = true");
    } else if (estadoCliente === "INACTIVO") {
      baseConditions.push("c.activo = false");
    }

    if (clienteId && !isNaN(clienteId)) {
      baseConditions.push(`c.cliente_id = $${pIdx}`);
      params.push(clienteId);
      pIdx++;
    }

    if (search) {
      baseConditions.push(
        `(c.nombre_completo ILIKE $${pIdx} OR CONCAT(c.nombre, ' ', c.apellido) ILIKE $${pIdx} OR c.telefono_principal ILIKE $${pIdx} OR c.identificacion ILIKE $${pIdx})`
      );
      params.push(`%${search}%`);
      pIdx++;
    }

    // Outer conditions for category and days
    const outerConditions: string[] = [];

    if (categoria === "0_30") {
      outerConditions.push("categoria_antiguedad = '0_30'");
    } else if (categoria === "31_60") {
      outerConditions.push("categoria_antiguedad = '31_60'");
    } else if (categoria === "61_90") {
      outerConditions.push("categoria_antiguedad = '61_90'");
    } else if (categoria === "MAS_90") {
      outerConditions.push("categoria_antiguedad = 'MAS_90'");
    } else if (categoria === "SIN_SERVICIOS") {
      outerConditions.push("categoria_antiguedad = 'SIN_SERVICIOS'");
    }

    if (antiguedadMin !== null && !isNaN(antiguedadMin)) {
      outerConditions.push(`dias_transcurridos >= $${pIdx}`);
      params.push(antiguedadMin);
      pIdx++;
    }

    if (antiguedadMax !== null && !isNaN(antiguedadMax)) {
      outerConditions.push(`dias_transcurridos <= $${pIdx}`);
      params.push(antiguedadMax);
      pIdx++;
    }

    const outerWhere = outerConditions.length > 0 ? `WHERE ${outerConditions.join(" AND ")}` : "";

    const cteSql = `
      WITH cliente_servicios AS (
        SELECT 
          c.cliente_id,
          COALESCE(c.nombre_completo, CONCAT(c.nombre, ' ', c.apellido)) AS cliente_nombre,
          c.telefono_principal,
          c.identificacion,
          c.activo AS cliente_activo,
          COUNT(ot.orden_trabajo_id)::int AS total_ordenes,
          COALESCE(SUM(ot.total_orden), 0)::numeric AS monto_historico,
          MAX(COALESCE(ot.fecha_entrega_real, ot.fecha_finalizacion, ot.fecha_recepcion, ot.fecha_registro)) AS fecha_ultimo_servicio
        FROM admin.clientes c
        LEFT JOIN admin.ordenes_trabajo ot ON c.cliente_id = ot.cliente_id 
          AND (ot.activo = true OR ot.activo IS NULL)
          AND COALESCE(ot.fecha_registro, ot.fecha_recepcion) <= ($2::timestamp + interval '1 day' - interval '1 millisecond')
        WHERE ${baseConditions.join(" AND ")}
        GROUP BY c.cliente_id, c.nombre_completo, c.nombre, c.apellido, c.telefono_principal, c.identificacion, c.activo
      ),
      actividad AS (
        SELECT 
          cs.*,
          CASE 
            WHEN cs.fecha_ultimo_servicio IS NOT NULL THEN 
              GREATEST(0, ($2::date - cs.fecha_ultimo_servicio::date))
            ELSE NULL 
          END AS dias_transcurridos,
          CASE 
            WHEN cs.fecha_ultimo_servicio IS NULL THEN 'SIN_SERVICIOS'
            WHEN ($2::date - cs.fecha_ultimo_servicio::date) <= 30 THEN '0_30'
            WHEN ($2::date - cs.fecha_ultimo_servicio::date) <= 60 THEN '31_60'
            WHEN ($2::date - cs.fecha_ultimo_servicio::date) <= 90 THEN '61_90'
            ELSE 'MAS_90'
          END AS categoria_antiguedad
        FROM cliente_servicios cs
      )
    `;

    // 1. KPI Query
    const kpiSql = `
      ${cteSql}
      SELECT 
        COUNT(*)::int AS total_clientes,
        COUNT(CASE WHEN categoria_antiguedad = '0_30' THEN 1 END)::int AS recientes_0_30,
        COUNT(CASE WHEN categoria_antiguedad = '31_60' THEN 1 END)::int AS moderados_31_60,
        COUNT(CASE WHEN categoria_antiguedad = '61_90' THEN 1 END)::int AS inactivos_61_90,
        COUNT(CASE WHEN categoria_antiguedad = 'MAS_90' THEN 1 END)::int AS inactivos_mas_90,
        COUNT(CASE WHEN categoria_antiguedad = 'SIN_SERVICIOS' THEN 1 END)::int AS sin_servicios,
        ROUND(AVG(dias_transcurridos), 1)::numeric AS promedio_dias,
        COALESCE(SUM(monto_historico), 0)::numeric AS monto_total_historico
      FROM actividad
      ${outerWhere}
    `;

    const kpiResult = await query(kpiSql, params);
    const kpiRow = kpiResult[0] || {
      total_clientes: 0,
      recientes_0_30: 0,
      moderados_31_60: 0,
      inactivos_61_90: 0,
      inactivos_mas_90: 0,
      sin_servicios: 0,
      promedio_dias: 0,
      monto_total_historico: 0,
    };

    const totalRecords = Number(kpiRow.total_clientes || 0);
    const totalPages = exportAll ? 1 : Math.ceil(totalRecords / pageSize);

    // 2. Data Query
    const dataSql = `
      ${cteSql}
      SELECT 
        cliente_id,
        cliente_nombre,
        telefono_principal,
        identificacion,
        cliente_activo,
        fecha_ultimo_servicio,
        dias_transcurridos,
        categoria_antiguedad,
        CASE 
          WHEN categoria_antiguedad = '0_30' THEN '0–30 días (Reciente)'
          WHEN categoria_antiguedad = '31_60' THEN '31–60 días'
          WHEN categoria_antiguedad = '61_90' THEN '61–90 días'
          WHEN categoria_antiguedad = 'MAS_90' THEN 'Más de 90 días'
          ELSE 'Sin servicios registrados'
        END AS categoria_etiqueta,
        total_ordenes,
        monto_historico
      FROM actividad
      ${outerWhere}
      ORDER BY ${sortSql} ${sortDirParam} NULLS LAST
      ${exportAll ? "" : `LIMIT $${pIdx} OFFSET $${pIdx + 1}`}
    `;

    const dataParams = exportAll ? params : [...params, pageSize, offset];
    const dataRows = await query(dataSql, dataParams);

    const sinRecientes = Number(kpiRow.moderados_31_60 || 0) + Number(kpiRow.inactivos_61_90 || 0) + Number(kpiRow.inactivos_mas_90 || 0) + Number(kpiRow.sin_servicios || 0);

    return NextResponse.json({
      kpis: {
        totalClientes: totalRecords,
        clientesRecientes: Number(kpiRow.recientes_0_30 || 0),
        clientesSinServiciosRecientes: sinRecientes,
        promedioDias: Number(kpiRow.promedio_dias || 0),
        distribucion: {
          cat0_30: Number(kpiRow.recientes_0_30 || 0),
          cat31_60: Number(kpiRow.moderados_31_60 || 0),
          cat61_90: Number(kpiRow.inactivos_61_90 || 0),
          catMas90: Number(kpiRow.inactivos_mas_90 || 0),
          sinServicios: Number(kpiRow.sin_servicios || 0),
        },
        montoTotalHistorico: Number(kpiRow.monto_total_historico || 0),
      },
      data: dataRows || [],
      pagination: {
        page: exportAll ? 1 : page,
        pageSize: exportAll ? totalRecords : pageSize,
        total: totalRecords,
        totalPages,
      },
      meta: {
        fechaCorte,
        generatedAt: new Date().toISOString(),
        empresaId,
      }
    });
  } catch (error: unknown) {
    console.error("Error in /api/reports/customer-activity:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Error al generar el reporte de actividad de clientes." },
      { status: 500 }
    );
  }
}
