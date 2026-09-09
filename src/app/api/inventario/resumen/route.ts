import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

// GET /api/inventario/resumen
export async function GET() {
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
        { error: "FORBIDDEN", message: "No tienes permisos para consultar el resumen de inventario." },
        { status: 403 }
      );
    }

    const empresaId = session.empresa_id;

    // 1. Total Productos Activos
    const prodCountRes = await query(
      `SELECT COUNT(*)::int AS count
       FROM admin.productos
       WHERE empresa_id = $1 AND (estado = 'ACTIVO' OR estado IS NULL)`,
      [empresaId]
    );
    const totalProductosActivos = prodCountRes[0]?.count || 0;

    // 2. Total Almacenes Activos
    const almCountRes = await query(
      `SELECT COUNT(*)::int AS count
       FROM admin.almacenes
       WHERE empresa_id = $1 AND (estado = 'ACTIVO' OR estado IS NULL)`,
      [empresaId]
    );
    const totalAlmacenesActivos = almCountRes[0]?.count || 0;

    // 3. Total Unidades en Existencia & 4. Valor Total del Inventario
    const existenciasRes = await query(
      `SELECT 
         COALESCE(SUM(ep.cantidad_actual), 0)::numeric AS total_unidades,
         COALESCE(SUM(ep.cantidad_actual * ep.costo_promedio), 0)::numeric AS valor_total_inventario
       FROM admin.existencias_producto ep
       JOIN admin.almacenes a ON ep.almacen_id = a.almacen_id AND a.empresa_id = ep.empresa_id
       JOIN admin.productos p ON ep.producto_id = p.producto_id AND p.empresa_id = ep.empresa_id
       WHERE ep.empresa_id = $1 AND (ep.estado = 'ACTIVO' OR ep.estado IS NULL)`,
      [empresaId]
    );
    const totalUnidades = Number(existenciasRes[0]?.total_unidades || 0);
    const valorTotalInventario = Number(existenciasRes[0]?.valor_total_inventario || 0);

    // 5. Productos Bajo Stock Mínimo (cantidad_actual <= stock_minimo AND cantidad_actual > 0)
    const bajoStockCountRes = await query(
      `SELECT COUNT(*)::int AS count
       FROM admin.existencias_producto ep
       JOIN admin.productos p ON ep.producto_id = p.producto_id AND p.empresa_id = ep.empresa_id
       JOIN admin.almacenes a ON ep.almacen_id = a.almacen_id AND a.empresa_id = ep.empresa_id
       WHERE ep.empresa_id = $1 
         AND (p.estado = 'ACTIVO' OR p.estado IS NULL)
         AND ep.cantidad_actual > 0
         AND ep.cantidad_actual <= COALESCE(NULLIF(ep.stock_minimo, 0), p.stock_minimo, 0)`,
      [empresaId]
    );
    const bajoStockCount = bajoStockCountRes[0]?.count || 0;

    // 6. Productos Sin Existencia (cantidad_actual = 0)
    const sinStockCountRes = await query(
      `SELECT COUNT(*)::int AS count
       FROM admin.existencias_producto ep
       JOIN admin.productos p ON ep.producto_id = p.producto_id AND p.empresa_id = ep.empresa_id
       JOIN admin.almacenes a ON ep.almacen_id = a.almacen_id AND a.empresa_id = ep.empresa_id
       WHERE ep.empresa_id = $1 
         AND (p.estado = 'ACTIVO' OR p.estado IS NULL)
         AND ep.cantidad_actual = 0`,
      [empresaId]
    );
    const sinStockCount = sinStockCountRes[0]?.count || 0;

    // 7. Movimientos Registrados Hoy
    const movsHoyRes = await query(
      `SELECT COUNT(*)::int AS count
       FROM admin.movimientos_inventario
       WHERE empresa_id = $1 
         AND (fecha_movimiento AT TIME ZONE 'America/Santo_Domingo')::date = (NOW() AT TIME ZONE 'America/Santo_Domingo')::date`,
      [empresaId]
    );
    const movimientosHoyCount = movsHoyRes[0]?.count || 0;

    // 8. Valor del Inventario por Almacén
    const valorPorAlmacenRes = await query(
      `SELECT 
         a.almacen_id,
         a.codigo AS almacen_codigo,
         a.nombre AS almacen_nombre,
         COALESCE(SUM(ep.cantidad_actual * ep.costo_promedio), 0)::numeric AS valor_inventario,
         COALESCE(SUM(ep.cantidad_actual), 0)::numeric AS total_unidades
       FROM admin.almacenes a
       LEFT JOIN admin.existencias_producto ep ON a.almacen_id = ep.almacen_id AND ep.empresa_id = a.empresa_id AND (ep.estado = 'ACTIVO' OR ep.estado IS NULL)
       WHERE a.empresa_id = $1 AND (a.estado = 'ACTIVO' OR a.estado IS NULL)
       GROUP BY a.almacen_id, a.codigo, a.nombre
       ORDER BY valor_inventario DESC, a.nombre ASC`,
      [empresaId]
    );

    // 9. Distribución por Categoría
    const distribucionCatRes = await query(
      `SELECT 
         COALESCE(cp.nombre, 'Otros') AS categoria_nombre,
         COUNT(p.producto_id)::int AS total_productos
       FROM admin.productos p
       LEFT JOIN admin.categoria_producto cp ON p.categoria_producto_id = cp.categoria_producto_id
       WHERE p.empresa_id = $1 AND (p.estado = 'ACTIVO' OR p.estado IS NULL)
       GROUP BY cp.categoria_producto_id, cp.nombre
       ORDER BY total_productos DESC`,
      [empresaId]
    );

    // Calculate percentage per category
    const catTotalSum = distribucionCatRes.reduce((acc: number, c: any) => acc + Number(c.total_productos || 0), 0) || 1;
    const distribucionCategoria = distribucionCatRes.map((c: any) => ({
      categoria_nombre: c.categoria_nombre,
      total_productos: Number(c.total_productos),
      porcentaje: Math.round((Number(c.total_productos) / catTotalSum) * 100)
    }));

    // 10. Alertas de Inventario (Top 5)
    const alertasRes = await query(
      `SELECT 
         ep.existencia_producto_id,
         p.producto_id,
         p.codigo_producto,
         p.nombre AS producto_nombre,
         a.almacen_id,
         a.nombre AS almacen_nombre,
         ep.cantidad_actual::numeric AS cantidad_actual,
         COALESCE(NULLIF(ep.stock_minimo, 0), p.stock_minimo, 0)::numeric AS stock_minimo,
         ep.costo_promedio::numeric AS costo_promedio,
         CASE 
           WHEN ep.cantidad_actual = 0 THEN 'SIN_STOCK'
           WHEN ep.cantidad_actual <= COALESCE(NULLIF(ep.stock_minimo, 0), p.stock_minimo, 0) THEN 'BAJO_MINIMO'
           ELSE 'NORMAL'
         END AS estado_stock
       FROM admin.existencias_producto ep
       JOIN admin.productos p ON ep.producto_id = p.producto_id AND p.empresa_id = ep.empresa_id
       JOIN admin.almacenes a ON ep.almacen_id = a.almacen_id AND a.empresa_id = ep.empresa_id
       WHERE ep.empresa_id = $1 
         AND (p.estado = 'ACTIVO' OR p.estado IS NULL)
         AND (ep.cantidad_actual = 0 OR ep.cantidad_actual <= COALESCE(NULLIF(ep.stock_minimo, 0), p.stock_minimo, 0))
       ORDER BY 
         CASE WHEN ep.cantidad_actual = 0 THEN 0 ELSE 1 END,
         ep.cantidad_actual ASC,
         p.nombre ASC
       LIMIT 5`,
      [empresaId]
    );

    // 11. Movimientos Recientes (Top 5)
    const movimientosRecientesRes = await query(
      `SELECT 
         mi.movimiento_inventario_id,
         mi.fecha_movimiento,
         mi.cantidad::numeric AS cantidad,
         mi.costo_unitario::numeric AS costo_unitario,
         mi.costo_total::numeric AS costo_total,
         mi.stock_anterior::numeric AS stock_anterior,
         mi.stock_nuevo::numeric AS stock_nuevo,
         mi.referencia,
         mi.observacion,
         mi.transferencia_uuid,
         tmi.codigo AS tipo_codigo,
         tmi.nombre AS tipo_nombre,
         tmi.naturaleza,
         p.producto_id,
         p.codigo_producto,
         p.nombre AS producto_nombre,
         a.almacen_id,
         a.nombre AS almacen_nombre,
         COALESCE(CONCAT(ui.nombre, ' ', ui.apellido), 'Sistema') AS usuario_nombre
       FROM admin.movimientos_inventario mi
       JOIN admin.productos p ON mi.producto_id = p.producto_id AND p.empresa_id = mi.empresa_id
       JOIN admin.almacenes a ON mi.almacen_id = a.almacen_id AND a.empresa_id = mi.empresa_id
       JOIN admin.tipo_movimiento_inventario tmi ON mi.tipo_movimiento_id = tmi.tipo_movimiento_id
       LEFT JOIN admin.usuario u ON mi.usuario_movimiento = u.usuario_id
       LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
       WHERE mi.empresa_id = $1
       ORDER BY mi.fecha_movimiento DESC, mi.movimiento_inventario_id DESC
       LIMIT 5`,
      [empresaId]
    );

    // 12. Último Movimiento
    const ultimoMovimiento = movimientosRecientesRes[0] || null;

    const response = NextResponse.json({
      success: true,
      data: {
        metrics: {
          productos_activos: totalProductosActivos,
          almacenes_activos: totalAlmacenesActivos,
          unidades_stock: totalUnidades,
          valor_inventario: valorTotalInventario,
          bajo_minimo: bajoStockCount,
          sin_stock: sinStockCount,
          movimientos_hoy: movimientosHoyCount
        },
        valor_por_almacen: valorPorAlmacenRes.map((a: any) => ({
          almacen_id: a.almacen_id,
          almacen_codigo: a.almacen_codigo,
          almacen_nombre: a.almacen_nombre,
          valor_inventario: Number(a.valor_inventario || 0),
          total_unidades: Number(a.total_unidades || 0)
        })),
        distribucion_categoria: distribucionCategoria,
        alertas: alertasRes.map((r: any) => ({
          existencia_producto_id: r.existencia_producto_id,
          producto_id: r.producto_id,
          codigo_producto: r.codigo_producto,
          producto_nombre: r.producto_nombre,
          almacen_id: r.almacen_id,
          almacen_nombre: r.almacen_nombre,
          cantidad_actual: Number(r.cantidad_actual),
          stock_minimo: Number(r.stock_minimo),
          costo_promedio: Number(r.costo_promedio || 0),
          estado_stock: r.estado_stock
        })),
        movimientos_recientes: movimientosRecientesRes.map((r: any) => ({
          movimiento_inventario_id: r.movimiento_inventario_id,
          fecha_movimiento: r.fecha_movimiento,
          cantidad: Number(r.cantidad),
          costo_unitario: Number(r.costo_unitario || 0),
          costo_total: Number(r.costo_total || 0),
          stock_anterior: Number(r.stock_anterior || 0),
          stock_nuevo: Number(r.stock_nuevo || 0),
          referencia: r.referencia || "—",
          observacion: r.observacion,
          transferencia_uuid: r.transferencia_uuid,
          tipo_codigo: r.tipo_codigo,
          tipo_nombre: r.tipo_nombre,
          naturaleza: r.naturaleza,
          producto_id: r.producto_id,
          codigo_producto: r.codigo_producto,
          producto_nombre: r.producto_nombre,
          almacen_id: r.almacen_id,
          almacen_nombre: r.almacen_nombre,
          usuario_nombre: r.usuario_nombre
        })),
        ultimo_movimiento: ultimoMovimiento
          ? {
              movimiento_inventario_id: ultimoMovimiento.movimiento_inventario_id,
              fecha_movimiento: ultimoMovimiento.fecha_movimiento,
              cantidad: Number(ultimoMovimiento.cantidad),
              costo_unitario: Number(ultimoMovimiento.costo_unitario || 0),
              costo_total: Number(ultimoMovimiento.costo_total || 0),
              stock_anterior: Number(ultimoMovimiento.stock_anterior || 0),
              stock_nuevo: Number(ultimoMovimiento.stock_nuevo || 0),
              referencia: ultimoMovimiento.referencia || "—",
              observacion: ultimoMovimiento.observacion,
              transferencia_uuid: ultimoMovimiento.transferencia_uuid,
              tipo_codigo: ultimoMovimiento.tipo_codigo,
              tipo_nombre: ultimoMovimiento.tipo_nombre,
              naturaleza: ultimoMovimiento.naturaleza,
              producto_id: ultimoMovimiento.producto_id,
              codigo_producto: ultimoMovimiento.codigo_producto,
              producto_nombre: ultimoMovimiento.producto_nombre,
              almacen_id: ultimoMovimiento.almacen_id,
              almacen_nombre: ultimoMovimiento.almacen_nombre,
              usuario_nombre: ultimoMovimiento.usuario_nombre
            }
          : null
      }
    });

    response.headers.set("x-perm-ver", String(perms.puede_ver));
    response.headers.set("x-perm-crear", String(perms.puede_crear));
    response.headers.set("x-perm-editar", String(perms.puede_editar));
    response.headers.set("x-perm-eliminar", String(perms.puede_eliminar));
    response.headers.set("x-perm-exportar", String(perms.puede_exportar));

    return response;
  } catch (error: any) {
    console.error("Error en GET /api/inventario/resumen:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Error interno al obtener el resumen de inventario." },
      { status: 500 }
    );
  }
}
