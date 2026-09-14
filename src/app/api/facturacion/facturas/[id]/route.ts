import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
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
        { error: "FORBIDDEN", message: "No tienes permisos para ver el detalle de facturas." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const facturaId = parseInt(id, 10);
    if (isNaN(facturaId) || facturaId <= 0) {
      return NextResponse.json(
        { error: "INVALID_ID", message: "El identificador de la factura no es válido." },
        { status: 400 }
      );
    }

    const empresaId = session.empresa_id;

    // 1. Cabecera de factura con Anti-IDOR estricto (Sección 13)
    const facSql = `
      SELECT
        f.factura_id,
        f.empresa_id,
        f.codigo_factura,
        f.numero_factura,
        f.tipo_factura_id,
        tf.codigo AS tipo_factura_codigo,
        tf.nombre AS tipo_factura_nombre,
        f.cliente_id,
        f.orden_trabajo_id,
        f.fecha_factura,
        f.subtotal,
        f.descuento,
        f.descuento_total,
        f.impuesto,
        f.impuesto_total,
        f.total,
        f.total_factura,
        f.monto_pagado,
        f.balance_pendiente,
        f.estado,
        f.observacion,
        f.fecha_creacion,
        f.fecha_modificacion,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), u.correo_electronico, ('Usuario #' || u.usuario_id::text)) AS usuario_creacion_nombre
      FROM admin.facturas f
      JOIN admin.tipo_factura tf ON f.tipo_factura_id = tf.tipo_factura_id
      LEFT JOIN admin.usuario u ON f.usuario_creacion_id = u.usuario_id
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      WHERE f.factura_id = $1 AND f.empresa_id = $2;
    `;
    const facRows = await query<Record<string, unknown>>(facSql, [facturaId, empresaId]);

    if (!facRows || facRows.length === 0) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "La factura solicitada no existe o no pertenece a su empresa." },
        { status: 404 }
      );
    }

    const factura = facRows[0];

    // 2. Datos del Cliente
    let cliente = null;
    if (factura.cliente_id) {
      const cliSql = `
        SELECT
          c.cliente_id,
          c.nombre_completo,
          c.identificacion,
          c.telefono_principal,
          c.correo,
          c.direccion
        FROM admin.clientes c
        WHERE c.cliente_id = $1 AND (c.empresa_id = $2 OR c.empresa_id IS NULL);
      `;
      const cliRows = await query<Record<string, unknown>>(cliSql, [factura.cliente_id, empresaId]);
      if (cliRows && cliRows.length > 0) {
        cliente = cliRows[0];
      }
    }

    // 3. Datos de Orden de Trabajo y Bicicleta (si aplica)
    let ordenTrabajo = null;
    if (factura.orden_trabajo_id) {
      const otSql = `
        SELECT
          ot.orden_trabajo_id,
          ot.codigo_orden,
          ot.estado_orden_id,
          eot.codigo AS estado_codigo,
          eot.nombre AS estado_nombre,
          eot.color_estado,
          ot.fecha_registro,
          ot.fecha_finalizacion,
          b.bicicleta_id,
          b.marca AS bicicleta_marca,
          b.modelo AS bicicleta_modelo,
          b.ano AS bicicleta_ano,
          b.color AS bicicleta_color,
          b.numero_serie_cuadro AS bicicleta_serie,
          b.codigo_qr AS bicicleta_qr
        FROM admin.ordenes_trabajo ot
        LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
        LEFT JOIN admin.bicicletas b ON ot.bicicleta_id = b.bicicleta_id
        WHERE ot.orden_trabajo_id = $1 AND ot.empresa_id = $2;
      `;
      const otRows = await query<Record<string, unknown>>(otSql, [factura.orden_trabajo_id, empresaId]);
      if (otRows && otRows.length > 0) {
        const o = otRows[0];
        ordenTrabajo = {
          orden_trabajo_id: Number(o.orden_trabajo_id),
          codigo_orden: o.codigo_orden,
          estado_orden_id: Number(o.estado_orden_id),
          estado_codigo: o.estado_codigo,
          estado_nombre: o.estado_nombre,
          color_estado: o.color_estado,
          fecha_registro: o.fecha_registro,
          fecha_finalizacion: o.fecha_finalizacion,
          bicicleta: o.bicicleta_id ? {
            bicicleta_id: Number(o.bicicleta_id),
            marca: o.bicicleta_marca || "",
            modelo: o.bicicleta_modelo || "",
            ano: o.bicicleta_ano,
            color: o.bicicleta_color,
            numero_serie_cuadro: o.bicicleta_serie,
            codigo_qr: o.bicicleta_qr
          } : null
        };
      }
    }

    // 4. Detalle de líneas de la factura (Snapshot histórico, Sección 10)
    const detSql = `
      SELECT
        df.detalle_factura_id,
        df.factura_id,
        df.almacen_id,
        a.nombre AS almacen_nombre,
        df.tipo_linea,
        df.producto_id,
        df.tipo_servicio_id,
        df.orden_servicio_id,
        df.orden_producto_id,
        df.codigo,
        df.descripcion,
        df.cantidad,
        df.precio_unitario,
        df.descuento,
        df.subtotal,
        df.costo_unitario
      FROM admin.detalle_factura df
      LEFT JOIN admin.almacenes a ON df.almacen_id = a.almacen_id
      WHERE df.factura_id = $1
      ORDER BY df.detalle_factura_id ASC;
    `;
    const detRows = await query<Record<string, unknown>>(detSql, [facturaId]);
    const detalle = (detRows || []).map((d) => ({
      detalle_factura_id: Number(d.detalle_factura_id),
      almacen_id: d.almacen_id ? Number(d.almacen_id) : null,
      almacen_nombre: d.almacen_nombre || (d.tipo_linea === "SERVICIO" ? "Taller (Servicio)" : "Almacén"),
      tipo_linea: d.tipo_linea,
      producto_id: d.producto_id ? Number(d.producto_id) : null,
      tipo_servicio_id: d.tipo_servicio_id ? Number(d.tipo_servicio_id) : null,
      orden_servicio_id: d.orden_servicio_id ? Number(d.orden_servicio_id) : null,
      orden_producto_id: d.orden_producto_id ? Number(d.orden_producto_id) : null,
      codigo: d.codigo || "",
      descripcion: d.descripcion,
      cantidad: parseFloat(Number(d.cantidad || 0).toFixed(2)),
      precio_unitario: parseFloat(Number(d.precio_unitario || 0).toFixed(2)),
      descuento: parseFloat(Number(d.descuento || 0).toFixed(2)),
      subtotal: parseFloat(Number(d.subtotal || 0).toFixed(2)),
      costo_unitario: d.costo_unitario != null ? parseFloat(Number(d.costo_unitario).toFixed(2)) : null
    }));

    // 5. Historial de Pagos aplicados (Sección 12)
    const pagosSql = `
      SELECT
        p.pago_id,
        p.factura_id,
        p.tipo_pago_id,
        tp.codigo AS tipo_pago_codigo,
        tp.nombre AS tipo_pago_nombre,
        p.monto,
        p.referencia,
        p.observacion,
        p.fecha_pago,
        p.estado,
        p.fecha_creacion,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), u.correo_electronico, ('Usuario #' || u.usuario_id::text)) AS usuario_nombre
      FROM admin.pagos p
      JOIN admin.tipo_pago tp ON p.tipo_pago_id = tp.tipo_pago_id
      LEFT JOIN admin.usuario u ON p.usuario_id = u.usuario_id
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      WHERE p.factura_id = $1 AND p.empresa_id = $2
      ORDER BY p.pago_id ASC;
    `;
    const pagosRows = await query<Record<string, unknown>>(pagosSql, [facturaId, empresaId]);
    const pagos = (pagosRows || []).map((p) => ({
      pago_id: Number(p.pago_id),
      tipo_pago_id: Number(p.tipo_pago_id),
      tipo_pago_codigo: p.tipo_pago_codigo,
      tipo_pago_nombre: p.tipo_pago_nombre,
      monto: parseFloat(Number(p.monto || 0).toFixed(2)),
      referencia: p.referencia || null,
      observacion: p.observacion || null,
      fecha_pago: p.fecha_pago,
      estado: p.estado,
      usuario_nombre: p.usuario_nombre || "Sistema"
    }));

    // 6. Datos reales de la Empresa (Sección 20)
    const empSql = `
      SELECT
        e.empresa_id,
        e.nombre_comercial,
        e.rnc,
        e.telefono,
        e.correo,
        e.direccion,
        e.logotipo_url
      FROM admin.empresas e
      WHERE e.empresa_id = $1;
    `;
    const empRows = await query<Record<string, unknown>>(empSql, [empresaId]);
    const empresa = empRows && empRows.length > 0 ? empRows[0] : {
      empresa_id: empresaId,
      nombre_comercial: "RIDE LAB",
      rnc: "",
      telefono: "",
      correo: "",
      direccion: "",
      logotipo_url: null
    };

    return NextResponse.json({
      success: true,
      data: {
        factura: {
          factura_id: Number(factura.factura_id),
          codigo_factura: factura.codigo_factura,
          numero_factura: factura.numero_factura || factura.codigo_factura,
          tipo_factura_id: Number(factura.tipo_factura_id),
          tipo_factura_codigo: factura.tipo_factura_codigo,
          tipo_factura_nombre: factura.tipo_factura_nombre,
          cliente_id: factura.cliente_id ? Number(factura.cliente_id) : null,
          orden_trabajo_id: factura.orden_trabajo_id ? Number(factura.orden_trabajo_id) : null,
          fecha_factura: factura.fecha_factura,
          subtotal: parseFloat(Number(factura.subtotal || 0).toFixed(2)),
          descuento: parseFloat(Number(factura.descuento || factura.descuento_total || 0).toFixed(2)),
          impuesto: parseFloat(Number(factura.impuesto || factura.impuesto_total || 0).toFixed(2)),
          total: parseFloat(Number(factura.total || factura.total_factura || 0).toFixed(2)),
          monto_pagado: parseFloat(Number(factura.monto_pagado || 0).toFixed(2)),
          balance_pendiente: parseFloat(Number(factura.balance_pendiente || 0).toFixed(2)),
          estado: factura.estado,
          observacion: factura.observacion || "",
          fecha_creacion: factura.fecha_creacion,
          usuario_creacion_nombre: factura.usuario_creacion_nombre || "Sistema"
        },
        cliente,
        orden_trabajo: ordenTrabajo,
        detalle,
        pagos,
        empresa
      }
    });
  } catch (err) {
    console.error("Error en GET /api/facturacion/facturas/[id]:", err);
    return NextResponse.json(
      { error: "ERROR_DETALLE_FACTURA", message: "No se pudo obtener el detalle de la factura." },
      { status: 500 }
    );
  }
}
