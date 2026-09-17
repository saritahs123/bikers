import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

export const dynamic = "force-dynamic";

interface TipoFacturaDbRow {
  tipo_factura_id: number;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  activo?: boolean | null;
  estado?: string | null;
}

interface TipoPagoDbRow {
  tipo_pago_id: number;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  activo?: boolean | null;
  estado?: string | null;
}

export async function GET() {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    let perms = await getModulePermissions("FACTURACION", session.usuario_id);
    if (!perms.puede_ver) {
      perms = await getModulePermissions("FACTURACIÓN", session.usuario_id);
    }

    if (!perms.puede_ver) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permisos para acceder a Facturación." },
        { status: 403 }
      );
    }

    const empresaId = session.empresa_id;

    // 1. Tipos de Factura (Seguro sin asumir columna activo)
    interface TipoFacturaItem {
      tipo_factura_id: number;
      codigo: string;
      nombre: string;
      descripcion: string | null;
      activo: boolean;
    }

    const defaultTiposFactura: TipoFacturaItem[] = [
      { tipo_factura_id: 1, codigo: "VENTA_DIRECTA", nombre: "Venta Directa", descripcion: "Factura por venta directa en mostrador o tienda", activo: true },
      { tipo_factura_id: 2, codigo: "ORDEN_TRABAJO", nombre: "Orden de Trabajo", descripcion: "Factura generada desde una orden de trabajo de taller", activo: true }
    ];

    let finalTiposFactura: TipoFacturaItem[] = defaultTiposFactura;
    try {
      const tiposFacturaRows = await query<TipoFacturaDbRow>(
        `SELECT * FROM admin.tipo_factura ORDER BY tipo_factura_id ASC`
      );

      if (tiposFacturaRows && tiposFacturaRows.length > 0) {
        const filtered = tiposFacturaRows.filter((tf) => {
          if (tf.activo !== undefined && tf.activo !== null) return Boolean(tf.activo);
          if (tf.estado !== undefined && tf.estado !== null) return String(tf.estado).toUpperCase() === "ACTIVO";
          return true;
        });

        finalTiposFactura = (filtered.length > 0 ? filtered : tiposFacturaRows).map((tf) => ({
          tipo_factura_id: Number(tf.tipo_factura_id),
          codigo: String(tf.codigo || ""),
          nombre: String(tf.nombre || ""),
          descripcion: tf.descripcion || null,
          activo: tf.activo !== undefined && tf.activo !== null ? Boolean(tf.activo) : (tf.estado ? String(tf.estado).toUpperCase() === "ACTIVO" : true)
        }));
      }
    } catch (tfErr) {
      console.warn("Fallo al consultar admin.tipo_factura, usando fallback:", tfErr);
    }

    // 2. Tipos de Pago (Seguro sin asumir columna activo)
    interface TipoPagoItem {
      tipo_pago_id: number;
      codigo: string;
      nombre: string;
      descripcion: string | null;
      activo: boolean;
    }

    const defaultTiposPago: TipoPagoItem[] = [
      { tipo_pago_id: 1, codigo: "EFECTIVO", nombre: "Efectivo", descripcion: "Pago en efectivo", activo: true },
      { tipo_pago_id: 2, codigo: "TARJETA", nombre: "Tarjeta", descripcion: "Pago con tarjeta de débito o crédito", activo: true },
      { tipo_pago_id: 3, codigo: "TRANSFERENCIA", nombre: "Transferencia", descripcion: "Pago mediante transferencia bancaria", activo: true }
    ];

    let finalTiposPago: TipoPagoItem[] = defaultTiposPago;
    try {
      const tiposPagoRows = await query<TipoPagoDbRow>(
        `SELECT * FROM admin.tipo_pago ORDER BY tipo_pago_id ASC`
      );

      if (tiposPagoRows && tiposPagoRows.length > 0) {
        const filtered = tiposPagoRows.filter((tp) => {
          if (tp.activo !== undefined && tp.activo !== null) return Boolean(tp.activo);
          if (tp.estado !== undefined && tp.estado !== null) return String(tp.estado).toUpperCase() === "ACTIVO";
          return true;
        });

        finalTiposPago = (filtered.length > 0 ? filtered : tiposPagoRows).map((tp) => ({
          tipo_pago_id: Number(tp.tipo_pago_id),
          codigo: String(tp.codigo || ""),
          nombre: String(tp.nombre || ""),
          descripcion: tp.descripcion || null,
          activo: tp.activo !== undefined && tp.activo !== null ? Boolean(tp.activo) : (tp.estado ? String(tp.estado).toUpperCase() === "ACTIVO" : true)
        }));
      }
    } catch (tpErr) {
      console.warn("Fallo al consultar admin.tipo_pago, usando fallback:", tpErr);
    }

    // 3. Almacenes Activos
    const almacenesRows = await query(
      `SELECT almacen_id, codigo, nombre, descripcion, estado
       FROM admin.almacenes
       WHERE (empresa_id = $1 OR empresa_id IS NULL)
         AND (UPPER(COALESCE(estado, 'ACTIVO')) = 'ACTIVO')
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
         COALESCE(p.costo_actual, 0)::numeric AS costo_actual,
         COALESCE(p.precio_venta, 0)::numeric AS precio_venta,
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
       WHERE (p.empresa_id = $1 OR p.empresa_id IS NULL)
         AND (UPPER(COALESCE(p.estado, 'ACTIVO')) = 'ACTIVO')
       ORDER BY p.nombre ASC`,
      [empresaId]
    );

    // 5. Existencias agrupadas por producto y almacén
    const existenciasRows = await query(
      `SELECT
         ep.existencia_producto_id,
         ep.producto_id,
         ep.almacen_id,
         COALESCE(ep.cantidad_actual, 0)::numeric AS cantidad_actual,
         COALESCE(ep.cantidad_reservada, 0)::numeric AS cantidad_reservada,
         (COALESCE(ep.cantidad_actual, 0) - COALESCE(ep.cantidad_reservada, 0))::numeric AS cantidad_disponible,
         COALESCE(ep.costo_promedio, 0)::numeric AS costo_promedio
       FROM admin.existencias_producto ep
       JOIN admin.almacenes a ON ep.almacen_id = a.almacen_id
       WHERE (ep.empresa_id = $1 OR ep.empresa_id IS NULL)
         AND (UPPER(COALESCE(a.estado, 'ACTIVO')) = 'ACTIVO')
         AND (UPPER(COALESCE(ep.estado, 'ACTIVO')) = 'ACTIVO')`,
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

    // 6. Clientes activos (CRM) - Filtro real por fecha_eliminacion IS NULL (sin columna activo)
    const clientesRows = await query(
      `SELECT
         c.cliente_id,
         c.nombre,
         c.apellido,
         COALESCE(c.nombre_completo, TRIM(CONCAT(c.nombre, ' ', c.apellido))) AS nombre_completo,
         c.identificacion,
         c.telefono_principal,
         c.correo
       FROM admin.clientes c
       WHERE (c.empresa_id = $1 OR c.empresa_id IS NULL)
         AND c.fecha_eliminacion IS NULL
       ORDER BY c.nombre_completo ASC NULLS LAST, c.cliente_id DESC
       LIMIT 500`,
      [empresaId]
    );

    return NextResponse.json({
      success: true,
      tipos_factura: finalTiposFactura,
      tipos_pago: finalTiposPago,
      almacenes: almacenesRows || [],
      productos: productosConStock,
      clientes: clientesRows || [],
      permisos: perms
    });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error en GET /api/facturacion/catalogos:", error);
    return NextResponse.json(
      {
        error: "SERVER_ERROR",
        message: errorMsg ? `Error al cargar catálogos: ${errorMsg}` : "Error interno al cargar catálogos de facturación."
      },
      { status: 500 }
    );
  }
}
