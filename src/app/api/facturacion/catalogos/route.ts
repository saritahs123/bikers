import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

export const dynamic = "force-dynamic";

export async function GET() {
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
        { error: "FORBIDDEN", message: "No tienes permisos para acceder a Facturación." },
        { status: 403 }
      );
    }

    const empresaId = session.empresa_id;

    // 1. Tipos de Factura
    const tiposFacturaRows = await query(
      `SELECT tipo_factura_id, codigo, nombre, descripcion, activo
       FROM admin.tipo_factura
       WHERE activo = true
       ORDER BY tipo_factura_id ASC`
    );

    // 2. Tipos de Pago
    const tiposPagoRows = await query(
      `SELECT tipo_pago_id, codigo, nombre, descripcion, activo
       FROM admin.tipo_pago
       WHERE activo = true
       ORDER BY tipo_pago_id ASC`
    );

    // 3. Almacenes Activos
    const almacenesRows = await query(
      `SELECT almacen_id, codigo, nombre, descripcion, estado
       FROM admin.almacenes
       WHERE empresa_id = $1 AND UPPER(estado) = 'ACTIVO'
       ORDER BY codigo ASC, nombre ASC`,
      [empresaId]
    );

    // 4. Productos activos con stock disponible por almacén
    const productosRows = await query(
      `SELECT
         p.producto_id,
         p.codigo_producto,
         p.codigo_barra,
         p.nombre,
         p.descripcion,
         p.costo_actual::numeric AS costo_actual,
         p.precio_venta::numeric AS precio_venta,
         p.imagen_url,
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

    // 5. Existencias agrupadas por producto y almacén
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

    interface ExistenciaRow {
      existencia_producto_id: number;
      producto_id: number;
      almacen_id: number;
      cantidad_actual: number | string;
      cantidad_reservada: number | string;
      cantidad_disponible: number | string;
      costo_promedio: number | string;
    }

    interface ExistenciaItem {
      existencia_producto_id: number;
      almacen_id: number;
      cantidad_actual: number;
      cantidad_reservada: number;
      cantidad_disponible: number;
      costo_promedio: number;
    }

    interface ProductoCatalogRow {
      producto_id: number;
      codigo_producto: string;
      codigo_barra: string | null;
      nombre: string;
      descripcion: string | null;
      costo_actual: number | string;
      precio_venta: number | string;
      imagen_url: string | null;
      unidad_medida_id: number | null;
      unidad_codigo: string | null;
      unidad_nombre: string | null;
      permite_decimales: boolean;
      tipo_nombre: string | null;
      categoria_nombre: string | null;
      marca_nombre: string | null;
    }

    const existenciasPorProducto: Record<number, ExistenciaItem[]> = {};
    for (const ex of ((existenciasRows || []) as unknown as ExistenciaRow[])) {
      const pid = ex.producto_id;
      if (!existenciasPorProducto[pid]) existenciasPorProducto[pid] = [];
      existenciasPorProducto[pid].push({
        existencia_producto_id: ex.existencia_producto_id,
        almacen_id: ex.almacen_id,
        cantidad_actual: Number(ex.cantidad_actual || 0),
        cantidad_reservada: Number(ex.cantidad_reservada || 0),
        cantidad_disponible: Math.max(0, Number(ex.cantidad_disponible || 0)),
        costo_promedio: Number(ex.costo_promedio || 0),
      });
    }

    const productosConStock = ((productosRows || []) as unknown as ProductoCatalogRow[]).map((p: ProductoCatalogRow) => ({
      ...p,
      costo_actual: Number(p.costo_actual || 0),
      precio_venta: Number(p.precio_venta || 0),
      permite_decimales: Boolean(p.permite_decimales),
      existencias: existenciasPorProducto[p.producto_id] || [],
    }));

    // 6. Clientes activos (CRM)
    const clientesRows = await query(
      `SELECT
         c.cliente_id,
         c.nombre,
         c.apellido,
         c.nombre_completo,
         c.identificacion,
         c.telefono_principal,
         c.correo
       FROM admin.clientes c
       WHERE c.empresa_id = $1 AND c.fecha_eliminacion IS NULL AND (c.activo = true OR c.activo IS NULL)
       ORDER BY c.nombre_completo ASC
       LIMIT 300`,
      [empresaId]
    );

    return NextResponse.json({
      success: true,
      tipos_factura: tiposFacturaRows || [],
      tipos_pago: tiposPagoRows || [],
      almacenes: almacenesRows || [],
      productos: productosConStock,
      clientes: clientesRows || [],
      permisos: perms
    });

  } catch (error) {
    console.error("Error en GET /api/facturacion/catalogos:", error);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Error interno al cargar catálogos de facturación." },
      { status: 500 }
    );
  }
}
