import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getScreenPermissions } from "@/lib/workshop-session";

export async function GET(req: NextRequest) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    const perms = await getScreenPermissions("/reports/inventory-supplier", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No cuenta con autorización para acceder a este reporte." },
        { status: 403 }
      );
    }

    const empresaId = session.empresa_id;
    const { searchParams } = new URL(req.url);

    // Filters
    const search = (searchParams.get("search") || "").trim();
    const proveedorIdParam = searchParams.get("proveedor_id");
    const categoriaId = searchParams.get("categoria_id") ? parseInt(searchParams.get("categoria_id")!, 10) : null;
    const estadoProducto = (searchParams.get("estado_producto") || "TODOS").toUpperCase();
    const exportAll = searchParams.get("all") === "true";

    if (exportAll && !perms.puede_exportar) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No cuenta con privilegios para exportar este reporte." },
        { status: 403 }
      );
    }

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("page_size") || "25", 10)));
    const offset = (page - 1) * pageSize;

    const sortByParam = searchParams.get("sort_by") || "suplidor_nombre";
    const sortDirParam = (searchParams.get("sort_direction") || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";

    const sortColumns: Record<string, string> = {
      suplidor_nombre: "ps.suplidor_nombre",
      codigo_producto: "ps.codigo_producto",
      producto_nombre: "ps.producto_nombre",
      categoria_nombre: "ps.categoria_nombre",
      existencia_actual: "ps.existencia_actual",
      costo_unitario: "ps.costo_unitario",
      valor_total: "ps.valor_total",
    };
    const sortSql = sortColumns[sortByParam] || "ps.suplidor_nombre";

    // Base conditions on products
    const conditions: string[] = ["p.empresa_id = $1"];
    const params: unknown[] = [empresaId];
    let pIdx = 2;

    if (estadoProducto === "ACTIVO") {
      conditions.push("(p.estado = 'ACTIVO' OR p.estado IS NULL)");
    } else if (estadoProducto === "INACTIVO") {
      conditions.push("p.estado = 'INACTIVO'");
    }

    if (categoriaId && !isNaN(categoriaId)) {
      conditions.push(`p.categoria_producto_id = $${pIdx}`);
      params.push(categoriaId);
      pIdx++;
    }

    if (search) {
      conditions.push(
        `(p.codigo_producto ILIKE $${pIdx} OR p.nombre ILIKE $${pIdx} OR cp.nombre ILIKE $${pIdx} OR COALESCE(prov.nombre_comercial, 'Sin suplidor asignado') ILIKE $${pIdx})`
      );
      params.push(`%${search}%`);
      pIdx++;
    }

    // Save base params before supplier filter is added (used for global supplier summaries)
    const baseParams = [...params];

    // Outer conditions for supplier
    const outerConditions: string[] = [];
    if (proveedorIdParam !== null && proveedorIdParam !== "" && proveedorIdParam !== "TODOS") {
      const pId = parseInt(proveedorIdParam, 10);
      if (pId === 0) {
        outerConditions.push("ps.proveedor_id = 0");
      } else if (!isNaN(pId)) {
        outerConditions.push(`ps.proveedor_id = $${pIdx}`);
        params.push(pId);
        pIdx++;
      }
    }

    const outerWhere = outerConditions.length > 0 ? `WHERE ${outerConditions.join(" AND ")}` : "";

    const cteSql = `
      WITH stock_prod AS (
        SELECT 
          ep.producto_id,
          SUM(ep.cantidad_actual) AS existencia_total,
          CASE 
            WHEN SUM(ep.cantidad_actual) > 0 THEN 
              SUM(ep.cantidad_actual * COALESCE(ep.costo_promedio, p.costo_actual, 0)) / SUM(ep.cantidad_actual)
            ELSE COALESCE(MAX(ep.costo_promedio), MAX(p.costo_actual), 0)
          END AS costo_unitario,
          SUM(ep.cantidad_actual * COALESCE(ep.costo_promedio, p.costo_actual, 0)) AS valor_total
        FROM admin.productos p
        LEFT JOIN admin.existencias_producto ep ON p.producto_id = ep.producto_id AND ep.empresa_id = p.empresa_id
        WHERE p.empresa_id = $1
        GROUP BY ep.producto_id, p.costo_actual
      ),
      prod_supplier AS (
        SELECT 
          p.producto_id,
          p.codigo_producto,
          p.nombre AS producto_nombre,
          p.estado AS producto_estado,
          cp.categoria_producto_id,
          COALESCE(cp.nombre, 'Sin categoría') AS categoria_nombre,
          COALESCE(prov.proveedor_id, 0) AS proveedor_id,
          COALESCE(prov.nombre_comercial, 'Sin suplidor asignado') AS suplidor_nombre,
          COALESCE(sp.existencia_total, 0)::numeric AS existencia_actual,
          COALESCE(sp.costo_unitario, p.costo_actual, 0)::numeric AS costo_unitario,
          COALESCE(sp.valor_total, 0)::numeric AS valor_total
        FROM admin.productos p
        LEFT JOIN stock_prod sp ON p.producto_id = sp.producto_id
        LEFT JOIN admin.categoria_producto cp ON p.categoria_producto_id = cp.categoria_producto_id
        LEFT JOIN LATERAL (
          SELECT pp.proveedor_id, pr.nombre_comercial
          FROM admin.producto_proveedor pp
          JOIN admin.proveedores pr ON pp.proveedor_id = pr.proveedor_id
          WHERE pp.producto_id = p.producto_id
            AND pr.empresa_id = p.empresa_id
            AND (UPPER(pp.estado) = 'ACTIVO' OR pp.estado IS NULL)
            AND (UPPER(pr.estado) = 'ACTIVO' OR pr.estado IS NULL)
          ORDER BY pp.proveedor_principal DESC NULLS LAST, pp.producto_proveedor_id ASC
          LIMIT 1
        ) prov ON true
        WHERE ${conditions.join(" AND ")}
      )
    `;

    // 1. KPI Query
    const kpiSql = `
      ${cteSql}
      SELECT 
        COUNT(*)::int AS total_productos,
        COALESCE(SUM(ps.existencia_actual), 0)::numeric AS total_unidades,
        COALESCE(SUM(ps.valor_total), 0)::numeric AS valor_total_inventario,
        COUNT(DISTINCT NULLIF(ps.proveedor_id, 0))::int AS total_suplidores
      FROM prod_supplier ps
      ${outerWhere}
    `;

    const kpiResult = await query(kpiSql, params);
    const kpiRow = kpiResult[0] || {
      total_productos: 0,
      total_unidades: 0,
      valor_total_inventario: 0,
      total_suplidores: 0,
    };

    const totalRecords = Number(kpiRow.total_productos || 0);
    const totalPages = exportAll ? 1 : Math.ceil(totalRecords / pageSize);

    // 2. Supplier Subtotals Summary Query (for summary sheet & badges)
    const summarySql = `
      ${cteSql}
      SELECT 
        ps.proveedor_id,
        ps.suplidor_nombre,
        COUNT(ps.producto_id)::int AS cantidad_productos,
        COALESCE(SUM(ps.existencia_actual), 0)::numeric AS total_unidades,
        COALESCE(SUM(ps.valor_total), 0)::numeric AS subtotal_valor
      FROM prod_supplier ps
      GROUP BY ps.proveedor_id, ps.suplidor_nombre
      ORDER BY ps.suplidor_nombre ASC
    `;
    const supplierSummary = await query(summarySql, baseParams);

    // 3. Detail Data Query
    const dataSql = `
      ${cteSql}
      SELECT 
        ps.*,
        SUM(ps.existencia_actual) OVER (PARTITION BY ps.proveedor_id)::numeric AS subtotal_suplidor_unidades,
        SUM(ps.valor_total) OVER (PARTITION BY ps.proveedor_id)::numeric AS subtotal_suplidor_valor
      FROM prod_supplier ps
      ${outerWhere}
      ORDER BY ${sortSql} ${sortDirParam}, ps.producto_nombre ASC
      ${exportAll ? "" : `LIMIT $${pIdx} OFFSET $${pIdx + 1}`}
    `;

    const dataParams = exportAll ? params : [...params, pageSize, offset];
    const dataRows = await query(dataSql, dataParams);

    return NextResponse.json({
      kpis: {
        totalUnidades: Number(kpiRow.total_unidades || 0),
        totalProductos: totalRecords,
        valorTotalInventario: Number(kpiRow.valor_total_inventario || 0),
        totalSuplidores: Number(kpiRow.total_suplidores || 0),
      },
      supplierSummary: supplierSummary || [],
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
    console.error("Error in /api/reports/inventory-supplier:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Error al generar el reporte de inventario por suplidor." },
      { status: 500 }
    );
  }
}
