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
      categoria: "cp.nombre"
    };

    const sortColumn = sortMapping[sortByParam] || "p.nombre";

    // Build WHERE clause
    const conditions: string[] = ["ep.empresa_id = $1", "p.empresa_id = $1", "a.empresa_id = $1"];
    const params: any[] = [empresaId];
    let paramIndex = 2;

    if (search) {
      conditions.push(
        `(p.codigo_producto ILIKE $${paramIndex} OR p.nombre ILIKE $${paramIndex} OR mp.nombre ILIKE $${paramIndex} OR cp.nombre ILIKE $${paramIndex} OR a.nombre ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (almacenId && !isNaN(almacenId)) {
      conditions.push(`ep.almacen_id = $${paramIndex}`);
      params.push(almacenId);
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
        END AS estado_stock
      FROM admin.existencias_producto ep
      JOIN admin.productos p ON ep.producto_id = p.producto_id AND p.empresa_id = ep.empresa_id
      JOIN admin.almacenes a ON ep.almacen_id = a.almacen_id AND a.empresa_id = ep.empresa_id
      LEFT JOIN admin.unidad_medida um ON p.unidad_medida_id = um.unidad_medida_id
      LEFT JOIN admin.marca_producto mp ON p.marca_producto_id = mp.marca_producto_id
      LEFT JOIN admin.categoria_producto cp ON p.categoria_producto_id = cp.categoria_producto_id
      WHERE ${whereSql}
      ORDER BY ${sortColumn} ${sortDirParam}, p.nombre ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataParams = [...params, pageSize, offset];
    const rows = await query(dataSql, dataParams);

    // 3. Lookups Query (Almacenes for filter)
    const almacenesRes = await query(
      `SELECT almacen_id, codigo, nombre
       FROM admin.almacenes
       WHERE empresa_id = $1 AND (estado = 'ACTIVO' OR estado IS NULL)
       ORDER BY nombre ASC`,
      [empresaId]
    );

    const items = rows.map((r: any) => ({
      existencia_producto_id: r.existencia_producto_id,
      producto_id: r.producto_id,
      codigo_producto: r.codigo_producto,
      producto_nombre: r.producto_nombre,
      marca: r.marca_nombre || "—",
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
    }));

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
        almacenes: almacenesRes
      }
    });

    response.headers.set("x-perm-ver", String(perms.puede_ver));
    response.headers.set("x-perm-crear", String(perms.puede_crear));
    response.headers.set("x-perm-editar", String(perms.puede_editar));
    response.headers.set("x-perm-eliminar", String(perms.puede_eliminar));
    response.headers.set("x-perm-exportar", String(perms.puede_exportar));

    return response;
  } catch (error: any) {
    console.error("Error en GET /api/inventario/existencias:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Error interno al obtener existencias de inventario." },
      { status: 500 }
    );
  }
}
