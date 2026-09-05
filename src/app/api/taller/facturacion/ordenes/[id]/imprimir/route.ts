import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

// GET /api/taller/facturacion/ordenes/[id]/imprimir
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json(
        { error: "NO_SESSION", message: "No hay sesión activa." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const ordenId = parseInt(id, 10);
    if (!ordenId || isNaN(ordenId)) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Identificador de orden inválido." },
        { status: 400 }
      );
    }

    // Check IAM permission for Módulo TALLER
    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No posee permiso para acceder a la facturación de órdenes." },
        { status: 403 }
      );
    }

    // 1. Validate Order Existence, Company Isolation, and Eligibility (ENTREGADA & FACTURADA)
    const orderSql = `
      SELECT 
        ot.orden_trabajo_id,
        ot.codigo_orden,
        ot.recepcion_id,
        r.codigo_recepcion,
        ot.estado_orden_id,
        eot.nombre AS estado_nombre,
        eot.codigo AS estado_codigo,
        ot.prioridad_orden_id,
        pot.nombre AS prioridad_nombre,
        ot.diagnostico_inicial,
        ot.descripcion_cliente,
        ot.observacion_interna AS observaciones,
        ot.fecha_recepcion,
        ot.fecha_inicio_trabajo,
        ot.fecha_finalizacion,
        ot.fecha_entrega_real,
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
        c.empresa_id AS empresa_id,

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
      return NextResponse.json(
        { error: "NOT_FOUND", message: "La orden solicitada no existe." },
        { status: 404 }
      );
    }

    const orderData = orderRes[0];
    const orderEmpresaId = orderData.empresa_id ?? null;

    if (
      session.empresa_id == null ||
      orderEmpresaId == null ||
      Number(session.empresa_id) !== Number(orderEmpresaId)
    ) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "La orden solicitada no pertenece a su empresa." },
        { status: 404 }
      );
    }

    // Backend Validation: Must be ENTREGADA and FACTURADA
    const isEntregada =
      orderData.estado_codigo === "ENTREGADA" ||
      orderData.estado_orden_id === 8;
    const isFacturada = orderData.facturado === true;

    if (!isEntregada || !isFacturada) {
      return NextResponse.json(
        {
          error: "INVOICE_NOT_AVAILABLE",
          message: "La factura solo puede imprimirse cuando la orden esté entregada y facturada."
        },
        { status: 409 }
      );
    }

    // 2. Fetch Company Info from admin.empresa
    let empresaInfo: {
      nombre_comercial: string;
      subtitulo?: string;
      direccion?: string;
      telefono?: string;
      email?: string;
      rnc?: string;
      logotipo_url?: string | null;
    } = {
      nombre_comercial: "RIDE LAB",
      subtitulo: "Tienda y Taller de Bicicletas",
      direccion: undefined,
      telefono: undefined,
      email: undefined,
      rnc: undefined,
      logotipo_url: null
    };

    try {
      const empresaRes = await query<any>(
        `SELECT nombre_comercial, alias, direccion, telefono, email, rnc, logotipo_url 
         FROM admin.empresa 
         WHERE empresa_id = $1 LIMIT 1`,
        [orderEmpresaId]
      );
      if (empresaRes && empresaRes.length > 0) {
        const emp = empresaRes[0];
        empresaInfo = {
          nombre_comercial: emp.nombre_comercial || emp.alias || "RIDE LAB",
          subtitulo: "Tienda y Taller de Bicicletas",
          direccion: emp.direccion || undefined,
          telefono: emp.telefono || undefined,
          email: emp.email || undefined,
          rnc: emp.rnc ? (emp.rnc.length === 9 ? `${emp.rnc.slice(0, 1)}-${emp.rnc.slice(1, 3)}-${emp.rnc.slice(3)}` : emp.rnc) : undefined,
          logotipo_url: emp.logotipo_url || null
        };
      }
    } catch (empErr) {
      console.warn("Could not query admin.empresa, using fallback company metadata", empErr);
    }

    // 3. Fetch or Resolve Invoice Info
    let numeroFactura = `FAC-${orderData.codigo_orden.replace(/^OT-/, "")}`;
    let fechaFactura = orderData.fecha_facturacion || orderData.fecha_entrega_real || new Date().toISOString();
    let balancePendiente = 0;
    let totalOrden = parseFloat(orderData.total_orden || 0);
    let montoPagado = totalOrden;
    let estadoFactura = "PAGADA";

    try {
      const facturaRes = await query<any>(
        `SELECT numero_factura, fecha_factura, subtotal, descuento_total, impuesto_total, total_factura, monto_pagado, balance_pendiente, estado
         FROM admin.facturas
         WHERE orden_trabajo_id = $1
         ORDER BY factura_id DESC LIMIT 1`,
        [ordenId]
      );
      if (facturaRes && facturaRes.length > 0) {
        const fac = facturaRes[0];
        if (fac.numero_factura) numeroFactura = fac.numero_factura;
        if (fac.fecha_factura) fechaFactura = fac.fecha_factura;
        if (fac.monto_pagado != null) montoPagado = parseFloat(fac.monto_pagado);
        if (fac.balance_pendiente != null) balancePendiente = parseFloat(fac.balance_pendiente);
        if (fac.estado) estadoFactura = fac.estado;
      }
    } catch (facErr) {
      console.warn("Could not query admin.facturas, using generated invoice data", facErr);
    }

    // 4. Fetch Billable Services
    const servSql = `
      SELECT 
        os.orden_servicio_id AS item_id,
        'SERVICIO' AS tipo_concepto,
        COALESCE(os.codigo_servicio, 'SRV-' || LPAD(os.orden_servicio_id::text, 4, '0')) AS codigo,
        COALESCE(ts.nombre, os.descripcion_servicio, 'Servicio de Taller') AS descripcion,
        COALESCE(os.observacion_tecnica, '') AS notas,
        COALESCE(os.cantidad, 1.00) AS cantidad,
        COALESCE(os.precio_unitario, 0) AS precio_unitario,
        COALESCE(os.valor_descuento, 0) AS descuento,
        COALESCE(os.subtotal, (COALESCE(os.cantidad, 1.00) * COALESCE(os.precio_unitario, 0) - COALESCE(os.valor_descuento, 0))) AS subtotal
      FROM admin.orden_servicios os
      LEFT JOIN admin.tipo_servicio ts ON os.tipo_servicio_id = ts.tipo_servicio_id
      WHERE os.orden_trabajo_id = $1
        AND (os.activo IS DISTINCT FROM false)
      ORDER BY os.orden_servicio_id ASC
    `;
    const servRes = await query<any>(servSql, [ordenId]);
    const services = (servRes || []).map((s: any) => ({
      item_id: s.item_id,
      tipo_concepto: "SERVICIO",
      codigo: s.codigo,
      descripcion: s.descripcion,
      notas: s.notas || "",
      cantidad: parseFloat(s.cantidad || 1).toFixed(2),
      precio_unitario: parseFloat(s.precio_unitario || 0),
      descuento: parseFloat(s.descuento || 0),
      subtotal: parseFloat(s.subtotal || 0)
    }));

    // 5. Fetch Billable Products
    const prodSql = `
      SELECT 
        op.orden_producto_id AS item_id,
        'REPUESTO' AS tipo_concepto,
        COALESCE(p.codigo_producto, 'REP-' || LPAD(op.orden_producto_id::text, 4, '0')) AS codigo,
        COALESCE(p.nombre, 'Repuesto / Componente') AS descripcion,
        COALESCE(op.observacion, '') AS notas,
        COALESCE(op.cantidad, 1.00) AS cantidad,
        COALESCE(op.precio_unitario, 0) AS precio_unitario,
        COALESCE(op.valor_descuento, 0) AS descuento,
        COALESCE(op.subtotal, (COALESCE(op.cantidad, 1.00) * COALESCE(op.precio_unitario, 0) - COALESCE(op.valor_descuento, 0))) AS subtotal
      FROM admin.orden_productos op
      LEFT JOIN admin.productos p ON op.producto_id = p.producto_id
      WHERE op.orden_trabajo_id = $1
      ORDER BY op.orden_producto_id ASC
    `;
    const prodRes = await query<any>(prodSql, [ordenId]);
    const products = (prodRes || []).map((p: any) => ({
      item_id: p.item_id,
      tipo_concepto: "REPUESTO",
      codigo: p.codigo,
      descripcion: p.descripcion,
      notas: p.notas || "",
      cantidad: parseFloat(p.cantidad || 1).toFixed(2),
      precio_unitario: parseFloat(p.precio_unitario || 0),
      descuento: parseFloat(p.descuento || 0),
      subtotal: parseFloat(p.subtotal || 0)
    }));

    const conceptos = [...services, ...products];

    return NextResponse.json({
      success: true,
      data: {
        empresa: empresaInfo,
        factura: {
          numero_factura: numeroFactura,
          codigo_orden: orderData.codigo_orden,
          codigo_recepcion: orderData.codigo_recepcion || "Sin Recepción",
          fecha_factura: fechaFactura,
          estado: estadoFactura
        },
        cliente: {
          nombre_completo: orderData.cliente_nombre || "Cliente General",
          identificacion: orderData.cliente_identificacion || "No registrada",
          telefono: orderData.cliente_telefono || "No registrado",
          correo: orderData.cliente_correo || "No registrado",
          direccion: orderData.cliente_direccion || "No registrada"
        },
        bicicleta: {
          marca_modelo: `${orderData.bicicleta_marca || "Bicicleta"} ${orderData.bicicleta_modelo || ""}`.trim(),
          ano_color: `${orderData.bicicleta_ano || "—"} / ${orderData.bicicleta_color || "—"}`,
          numero_serie: orderData.bicicleta_serie || "No registrado",
          codigo_qr: orderData.bicicleta_qr || "No asignado"
        },
        servicio_info: {
          mecanico_responsable: orderData.mecanico_nombre || "No asignado",
          mecanico_cargo: orderData.mecanico_cargo || null,
          fecha_inicio: orderData.fecha_inicio_trabajo,
          fecha_finalizacion: orderData.fecha_finalizacion,
          tiempo_trabajo_segundos: parseInt(orderData.total_tiempo_transcurrido || "0", 10)
        },
        pago_entrega: {
          estado_pago: estadoFactura === "PAGADA" ? "Pagada" : estadoFactura,
          fecha_entrega: orderData.fecha_entrega_real || orderData.fecha_facturacion,
          entregado_por: orderData.usuario_facturacion_nombre || orderData.mecanico_nombre || "Usuario del Sistema"
        },
        observaciones: orderData.observaciones || orderData.diagnostico_inicial || "Sin observaciones adicionales",
        conceptos,
        resumen_financiero: {
          subtotal_servicios: parseFloat(orderData.subtotal_servicios || 0),
          subtotal_repuestos: parseFloat(orderData.subtotal_repuestos || 0),
          descuento_total: parseFloat(orderData.descuento_total || 0),
          impuesto: parseFloat(orderData.impuesto || 0),
          total_general: totalOrden,
          monto_pagado: montoPagado,
          balance_pendiente: balancePendiente
        }
      }
    });
  } catch (error: any) {
    console.error("Error in GET /api/taller/facturacion/ordenes/[id]/imprimir:", error);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: error.message || "Error interno del servidor." },
      { status: 500 }
    );
  }
}
