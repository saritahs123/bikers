import { NextRequest, NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

// GET /api/taller/facturacion/ordenes/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    if (!id || typeof id !== "string" || !/^\d+$/.test(id.trim())) {
      return NextResponse.json(
        { error: "INVALID_ID", message: "Identificador de orden inválido." },
        { status: 400 }
      );
    }

    const ordenId = Number(id.trim());
    if (!Number.isSafeInteger(ordenId) || ordenId <= 0) {
      return NextResponse.json(
        { error: "INVALID_ID", message: "Identificador de orden inválido." },
        { status: 400 }
      );
    }

    const session = await getWorkshopSession();
    if (!session || !session.usuario_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión inválida o expirada." },
        { status: 401 }
      );
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permiso para consultar esta orden." },
        { status: 403 }
      );
    }

    // 1. Existence and company isolation check
    const existenceSql = `
      SELECT
        ot.orden_trabajo_id,
        ot.recepcion_id,
        ot.cliente_id,
        ot.estado_orden_id,
        ot.activo,
        ot.facturado,
        ot.fecha_facturacion,
        ot.usuario_facturacion_id,
        c.empresa_id AS order_empresa_id
      FROM admin.ordenes_trabajo ot
      JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
      WHERE ot.orden_trabajo_id = $1 AND ot.activo = true
    `;
    const existenceRes = await query<any>(existenceSql, [ordenId]);
    if (!existenceRes || existenceRes.length === 0) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "La orden solicitada no existe." },
        { status: 404 }
      );
    }

    const otCheck = existenceRes[0];
    const orderEmpresaId = otCheck.order_empresa_id ?? null;

    if (
      session.empresa_id == null ||
      orderEmpresaId == null ||
      Number(session.empresa_id) !== Number(orderEmpresaId)
    ) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "La orden solicitada no existe o no pertenece a su empresa." },
        { status: 404 }
      );
    }

    // 2. Fetch complete order, customer and bicycle details
    const orderSql = `
      SELECT 
        ot.orden_trabajo_id AS orden_id,
        ot.orden_trabajo_id,
        ot.codigo_orden,
        ot.recepcion_id,
        r.codigo_recepcion,
        ot.estado_orden_id,
        eot.nombre AS estado_nombre,
        eot.codigo AS estado_codigo,
        ot.prioridad_orden_id AS prioridad_id,
        pot.nombre AS prioridad_nombre,
        pot.color_estado AS prioridad_color,
        ot.diagnostico_inicial,
        ot.descripcion_cliente,
        ot.observacion_interna AS observaciones,
        ot.fecha_recepcion AS fecha_ingreso,
        ot.fecha_entrega_estimada AS fecha_prometida,
        ot.fecha_entrega_real AS fecha_entrega,
        ot.fecha_inicio_trabajo,
        ot.fecha_finalizacion,
        COALESCE(ot.total_tiempo_transcurrido, 0) AS total_tiempo_transcurrido,
        ot.mecanico_id,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', ui_mec.nombre, ui_mec.apellido)), ''),
          (
            SELECT NULLIF(TRIM(CONCAT_WS(' ', ui_s.nombre, ui_s.apellido)), '')
            FROM admin.orden_servicios os_m
            JOIN admin.usuario u_s ON u_s.usuario_id = os_m.usuario_id
            JOIN admin.usuario_identidad ui_s ON ui_s.usuario_id = u_s.usuario_id
            WHERE os_m.orden_trabajo_id = ot.orden_trabajo_id AND (os_m.activo IS DISTINCT FROM false)
            ORDER BY os_m.orden_servicio_id ASC LIMIT 1
          ),
          'No asignado'
        ) AS mecanico_nombre,
        COALESCE(
          cargo_mec.nombre,
          (
            SELECT c_s.nombre
            FROM admin.orden_servicios os_m
            JOIN admin.usuario u_s ON u_s.usuario_id = os_m.usuario_id
            JOIN admin.usuario_identidad ui_s ON ui_s.usuario_id = u_s.usuario_id
            LEFT JOIN admin.cargo c_s ON c_s.cargo_id = ui_s.cargo_id
            WHERE os_m.orden_trabajo_id = ot.orden_trabajo_id AND (os_m.activo IS DISTINCT FROM false)
            ORDER BY os_m.orden_servicio_id ASC LIMIT 1
          ),
          null
        ) AS mecanico_cargo,
        COALESCE(ot.facturado, false) AS facturado,
        ot.fecha_facturacion,
        ot.usuario_facturacion_id,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui_fact.nombre, ui_fact.apellido)), ''), uf.estado, ('Usuario #' || uf.usuario_id::text)) AS usuario_facturacion_nombre,
        ot.subtotal_servicios,
        ot.subtotal_productos AS subtotal_repuestos,
        ot.descuento_servicios,
        ot.descuento_productos,
        COALESCE(ot.descuento_servicios, 0) + COALESCE(ot.descuento_productos, 0) AS descuento_total,
        ot.subtotal_general,
        COALESCE(ot.impuesto, 0) AS impuesto,
        COALESCE(ot.total_orden, ot.subtotal_general, 0) AS total_orden,
        u_ot.empresa_id AS empresa_id,

        -- Customer Info
        COALESCE(cliente_ot.cliente_id, cliente_recepcion.cliente_id) AS cliente_id,
        COALESCE(cliente_ot.nombre_completo, cliente_recepcion.nombre_completo, 'Cliente General') AS cliente_nombre,
        COALESCE(cliente_ot.identificacion, cliente_recepcion.identificacion, '') AS cliente_identificacion,
        COALESCE(cliente_ot.telefono_principal, cliente_recepcion.telefono_principal, '') AS cliente_telefono,
        COALESCE(cliente_ot.correo, cliente_recepcion.correo, '') AS cliente_correo,
        COALESCE(cliente_ot.direccion, cliente_recepcion.direccion, '') AS cliente_direccion,

        -- Bicycle Info
        COALESCE(bicicleta_ot.bicicleta_id, bicicleta_recepcion.bicicleta_id) AS bicicleta_id,
        COALESCE(bicicleta_ot.marca, bicicleta_recepcion.marca, 'Bicicleta') AS bicicleta_marca,
        COALESCE(bicicleta_ot.modelo, bicicleta_recepcion.modelo, 'Sin Modelo') AS bicicleta_modelo,
        COALESCE(bicicleta_ot.ano, bicicleta_recepcion.ano) AS bicicleta_ano,
        COALESCE(bicicleta_ot.color, bicicleta_recepcion.color, '') AS bicicleta_color,
        COALESCE(bicicleta_ot.numero_serie_cuadro, bicicleta_recepcion.numero_serie_cuadro, '') AS bicicleta_serie,
        COALESCE(bicicleta_ot.codigo_qr, bicicleta_recepcion.codigo_qr, '') AS bicicleta_qr
      FROM admin.ordenes_trabajo ot
      JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
      LEFT JOIN admin.usuario uf ON uf.usuario_id = ot.usuario_facturacion_id
      LEFT JOIN admin.usuario_identidad ui_fact ON ui_fact.usuario_id = uf.usuario_id
      LEFT JOIN admin.usuario u_mec ON u_mec.usuario_id = ot.mecanico_id
      LEFT JOIN admin.usuario_identidad ui_mec ON ui_mec.usuario_id = u_mec.usuario_id
      LEFT JOIN admin.cargo cargo_mec ON cargo_mec.cargo_id = ui_mec.cargo_id
      LEFT JOIN admin.recepciones r ON ot.recepcion_id = r.recepcion_id
      LEFT JOIN admin.clientes cliente_ot ON cliente_ot.cliente_id = ot.cliente_id
      LEFT JOIN admin.clientes cliente_recepcion ON cliente_recepcion.cliente_id = r.cliente_id
      LEFT JOIN admin.bicicletas bicicleta_ot ON bicicleta_ot.bicicleta_id = ot.bicicleta_id
      LEFT JOIN admin.bicicletas bicicleta_recepcion ON bicicleta_recepcion.bicicleta_id = r.bicicleta_id
      LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
      LEFT JOIN admin.prioridad_orden_trabajo pot ON ot.prioridad_orden_id = pot.prioridad_orden_trabajo_id
      WHERE ot.orden_trabajo_id = $1 AND ot.activo = true
    `;

    const orderRes = await query<any>(orderSql, [ordenId]);
    if (!orderRes || orderRes.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "La orden solicitada no existe." }, { status: 404 });
    }

    const orderData = orderRes[0];

    // 3. Fetch billable services
    const servSql = `
      SELECT 
        os.orden_servicio_id AS item_id,
        os.orden_servicio_id,
        'SERVICIO' AS tipo_concepto,
        COALESCE(os.codigo_servicio, 'SRV-' || LPAD(os.orden_servicio_id::text, 4, '0')) AS codigo,
        COALESCE(ts.nombre, 'Servicio de Taller') AS descripcion,
        COALESCE(os.cantidad, 1) AS cantidad,
        COALESCE(os.precio_unitario, 0) AS precio_unitario,
        COALESCE(os.porcentaje_descuento, 0) AS porcentaje_descuento,
        COALESCE(os.valor_descuento, 0) AS descuento,
        COALESCE(NULLIF(os.subtotal, 0), ROUND((COALESCE(os.cantidad, 1) * COALESCE(os.precio_unitario, 0)) - COALESCE(os.valor_descuento, 0), 2)) AS subtotal,
        os.observacion_tecnica AS notas,
        os.estado_orden_servicio_id,
        eos.codigo AS estado_servicio_codigo,
        eos.nombre AS estado_servicio_nombre
      FROM admin.orden_servicios os
      LEFT JOIN admin.tipo_servicio ts ON os.tipo_servicio_id = ts.tipo_servicio_id
      LEFT JOIN admin.estado_orden_servicio eos ON os.estado_orden_servicio_id = eos.estado_orden_servicio_id
      WHERE os.orden_trabajo_id = $1 AND (os.activo IS DISTINCT FROM false)
      ORDER BY os.orden_servicio_id ASC
    `;
    const services = await query<any>(servSql, [ordenId]);

    // 4. Fetch billable products / spare parts
    const prodSql = `
      SELECT 
        op.orden_producto_id AS item_id,
        op.orden_producto_id,
        'REPUESTO' AS tipo_concepto,
        COALESCE(p.codigo_producto, 'PRD-' || LPAD(op.producto_id::text, 4, '0')) AS codigo,
        COALESCE(p.nombre, 'Repuesto / Producto #' || op.producto_id::text) AS descripcion,
        COALESCE(op.cantidad, 1) AS cantidad,
        COALESCE(op.precio_unitario, 0) AS precio_unitario,
        COALESCE(op.porcentaje_descuento, 0) AS porcentaje_descuento,
        COALESCE(op.valor_descuento, 0) AS descuento,
        COALESCE(NULLIF(op.subtotal, 0), ROUND((COALESCE(op.cantidad, 1) * COALESCE(op.precio_unitario, 0)) - COALESCE(op.valor_descuento, 0), 2)) AS subtotal,
        op.observacion AS notas
      FROM admin.orden_productos op
      LEFT JOIN admin.productos p ON op.producto_id = p.producto_id
      WHERE op.orden_trabajo_id = $1
      ORDER BY op.orden_producto_id ASC
    `;
    const products = await query<any>(prodSql, [ordenId]);

    // 5. Check open timers
    const timerSql = `
      SELECT COUNT(*)::int as count
      FROM admin.orden_servicio_mano_obra mo
      JOIN admin.orden_servicios os ON os.orden_servicio_id = mo.orden_servicio_id
      WHERE os.orden_trabajo_id = $1
        AND (mo.activo IS DISTINCT FROM false)
        AND mo.fecha_finalizacion IS NULL
    `;
    const timerRes = await query<any>(timerSql, [ordenId]);
    const openTimersCount = Number(timerRes[0]?.count || 0);

    // Business Rules validation for invoicing
    const isFacturado = Boolean(orderData.facturado);
    const estadoId = Number(orderData.estado_orden_id);
    const totalOrdenDB = parseFloat(orderData.total_orden || 0);

    const incompleteServices = (services || []).filter((s: any) => {
      const cod = String(s.estado_servicio_codigo || "").toUpperCase();
      return !['COMPLETADO', 'FINALIZADO', 'CANCELADO', 'ANULADO'].includes(cod) && [1, 2].includes(Number(s.estado_orden_servicio_id));
    });

    let puede_facturarse = false;
    let motivo_no_facturable: string | null = null;

    if (isFacturado) {
      puede_facturarse = false;
      motivo_no_facturable = "Esta orden ya fue facturada.";
    } else if (estadoId !== 7 && estadoId !== 8) {
      puede_facturarse = false;
      motivo_no_facturable = "La orden debe estar lista para entrega o entregada antes de facturarla.";
    } else if (incompleteServices.length > 0) {
      puede_facturarse = false;
      motivo_no_facturable = "Debes completar todos los servicios antes de facturar la orden.";
    } else if (openTimersCount > 0) {
      puede_facturarse = false;
      motivo_no_facturable = "No se puede facturar una orden con cronómetros activos.";
    } else if (totalOrdenDB <= 0) {
      puede_facturarse = false;
      motivo_no_facturable = "El total de la orden debe ser mayor que cero para facturarla.";
    } else {
      puede_facturarse = true;
      motivo_no_facturable = null;
    }

    // Calculate sum of items
    const allItems = [...services, ...products];
    const totalCalculado = allItems.reduce((acc, it) => acc + parseFloat(it.subtotal || 0), 0);
    const hayInconsistencia = Math.abs(totalCalculado - totalOrdenDB) > 0.05;

    return NextResponse.json({
      success: true,
      data: {
        order: {
          orden_id: orderData.orden_id,
          codigo_orden: orderData.codigo_orden,
          recepcion_id: orderData.recepcion_id,
          codigo_recepcion: orderData.codigo_recepcion,
          estado_orden_id: orderData.estado_orden_id,
          estado_nombre: orderData.estado_nombre,
          estado_codigo: orderData.estado_codigo,
          prioridad_id: orderData.prioridad_id,
          prioridad_nombre: orderData.prioridad_nombre,
          prioridad_color: orderData.prioridad_color,
          fecha_recepcion: orderData.fecha_ingreso,
          fecha_entrega_estimada: orderData.fecha_prometida,
          fecha_entrega: orderData.fecha_entrega,
          fecha_inicio_trabajo: orderData.fecha_inicio_trabajo ? String(orderData.fecha_inicio_trabajo) : null,
          fecha_finalizacion: orderData.fecha_finalizacion ? String(orderData.fecha_finalizacion) : null,
          total_tiempo_transcurrido: parseInt(orderData.total_tiempo_transcurrido || "0", 10),
          mecanico_id: orderData.mecanico_id ?? null,
          mecanico_nombre: orderData.mecanico_nombre || "No asignado",
          mecanico_cargo: orderData.mecanico_cargo || null,
          observaciones: orderData.observaciones,
          diagnostico_inicial: orderData.diagnostico_inicial,
          facturado: isFacturado,
          fecha_facturacion: orderData.fecha_facturacion ? String(orderData.fecha_facturacion) : null,
          usuario_facturacion_id: isFacturado ? orderData.usuario_facturacion_id : null,
          usuario_facturacion_nombre: isFacturado ? orderData.usuario_facturacion_nombre : null,
          puede_facturarse,
          motivo_no_facturable
        },
        cliente: {
          cliente_id: orderData.cliente_id,
          nombre_completo: orderData.cliente_nombre,
          identificacion: orderData.cliente_identificacion,
          telefono: orderData.cliente_telefono,
          correo: orderData.cliente_correo,
          direccion: orderData.cliente_direccion
        },
        bicicleta: {
          bicicleta_id: orderData.bicicleta_id,
          marca: orderData.bicicleta_marca,
          modelo: orderData.bicicleta_modelo,
          ano: orderData.bicicleta_ano,
          color: orderData.bicicleta_color,
          numero_serie: orderData.bicicleta_serie,
          codigo_qr: orderData.bicicleta_qr
        },
        conceptos: allItems,
        servicios: services,
        repuestos: products,
        resumen_financiero: {
          subtotal_servicios: parseFloat(orderData.subtotal_servicios || 0),
          subtotal_repuestos: parseFloat(orderData.subtotal_repuestos || 0),
          descuento_total: parseFloat(orderData.descuento_total || 0),
          impuesto: parseFloat(orderData.impuesto || 0),
          total_orden: totalOrdenDB,
          total_calculado_conceptos: totalCalculado,
          hay_inconsistencia_totales: hayInconsistencia
        }
      }
    });
  } catch (error: any) {
    console.error("Error in GET /api/taller/facturacion/ordenes/[id]:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: error.message }, { status: 500 });
  }
}

// PUT /api/taller/facturacion/ordenes/[id] - Disabled: Invoicing is atomically executed upon delivery
export async function PUT() {
  return NextResponse.json(
    {
      error: "METHOD_NOT_ALLOWED",
      message: "La facturación se registra automáticamente al entregar la orden al cliente."
    },
    { status: 405 }
  );
}

export async function POST() {
  return NextResponse.json({ error: "METHOD_NOT_ALLOWED", message: "Operación no permitida en el módulo de facturación." }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: "METHOD_NOT_ALLOWED", message: "Operación no permitida en el módulo de facturación." }, { status: 405 });
}
