import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

export const dynamic = "force-dynamic";

interface RawOrderRow {
  orden_trabajo_id: number;
  codigo_orden: string;
  cliente_id: number;
  bicicleta_id: number | null;
  empresa_id: number;
  estado_orden_id: number;
  estado_codigo: string;
  estado_nombre: string;
  estado_color: string | null;
  fecha_registro: string | Date;
  fecha_finalizacion: string | Date | null;
  c_id: number;
  cliente_nombre: string;
  cliente_identificacion: string | null;
  cliente_telefono: string | null;
  cliente_correo: string | null;
  b_id: number | null;
  bicicleta_marca: string | null;
  bicicleta_modelo: string | null;
  bicicleta_ano: number | null;
  bicicleta_color: string | null;
  bicicleta_serie: string | null;
}

interface RawServiceRow {
  orden_servicio_id: number;
  orden_trabajo_id: number;
  tipo_servicio_id: number | null;
  codigo: string;
  descripcion: string;
  cantidad: number | string;
  precio_unitario: number | string;
  descuento: number | string;
  subtotal: number | string;
}

interface RawPartRow {
  orden_producto_id: number;
  orden_trabajo_id: number;
  producto_id: number;
  almacen_id: number | null;
  codigo: string;
  descripcion: string;
  cantidad: number | string;
  precio_unitario: number | string;
  descuento: number | string;
  subtotal: number | string;
  costo_unitario: number | string | null;
  utilizado: boolean;
}

