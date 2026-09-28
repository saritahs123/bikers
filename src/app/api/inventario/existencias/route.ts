import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

// GET /api/inventario/existencias
export async function GET(req: NextRequest) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    const perms = await getModulePermissions("INVENTARIO", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permisos para consultar existencias de inventario." },
        { status: 403 }
      );
    }

    const empresaId = session.empresa_id;
    const { searchParams } = new URL(req.url);

    const search = (searchParams.get("search") || "").trim();
    const almacenId = searchParams.get("almacen_id") ? parseInt(searchParams.get("almacen_id")!, 10) : null;
    const proveedorId = searchParams.get("proveedor_id") ? parseInt(searchParams.get("proveedor_id")!, 10) : null;
    const estadoStock = (searchParams.get("estado_stock") || "TODOS").toUpperCase();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("page_size") || "25", 10)));
    const offset = (page - 1) * pageSize;

    const sortByParam = searchParams.get("sort_by") || "producto_nombre";
    const sortDirParam = (searchParams.get("sort_direction") || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";

    // Whitelist for sort columns
    const sortMapping: Record<string, string> = {
      producto_nombre: "p.nombre",
      codigo_producto: "p.codigo_producto",
      almacen_nombre: "a.nombre",
      cantidad_actual: "ep.cantidad_actual",
      stock_disponible: "(ep.cantidad_actual - COALESCE(ep.cantidad_reservada, 0))",
      costo_promedio: "ep.costo_promedio",
      valor_inventario: "(ep.cantidad_actual * ep.costo_promedio)",
      fecha_ultimo_movimiento: "ep.fecha_ultimo_movimiento",
      marca: "mp.nombre",
      proveedor: `CASE 
        WHEN prov_info.total_proveedores = 0 THEN 'ZZZZ' 
        WHEN prov_info.proveedor_nombre_principal IS NOT NULL THEN prov_info.proveedor_nombre_principal 
        WHEN prov_info.total_proveedores = 1 THEN prov_info.proveedor_primer_nombre 
        ELSE 'Varios proveedores' 
      END`,
      categoria: "cp.nombre"
    };

    const sortColumn = sortMapping[sortByParam] || "p.nombre";

    // Build WHERE clause
    const conditions: string[] = ["ep.empresa_id = $1", "p.empresa_id = $1", "a.empresa_id = $1"];
    const params: unknown[] = [empresaId];
    let paramIndex = 2;

    if (search) {
      conditions.push(
        `(p.codigo_producto ILIKE $${paramIndex} 
          OR p.nombre ILIKE $${paramIndex} 
          OR mp.nombre ILIKE $${paramIndex} 
          OR cp.nombre ILIKE $${paramIndex} 
          OR a.nombre ILIKE $${paramIndex}
          OR EXISTS (
            SELECT 1 
            FROM admin.producto_proveedor pp_s
            JOIN admin.proveedores pr_s ON pp_s.proveedor_id = pr_s.proveedor_id
            WHERE pp_s.producto_id = p.producto_id
              AND pr_s.empresa_id = p.empresa_id
              AND pr_s.nombre_comercial ILIKE $${paramIndex}
              AND (UPPER(pp_s.estado) = 'ACTIVO' OR pp_s.estado IS NULL)
              AND (UPPER(pr_s.estado) = 'ACTIVO' OR pr_s.estado IS NULL)
          )
        )`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (almacenId && !isNaN(almacenId)) {
      conditions.push(`ep.almacen_id = $${paramIndex}`);
      params.push(almacenId);
      paramIndex++;
    }

    if (proveedorId && !isNaN(proveedorId)) {
      conditions.push(
        `EXISTS (
          SELECT 1 
          FROM admin.producto_proveedor pp_f
          JOIN admin.proveedores pr_f ON pp_f.proveedor_id = pr_f.proveedor_id
          WHERE pp_f.producto_id = p.producto_id
            AND pp_f.proveedor_id = $${paramIndex}
            AND pr_f.empresa_id = p.empresa_id
            AND (UPPER(pp_f.estado) = 'ACTIVO' OR pp_f.estado IS NULL)
            AND (UPPER(pr_f.estado) = 'ACTIVO' OR pr_f.estado IS NULL)
        )`
      );
      params.push(proveedorId);
      paramIndex++;
    }

    if (estadoStock === "CON_STOCK") {
      conditions.push("ep.cantidad_actual > 0");
    } else if (estadoStock === "BAJO_MINIMO") {
      conditions.push("ep.cantidad_actual > 0 AND ep.cantidad_actual <= COALESCE(NULLIF(ep.stock_minimo, 0), p.stock_minimo, 0)");
    } else if (estadoStock === "SIN_STOCK") {
      conditions.push("ep.cantidad_actual = 0");
    }

    const whereSql = conditions.join(" AND ");

    // 1. Total Count Query
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM admin.existencias_producto ep
      JOIN admin.productos p ON ep.producto_id = p.producto_id AND p.empresa_id = ep.empresa_id
      JOIN admin.almacenes a ON ep.almacen_id = a.almacen_id AND a.empresa_id = ep.empresa_id
      LEFT JOIN admin.marca_producto mp ON p.marca_producto_id = mp.marca_producto_id
      LEFT JOIN admin.categoria_producto cp ON p.categoria_producto_id = cp.categoria_producto_id
      WHERE ${whereSql}
    `;
    const countRes = await query(countSql, params);
    const total = countRes[0]?.total || 0;
    const totalPages = Math.ceil(total / pageSize);

    // 2. Data Query
    const dataSql = `
      SELECT 
        ep.existencia_producto_id,
        ep.producto_id,
        p.codigo_producto,
        p.nombre AS producto_nombre,
        mp.nombre AS marca_nombre,
        cp.nombre AS categoria_nombre,
        um.codigo AS unidad_medida_codigo,
        um.nombre AS unidad_medida_nombre,
        ep.almacen_id,
        a.codigo AS almacen_codigo,
        a.nombre AS almacen_nombre,
        ep.cantidad_actual::numeric AS cantidad_actual,
        COALESCE(ep.cantidad_reservada, 0)::numeric AS cantidad_reservada,
        (ep.cantidad_actual - COALESCE(ep.cantidad_reservada, 0))::numeric AS stock_disponible,
        COALESCE(NULLIF(ep.stock_minimo, 0), p.stock_minimo, 0)::numeric AS stock_minimo,
        COALESCE(NULLIF(ep.stock_maximo, 0), p.stock_maximo)::numeric AS stock_maximo,
        COALESCE(ep.costo_promedio, 0)::numeric AS costo_promedio,
        (ep.cantidad_actual * COALESCE(ep.costo_promedio, 0))::numeric AS valor_inventario,
        ep.ubicacion_fisica,
        ep.fecha_ultimo_movimiento,
        COALESCE(ep.estado, 'ACTIVO') AS estado,
        CASE 
          WHEN ep.cantidad_actual = 0 THEN 'SIN_STOCK'
          WHEN ep.cantidad_actual <= COALESCE(NULLIF(ep.stock_minimo, 0), p.stock_minimo, 0) THEN 'BAJO_MINIMO'
          ELSE 'NORMAL'
        END AS estado_stock,
        prov_info.proveedor_nombre_principal,
        prov_info.proveedor_primer_nombre,
        COALESCE(prov_info.total_proveedores, 0) AS total_proveedores,
        COALESCE(prov_info.proveedores_lista, ARRAY[]::text[]) AS proveedores_lista
      FROM admin.existencias_producto ep
      JOIN admin.productos p ON ep.producto_id = p.producto_id AND p.empresa_id = ep.empresa_id
      JOIN admin.almacenes a ON ep.almacen_id = a.almacen_id AND a.empresa_id = ep.empresa_id
      LEFT JOIN admin.unidad_medida um ON p.unidad_medida_id = um.unidad_medida_id
      LEFT JOIN admin.marca_producto mp ON p.marca_producto_id = mp.marca_producto_id
      LEFT JOIN admin.categoria_producto cp ON p.categoria_producto_id = cp.categoria_producto_id
      LEFT JOIN LATERAL (
        SELECT 
          (
            SELECT pr1.nombre_comercial
            FROM admin.producto_proveedor pp1
            JOIN admin.proveedores pr1 ON pp1.proveedor_id = pr1.proveedor_id
            WHERE pp1.producto_id = p.producto_id 
              AND pr1.empresa_id = p.empresa_id
              AND pp1.proveedor_principal = true
              AND (UPPER(pp1.estado) = 'ACTIVO' OR pp1.estado IS NULL)
              AND (UPPER(pr1.estado) = 'ACTIVO' OR pr1.estado IS NULL)
            LIMIT 1
          ) AS proveedor_nombre_principal,
          (
            SELECT pr_single.nombre_comercial
            FROM admin.producto_proveedor pp_single
            JOIN admin.proveedores pr_single ON pp_single.proveedor_id = pr_single.proveedor_id
            WHERE pp_single.producto_id = p.producto_id
              AND pr_single.empresa_id = p.empresa_id
              AND (UPPER(pp_single.estado) = 'ACTIVO' OR pp_single.estado IS NULL)
              AND (UPPER(pr_single.estado) = 'ACTIVO' OR pr_single.estado IS NULL)
            LIMIT 1
          ) AS proveedor_primer_nombre,
          COUNT(DISTINCT pp_all.proveedor_id)::int AS total_proveedores,
          ARRAY_AGG(DISTINCT pr_all.nombre_comercial) FILTER (WHERE pr_all.nombre_comercial IS NOT NULL) AS proveedores_lista
        FROM admin.producto_proveedor pp_all
        JOIN admin.proveedores pr_all ON pp_all.proveedor_id = pr_all.proveedor_id
        WHERE pp_all.producto_id = p.producto_id
          AND pr_all.empresa_id = p.empresa_id
          AND (UPPER(pp_all.estado) = 'ACTIVO' OR pp_all.estado IS NULL)
          AND (UPPER(pr_all.estado) = 'ACTIVO' OR pr_all.estado IS NULL)
      ) prov_info ON true
      WHERE ${whereSql}
      ORDER BY ${sortColumn} ${sortDirParam}, p.nombre ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataParams = [...params, pageSize, offset];
    const rows = await query(dataSql, dataParams);

    // 3. Lookups Query (Almacenes & Proveedores for filters)
    const almacenesRes = await query(
      `SELECT almacen_id, codigo, nombre
       FROM admin.almacenes
       WHERE empresa_id = $1 AND (UPPER(estado) = 'ACTIVO' OR estado IS NULL)
       ORDER BY nombre ASC`,
      [empresaId]
    );

    const proveedoresRes = await query(
      `SELECT proveedor_id, codigo_proveedor, nombre_comercial
       FROM admin.proveedores
       WHERE empresa_id = $1 AND (UPPER(estado) = 'ACTIVO' OR estado IS NULL)
       ORDER BY nombre_comercial ASC`,
      [empresaId]
    );

    interface ExistenciaDbRow {
      existencia_producto_id: number;
      producto_id: number;
      codigo_producto: string;
      producto_nombre: string;
      marca_nombre: string | null;
      categoria_nombre: string | null;
      unidad_medida_codigo: string | null;
      unidad_medida_nombre: string | null;
      almacen_id: number;
      almacen_codigo: string;
      almacen_nombre: string;
      cantidad_actual: string | number;
      cantidad_reservada: string | number;
      stock_disponible: string | number;
      stock_minimo: string | number;
      stock_maximo: string | number | null;
      costo_promedio: string | number;
      valor_inventario: string | number;
      ubicacion_fisica: string | null;
      fecha_ultimo_movimiento: Date | string | null;
      estado: string;
      estado_stock: string;
      proveedor_nombre_principal: string | null;
      proveedor_primer_nombre: string | null;
      total_proveedores: number;
      proveedores_lista: string[];
    }

    const items = (rows as ExistenciaDbRow[]).map((r) => {
      const totalProvs = Number(r.total_proveedores || 0);
      const provPrincipal = r.proveedor_nombre_principal || null;
      const tienePrincipal = Boolean(provPrincipal);
      const provLista = Array.isArray(r.proveedores_lista) ? r.proveedores_lista : [];

      const sortedLista = tienePrincipal
        ? [provPrincipal!, ...provLista.filter((p) => p !== provPrincipal)]
        : provLista;

      let proveedorTexto: string;
      if (totalProvs === 0) {
        proveedorTexto = "Sin proveedor";
      } else if (totalProvs === 1) {
        proveedorTexto = provPrincipal || r.proveedor_primer_nombre || provLista[0] || "Sin proveedor";
      } else if (tienePrincipal) {
        proveedorTexto = provPrincipal!;
      } else {
        proveedorTexto = `Varios proveedores (${totalProvs})`;
      }

      return {
        existencia_producto_id: r.existencia_producto_id,
        producto_id: r.producto_id,
        codigo_producto: r.codigo_producto,
        producto_nombre: r.producto_nombre,
        marca: r.marca_nombre || "—",
        proveedor: proveedorTexto,
        proveedor_principal: provPrincipal,
        tiene_proveedor_principal: tienePrincipal,
        total_proveedores: totalProvs,
        proveedores_lista: sortedLista,
        categoria: r.categoria_nombre || "—",
        unidad_medida: r.unidad_medida_codigo || "UND",
        almacen_id: r.almacen_id,
        almacen_codigo: r.almacen_codigo,
        almacen_nombre: r.almacen_nombre,
        cantidad_actual: Number(r.cantidad_actual),
        cantidad_reservada: Number(r.cantidad_reservada),
        stock_disponible: Number(r.stock_disponible),
        stock_minimo: Number(r.stock_minimo),
        stock_maximo: r.stock_maximo !== null ? Number(r.stock_maximo) : null,
        costo_promedio: Number(r.costo_promedio),
        valor_inventario: Number(r.valor_inventario),
        ubicacion_fisica: r.ubicacion_fisica,
        fecha_ultimo_movimiento: r.fecha_ultimo_movimiento,
        estado: r.estado,
        estado_stock: r.estado_stock
      };
    });

    const response = NextResponse.json({
      success: true,
      items,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: totalPages
      },
      lookups: {
        almacenes: almacenesRes,
        proveedores: proveedoresRes
      }
    });

    response.headers.set("x-perm-ver", String(perms.puede_ver));
    response.headers.set("x-perm-crear", String(perms.puede_crear));
    response.headers.set("x-perm-editar", String(perms.puede_editar));
    response.headers.set("x-perm-eliminar", String(perms.puede_eliminar));
    response.headers.set("x-perm-exportar", String(perms.puede_exportar));

    return response;
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Error en GET /api/inventario/existencias:", err?.message || error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Error interno al obtener existencias de inventario." },
      { status: 500 }
    );
  }
}
