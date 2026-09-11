import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

// GET /api/inventario/movimientos
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
        { error: "FORBIDDEN", message: "No tienes permisos para consultar movimientos de inventario." },
        { status: 403 }
      );
    }

    const empresaId = session.empresa_id;
    const { searchParams } = new URL(req.url);

    const search = (searchParams.get("search") || "").trim();
    const codigoMovimiento = (searchParams.get("codigo_movimiento") || "").trim();
    const almacenId = searchParams.get("almacen_id") ? parseInt(searchParams.get("almacen_id")!, 10) : null;
    const productoId = searchParams.get("producto_id") ? parseInt(searchParams.get("producto_id")!, 10) : null;
    const tipoMovimientoId = searchParams.get("tipo_movimiento_id") ? parseInt(searchParams.get("tipo_movimiento_id")!, 10) : null;
    const fechaDesde = searchParams.get("fecha_desde") || "";
    const fechaHasta = searchParams.get("fecha_hasta") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("page_size") || "25", 10)));
    const offset = (page - 1) * pageSize;

    const sortByParam = searchParams.get("sort_by") || "fecha_movimiento";
    const sortDirParam = (searchParams.get("sort_direction") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

    // Whitelist for sort columns
    const sortMapping: Record<string, string> = {
      fecha_movimiento: "mi.fecha_movimiento",
      codigo_movimiento: "mi.codigo_movimiento",
      cantidad: "mi.cantidad",
      costo_unitario: "mi.costo_unitario",
      costo_total: "mi.costo_total",
      producto_nombre: "p.nombre",
      codigo_producto: "p.codigo_producto",
      almacen_nombre: "a.nombre",
      tipo_nombre: "tmi.nombre",
      movimiento_inventario_id: "mi.movimiento_inventario_id"
    };

    const sortColumn = sortMapping[sortByParam] || "mi.fecha_movimiento";

    // Build WHERE clause
    const conditions: string[] = ["mi.empresa_id = $1", "p.empresa_id = $1", "a.empresa_id = $1"];
    const params: unknown[] = [empresaId];
    let paramIndex = 2;

    if (search) {
      conditions.push(
        `(p.codigo_producto ILIKE $${paramIndex} OR p.nombre ILIKE $${paramIndex} OR a.nombre ILIKE $${paramIndex} OR mi.referencia ILIKE $${paramIndex} OR mi.observacion ILIKE $${paramIndex} OR mi.codigo_movimiento ILIKE $${paramIndex} OR CONCAT(ui.nombre, ' ', ui.apellido) ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (codigoMovimiento) {
      conditions.push(`mi.codigo_movimiento ILIKE $${paramIndex}`);
      params.push(`%${codigoMovimiento}%`);
      paramIndex++;
    }
    if (almacenId && !isNaN(almacenId)) {
      conditions.push(`mi.almacen_id = $${paramIndex}`);
      params.push(almacenId);
      paramIndex++;
    }

    if (productoId && !isNaN(productoId)) {
      conditions.push(`mi.producto_id = $${paramIndex}`);
      params.push(productoId);
      paramIndex++;
    }

    if (tipoMovimientoId && !isNaN(tipoMovimientoId)) {
      conditions.push(`mi.tipo_movimiento_id = $${paramIndex}`);
      params.push(tipoMovimientoId);
      paramIndex++;
    }

    if (fechaDesde) {
      conditions.push(`(mi.fecha_movimiento AT TIME ZONE 'America/Santo_Domingo')::date >= $${paramIndex}::date`);
      params.push(fechaDesde);
      paramIndex++;
    }

    if (fechaHasta) {
      conditions.push(`(mi.fecha_movimiento AT TIME ZONE 'America/Santo_Domingo')::date <= $${paramIndex}::date`);
      params.push(fechaHasta);
      paramIndex++;
    }

    const whereSql = conditions.join(" AND ");

    // 1. Total Count Query
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM admin.movimientos_inventario mi
      JOIN admin.productos p ON mi.producto_id = p.producto_id AND p.empresa_id = mi.empresa_id
      JOIN admin.almacenes a ON mi.almacen_id = a.almacen_id AND a.empresa_id = mi.empresa_id
      JOIN admin.tipo_movimiento_inventario tmi ON mi.tipo_movimiento_id = tmi.tipo_movimiento_id
      LEFT JOIN admin.usuario u ON mi.usuario_movimiento = u.usuario_id
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      WHERE ${whereSql}
    `;
    const countRes = await query(countSql, params);
    const total = countRes[0]?.total || 0;
    const totalPages = Math.ceil(total / pageSize);

    // 2. Data Query
    const dataSql = `
      SELECT 
        mi.movimiento_inventario_id,
        mi.fecha_movimiento,
        mi.tipo_movimiento_id,
        tmi.codigo AS tipo_codigo,
        tmi.nombre AS tipo_nombre,
        tmi.naturaleza,
        mi.producto_id,
        p.codigo_producto,
        p.nombre AS producto_nombre,
        mi.almacen_id,
        a.codigo AS almacen_codigo,
        a.nombre AS almacen_nombre,
        mi.cantidad::numeric AS cantidad,
        COALESCE(mi.costo_unitario, 0)::numeric AS costo_unitario,
        COALESCE(mi.costo_total, 0)::numeric AS costo_total,
        COALESCE(mi.stock_anterior, 0)::numeric AS stock_anterior,
        COALESCE(mi.stock_nuevo, 0)::numeric AS stock_nuevo,
        mi.orden_trabajo_id,
        mi.orden_servicio_id,
        mi.referencia,
        mi.observacion,
        mi.usuario_movimiento,
        COALESCE(CONCAT(ui.nombre, ' ', ui.apellido), 'Sistema') AS usuario_nombre,
        mi.transferencia_uuid,
        mi.codigo_movimiento,
        mi.proveedor_id,
        prov.nombre_comercial AS proveedor_nombre
      FROM admin.movimientos_inventario mi
      JOIN admin.productos p ON mi.producto_id = p.producto_id AND p.empresa_id = mi.empresa_id
      JOIN admin.almacenes a ON mi.almacen_id = a.almacen_id AND a.empresa_id = mi.empresa_id
      JOIN admin.tipo_movimiento_inventario tmi ON mi.tipo_movimiento_id = tmi.tipo_movimiento_id
      LEFT JOIN admin.proveedores prov ON mi.proveedor_id = prov.proveedor_id
      LEFT JOIN admin.usuario u ON mi.usuario_movimiento = u.usuario_id
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      WHERE ${whereSql}
      ORDER BY ${sortColumn} ${sortDirParam}, mi.movimiento_inventario_id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataParams = [...params, pageSize, offset];
    const rows = await query(dataSql, dataParams);

    // 3. Lookups Query
    const [almacenesRes, tiposMovRes] = await Promise.all([
      query(
        `SELECT almacen_id, codigo, nombre
         FROM admin.almacenes
         WHERE empresa_id = $1 AND (estado = 'ACTIVO' OR estado IS NULL)
         ORDER BY nombre ASC`,
        [empresaId]
      ),
      query(
        `SELECT tipo_movimiento_id, codigo, nombre, naturaleza
         FROM admin.tipo_movimiento_inventario
         WHERE (estado = 'ACTIVO' OR estado IS NULL)
         ORDER BY naturaleza ASC, nombre ASC`
      )
    ]);

    const items = (rows as Record<string, unknown>[]).map((r) => ({
      movimiento_inventario_id: r.movimiento_inventario_id,
      codigo_movimiento: r.codigo_movimiento || null,
      fecha_movimiento: r.fecha_movimiento,
      tipo_movimiento_id: r.tipo_movimiento_id,
      tipo_codigo: r.tipo_codigo,
      tipo_nombre: r.tipo_nombre,
      naturaleza: r.naturaleza,
      producto_id: r.producto_id,
      codigo_producto: r.codigo_producto,
      producto_nombre: r.producto_nombre,
      almacen_id: r.almacen_id,
      almacen_codigo: r.almacen_codigo,
      almacen_nombre: r.almacen_nombre,
      cantidad: Number(r.cantidad),
      costo_unitario: Number(r.costo_unitario),
      costo_total: Number(r.costo_total),
      stock_anterior: Number(r.stock_anterior),
      stock_nuevo: Number(r.stock_nuevo),
      orden_trabajo_id: r.orden_trabajo_id,
      orden_servicio_id: r.orden_servicio_id,
      referencia: r.referencia,
      observacion: r.observacion,
      usuario_movimiento: r.usuario_movimiento,
      usuario_nombre: r.usuario_nombre,
      transferencia_uuid: r.transferencia_uuid,
      proveedor_id: r.proveedor_id || null,
      proveedor_nombre: r.proveedor_nombre || null
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
        almacenes: almacenesRes,
        tipos_movimiento: tiposMovRes
      }
    });

    response.headers.set("x-perm-ver", String(perms.puede_ver));
    response.headers.set("x-perm-crear", String(perms.puede_crear));
    response.headers.set("x-perm-editar", String(perms.puede_editar));
    response.headers.set("x-perm-eliminar", String(perms.puede_eliminar));
    response.headers.set("x-perm-exportar", String(perms.puede_exportar));

    return response;
  } catch (error: unknown) {
    console.error("Error en GET /api/inventario/movimientos:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Error interno al obtener movimientos de inventario." },
      { status: 500 }
    );
  }
}