export async function GET(request: Request) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    // Validación RBAC: Solo usuarios con permiso para ver facturación
    const perms = await getModulePermissions("FACTURACION", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permisos para consultar órdenes facturables." },
        { status: 403 }
      );
    }

    const empresaId = session.empresa_id;
    const { searchParams } = new URL(request.url);
    const searchTerm = (searchParams.get("q") || "").trim();

    // 1. Consultar únicamente Órdenes de Trabajo en estado LISTA_ENTREGA (ID 7)
    // Excluyendo estrictamente cualquier OT que ya tenga factura activa en admin.facturas (Sección 2 y 3)
    const queryParams: (number | string)[] = [empresaId];
    let searchCondition = "";

    if (searchTerm) {
      queryParams.push(`%${searchTerm}%`);
      const pIndex = queryParams.length;
      searchCondition = `
        AND (
          ot.codigo_orden ILIKE $${pIndex}
          OR c.nombre_completo ILIKE $${pIndex}
          OR c.identificacion ILIKE $${pIndex}
          OR b.marca ILIKE $${pIndex}
          OR b.modelo ILIKE $${pIndex}
        )
      `;
    }

    const ordersSql = `
      SELECT 
        ot.orden_trabajo_id,
        ot.codigo_orden,
        ot.cliente_id,
        ot.bicicleta_id,
        c.empresa_id,
        ot.estado_orden_id,
        eot.codigo AS estado_codigo,
        eot.nombre AS estado_nombre,
        eot.color_estado AS estado_color,
        ot.fecha_registro,
        ot.fecha_finalizacion,
        c.cliente_id AS c_id,
        COALESCE(c.nombre_completo, 'Cliente General') AS cliente_nombre,
        c.identificacion AS cliente_identificacion,
        c.telefono_principal AS cliente_telefono,
        c.correo AS cliente_correo,
        b.bicicleta_id AS b_id,
        COALESCE(b.marca, 'Bicicleta') AS bicicleta_marca,
        COALESCE(b.modelo, 'Sin Modelo') AS bicicleta_modelo,
        b.ano AS bicicleta_ano,
        b.color AS bicicleta_color,
        b.numero_serie_cuadro AS bicicleta_serie
      FROM admin.ordenes_trabajo ot
      JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
      LEFT JOIN admin.bicicletas b ON ot.bicicleta_id = b.bicicleta_id
      LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
      WHERE c.empresa_id = $1
        AND (ot.activo IS DISTINCT FROM false)
        AND (eot.codigo = 'LISTA_ENTREGA' OR ot.estado_orden_id = 7)
        AND NOT EXISTS (
          SELECT 1 FROM admin.facturas f
          WHERE f.orden_trabajo_id = ot.orden_trabajo_id
            AND f.empresa_id = $1
            AND f.estado <> 'ANULADA'
        )
        ${searchCondition}
      ORDER BY ot.orden_trabajo_id DESC
      LIMIT 50;
    `;

    const rawOrders = await query<RawOrderRow>(ordersSql, queryParams);

    if (!rawOrders || rawOrders.length === 0) {
      return NextResponse.json({
        success: true,
        data: []
      });
    }

    const orderIds = rawOrders.map((o) => o.orden_trabajo_id);

    // 2. Consultar Servicios activos de las órdenes encontradas (Sección 7)
    const servicesSql = `
      SELECT 
        os.orden_servicio_id,
        os.orden_trabajo_id,
        os.tipo_servicio_id,
        COALESCE(os.codigo_servicio, 'SRV-' || LPAD(os.orden_servicio_id::text, 4, '0')) AS codigo,
        COALESCE(ts.nombre, 'Servicio de Taller') AS descripcion,
        COALESCE(os.cantidad, 1)::numeric AS cantidad,
        COALESCE(os.precio_unitario, 0)::numeric AS precio_unitario,
        COALESCE(os.valor_descuento, 0)::numeric AS descuento,
        COALESCE(
          NULLIF(os.subtotal, 0),
          ROUND((COALESCE(os.cantidad, 1) * COALESCE(os.precio_unitario, 0)) - COALESCE(os.valor_descuento, 0), 2)
        )::numeric AS subtotal
      FROM admin.orden_servicios os
      LEFT JOIN admin.tipo_servicio ts ON os.tipo_servicio_id = ts.tipo_servicio_id
      WHERE os.orden_trabajo_id = ANY($1::int[])
        AND (os.activo IS DISTINCT FROM false)
      ORDER BY os.orden_servicio_id ASC;
    `;
    const rawServices = await query<RawServiceRow>(servicesSql, [orderIds]);

    // 3. Consultar Repuestos de las órdenes: estrictamente CONSUMIDOS (utilizado = true) (Sección 8)
    const partsSql = `
      SELECT 
        op.orden_producto_id,
        op.orden_trabajo_id,
        op.producto_id,
        op.almacen_id,
        COALESCE(p.codigo_producto, 'PRD-' || LPAD(op.producto_id::text, 4, '0')) AS codigo,
        COALESCE(p.nombre, 'Repuesto #' || op.producto_id::text) AS descripcion,
        COALESCE(op.cantidad, 1)::numeric AS cantidad,
        COALESCE(op.precio_unitario, 0)::numeric AS precio_unitario,
        COALESCE(op.valor_descuento, 0)::numeric AS descuento,
        COALESCE(
          NULLIF(op.subtotal, 0),
          ROUND((COALESCE(op.cantidad, 1) * COALESCE(op.precio_unitario, 0)) - COALESCE(op.valor_descuento, 0), 2)
        )::numeric AS subtotal,
        COALESCE(ep.costo_promedio, p.costo_actual, 0)::numeric AS costo_unitario,
        op.utilizado
      FROM admin.orden_productos op
      LEFT JOIN admin.productos p ON op.producto_id = p.producto_id
      LEFT JOIN admin.existencias_producto ep ON (ep.producto_id = op.producto_id AND ep.almacen_id = op.almacen_id)
      WHERE op.orden_trabajo_id = ANY($1::int[])
        AND op.utilizado = true
      ORDER BY op.orden_producto_id ASC;
    `;
    const rawParts = await query<RawPartRow>(partsSql, [orderIds]);

    // 4. Indexar servicios y repuestos por orden_trabajo_id
    const servicesByOrder = new Map<number, RawServiceRow[]>();
    for (const s of rawServices || []) {
      const list = servicesByOrder.get(Number(s.orden_trabajo_id)) || [];
      list.push(s);
      servicesByOrder.set(Number(s.orden_trabajo_id), list);
    }

    const partsByOrder = new Map<number, RawPartRow[]>();
    for (const p of rawParts || []) {
      const list = partsByOrder.get(Number(p.orden_trabajo_id)) || [];
      list.push(p);
      partsByOrder.set(Number(p.orden_trabajo_id), list);
    }

    // 5. Mapear respuesta integral
    const items = rawOrders.map((ot) => {
      const otId = Number(ot.orden_trabajo_id);
      const serviciosOrden = (servicesByOrder.get(otId) || []).map((s) => ({
        orden_servicio_id: Number(s.orden_servicio_id),
        tipo_servicio_id: s.tipo_servicio_id ? Number(s.tipo_servicio_id) : null,
        codigo: s.codigo,
        descripcion: s.descripcion,
        cantidad: parseFloat(Number(s.cantidad).toFixed(2)),
        precio_unitario: parseFloat(Number(s.precio_unitario).toFixed(2)),
        descuento: parseFloat(Number(s.descuento || 0).toFixed(2)),
        subtotal: parseFloat(Number(s.subtotal).toFixed(2))
      }));

      const repuestosOrden = (partsByOrder.get(otId) || []).map((r) => ({
        orden_producto_id: Number(r.orden_producto_id),
        producto_id: Number(r.producto_id),
        almacen_id: r.almacen_id ? Number(r.almacen_id) : null,
        codigo: r.codigo,
        descripcion: r.descripcion,
        cantidad: parseFloat(Number(r.cantidad).toFixed(2)),
        precio_unitario: parseFloat(Number(r.precio_unitario).toFixed(2)),
        descuento: parseFloat(Number(r.descuento || 0).toFixed(2)),
        subtotal: parseFloat(Number(r.subtotal).toFixed(2)),
        costo_unitario: r.costo_unitario != null ? parseFloat(Number(r.costo_unitario).toFixed(2)) : null,
        utilizado: Boolean(r.utilizado)
      }));

      const subtotalServicios = serviciosOrden.reduce((sum, s) => sum + s.subtotal, 0);
      const subtotalRepuestos = repuestosOrden.reduce((sum, r) => sum + r.subtotal, 0);
      const descuentoServicios = serviciosOrden.reduce((sum, s) => sum + s.descuento, 0);
      const descuentoRepuestos = repuestosOrden.reduce((sum, r) => sum + r.descuento, 0);
      const descuentoTotal = parseFloat((descuentoServicios + descuentoRepuestos).toFixed(2));
      const subtotalGeneral = parseFloat((subtotalServicios + subtotalRepuestos).toFixed(2));
      const totalOrden = subtotalGeneral;

      return {
        orden_trabajo_id: otId,
        codigo_orden: ot.codigo_orden,
        fecha_registro: ot.fecha_registro,
        fecha_finalizacion: ot.fecha_finalizacion,
        cliente: {
          cliente_id: Number(ot.c_id),
          nombre_completo: ot.cliente_nombre,
          identificacion: ot.cliente_identificacion || "",
          telefono_principal: ot.cliente_telefono || "",
          correo: ot.cliente_correo || ""
        },
        bicicleta: ot.b_id ? {
          bicicleta_id: Number(ot.b_id),
          marca: ot.bicicleta_marca || "",
          modelo: ot.bicicleta_modelo || "",
          ano: ot.bicicleta_ano,
          color: ot.bicicleta_color,
          numero_serie_cuadro: ot.bicicleta_serie
        } : null,
        servicios: serviciosOrden,
        repuestos: repuestosOrden,
        totales: {
          subtotal_servicios: parseFloat(subtotalServicios.toFixed(2)),
          subtotal_repuestos: parseFloat(subtotalRepuestos.toFixed(2)),
          subtotal_general: subtotalGeneral,
          descuento_total: descuentoTotal,
          impuesto: 0,
          total_orden: totalOrden,
          cantidad_servicios: serviciosOrden.length,
          cantidad_repuestos: repuestosOrden.length
        },
        estado: {
          estado_orden_id: Number(ot.estado_orden_id),
          codigo: ot.estado_codigo,
          nombre: ot.estado_nombre,
          color_estado: ot.estado_color
        }
      };
    });

    return NextResponse.json({
      success: true,
      data: items
    });
  } catch (err) {
    console.error("Error en GET /api/facturacion/ordenes-facturables:", err);
    return NextResponse.json(
      {
        error: "ERROR_ORDENES_FACTURABLES",
        message: "No se pudieron obtener las órdenes facturables."
      },
      { status: 500 }
    );
  }
}
