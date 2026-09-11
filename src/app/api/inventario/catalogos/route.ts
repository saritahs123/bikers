import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

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
        { error: "FORBIDDEN", message: "No tienes permisos para consultar inventario." },
        { status: 403 }
      );
    }

    const empresaId = session.empresa_id;

    // 1. Almacenes activos de la empresa
    const almacenesRows = await query(
      `SELECT
         a.almacen_id,
         a.codigo,
         a.nombre,
         a.descripcion,
         a.direccion,
         a.telefono,
         a.estado
       FROM admin.almacenes a
       WHERE a.empresa_id = $1 AND UPPER(a.estado) = 'ACTIVO'
       ORDER BY a.codigo ASC, a.nombre ASC`,
      [empresaId]
    );

    // 2. Productos activos con unidad de medida
    const productosRows = await query(
      `SELECT
         p.producto_id,
         p.codigo_producto,
         p.codigo_barra,
         p.nombre,
         p.descripcion,
         p.costo_actual,
         p.precio_venta,
         p.stock_minimo,
         p.stock_maximo,
         p.imagen_url,
         p.tipo_producto_id,
         p.categoria_producto_id,
         p.marca_producto_id,
         p.unidad_medida_id,
         um.codigo AS unidad_codigo,
         um.nombre AS unidad_nombre,
         COALESCE(um.permite_decimales, false) AS permite_decimales,
         tp.nombre AS tipo_nombre,
         cp.nombre AS categoria_nombre,
         mp.nombre AS marca_nombre
       FROM admin.productos p
       LEFT JOIN admin.unidad_medida um ON p.unidad_medida_id = um.unidad_medida_id
       LEFT JOIN admin.tipo_producto tp ON p.tipo_producto_id = tp.tipo_producto_id
       LEFT JOIN admin.categoria_producto cp ON p.categoria_producto_id = cp.categoria_producto_id
       LEFT JOIN admin.marca_producto mp ON p.marca_producto_id = mp.marca_producto_id
       WHERE p.empresa_id = $1 AND UPPER(p.estado) = 'ACTIVO'
       ORDER BY p.nombre ASC`,
      [empresaId]
    );

    // 3. Existencias por producto y almacén (con stock disponible y reservado)
    const existenciasRows = await query(
      `SELECT
         ep.existencia_producto_id,
         ep.producto_id,
         ep.almacen_id,
         ep.cantidad_actual::numeric AS cantidad_actual,
         COALESCE(ep.cantidad_reservada, 0)::numeric AS cantidad_reservada,
         (ep.cantidad_actual - COALESCE(ep.cantidad_reservada, 0))::numeric AS cantidad_disponible,
         COALESCE(ep.costo_promedio, 0)::numeric AS costo_promedio
       FROM admin.existencias_producto ep
       JOIN admin.almacenes a ON ep.almacen_id = a.almacen_id
       WHERE ep.empresa_id = $1 AND UPPER(a.estado) = 'ACTIVO' AND UPPER(ep.estado) = 'ACTIVO'`,
      [empresaId]
    );

    // 4. Proveedores activos asociados desde admin.producto_proveedor
    const productoProveedoresRows = await query(
      `SELECT
         pp.producto_proveedor_id,
         pp.producto_id,
         pp.proveedor_id,
         pp.codigo_producto_proveedor,
         pp.costo_compra::numeric AS costo_compra,
         pp.moneda,
         pp.tiempo_entrega_dias,
         COALESCE(pp.proveedor_principal, false) AS proveedor_principal,
         pr.codigo_proveedor,
         pr.nombre_comercial,
         pr.telefono,
         pr.correo
       FROM admin.producto_proveedor pp
       JOIN admin.proveedores pr ON pp.proveedor_id = pr.proveedor_id
       JOIN admin.productos p ON pp.producto_id = p.producto_id
       WHERE p.empresa_id = $1
         AND pr.empresa_id = $1
         AND UPPER(pp.estado) = 'ACTIVO'
         AND UPPER(pr.estado) = 'ACTIVO'
       ORDER BY pp.proveedor_principal DESC, pr.nombre_comercial ASC`,
      [empresaId]
    );

    // Agrupar existencias por producto_id
    const existenciasPorProducto: Record<number, any[]> = {};
    for (const ex of existenciasRows || []) {
      const pid = ex.producto_id;
      if (!existenciasPorProducto[pid]) existenciasPorProducto[pid] = [];
      existenciasPorProducto[pid].push({
        existencia_producto_id: ex.existencia_producto_id,
        almacen_id: ex.almacen_id,
        cantidad_actual: Number(ex.cantidad_actual || 0),
        cantidad_reservada: Number(ex.cantidad_reservada || 0),
        cantidad_disponible: Number(ex.cantidad_disponible || 0),
        costo_promedio: Number(ex.costo_promedio || 0),
      });
    }

    // Agrupar proveedores asociados por producto_id
    const proveedoresPorProducto: Record<number, any[]> = {};
    for (const pp of productoProveedoresRows || []) {
      const pid = pp.producto_id;
      if (!proveedoresPorProducto[pid]) proveedoresPorProducto[pid] = [];
      proveedoresPorProducto[pid].push({
        producto_proveedor_id: pp.producto_proveedor_id,
        proveedor_id: pp.proveedor_id,
        codigo_proveedor: pp.codigo_proveedor,
        nombre_comercial: pp.nombre_comercial,
        codigo_producto_proveedor: pp.codigo_producto_proveedor,
        costo_compra: Number(pp.costo_compra || 0),
        moneda: pp.moneda || "DOP",
        tiempo_entrega_dias: pp.tiempo_entrega_dias,
        proveedor_principal: Boolean(pp.proveedor_principal),
        telefono: pp.telefono,
        correo: pp.correo,
      });
    }

    // Integrar a los productos
    const productos = (productosRows || []).map((p: any) => {
      const pid = p.producto_id;
      return {
        producto_id: pid,
        codigo_producto: p.codigo_producto,
        codigo_barra: p.codigo_barra,
        nombre: p.nombre,
        descripcion: p.descripcion,
        costo_actual: Number(p.costo_actual || 0),
        precio_venta: Number(p.precio_venta || 0),
        stock_minimo: Number(p.stock_minimo || 0),
        stock_maximo: p.stock_maximo ? Number(p.stock_maximo) : null,
        imagen_url: p.imagen_url,
        unidad_medida: {
          id: p.unidad_medida_id,
          codigo: p.unidad_codigo || "UND",
          nombre: p.unidad_nombre || "Unidad",
          permite_decimales: Boolean(p.permite_decimales),
        },
        tipo_nombre: p.tipo_nombre,
        categoria_nombre: p.categoria_nombre,
        marca_nombre: p.marca_nombre,
        existencias: existenciasPorProducto[pid] || [],
        proveedores: proveedoresPorProducto[pid] || [],
      };
    });

    // 5. Todos los proveedores activos de la empresa
    const proveedoresRows = await query(
      `SELECT
         pr.proveedor_id,
         pr.codigo_proveedor,
         pr.nombre_comercial,
         pr.rnc,
         pr.telefono,
         pr.correo
       FROM admin.proveedores pr
       WHERE pr.empresa_id = $1 AND (UPPER(pr.estado) = 'ACTIVO' OR pr.estado IS NULL)
       ORDER BY pr.nombre_comercial ASC`,
      [empresaId]
    );

    return NextResponse.json({
      almacenes: almacenesRows || [],
      productos,
      proveedores: proveedoresRows || [],
    });
  } catch (error: any) {
    console.error("Error en GET /api/inventario/catalogos:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Error al cargar catálogos de inventario." },
      { status: 500 }
    );
  }
}
