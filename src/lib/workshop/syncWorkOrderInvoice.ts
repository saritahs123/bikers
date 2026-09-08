import { QueryExecutor } from "./recalculateWorkOrderTotals";

export interface InvoiceSyncResult {
  synchronized: boolean;
  factura_id: number | null;
  numero_factura?: string;
  total_anterior?: number;
  total_nuevo?: number;
  subtotal?: number;
  descuento_total?: number;
  impuesto_total?: number;
  monto_pagado?: number;
  balance_pendiente?: number;
  sobrepago?: number;
  estado?: string;
  lineas_detalle_count?: number;
}

/**
 * Synchronizes admin.facturas and admin.detalle_factura with the current billable items
 * of a Work Order (admin.ordenes_trabajo) within an active transaction.
 *
 * CRITICAL BUSINESS RULES:
 * 1. Payments in admin.pagos are NEVER modified, deleted or auto-refunded.
 * 2. monto_pagado in admin.facturas strictly reflects the factual sum of applied payments (admin.pagos).
 * 3. balance_pendiente is mathematically computed as GREATEST(0, total_factura - monto_pagado).
 * 4. If monto_pagado > total_factura (overpayment), sobrepago is detected and reported; no fake credit notes or state mutations.
 * 5. If no invoice exists for the work order, no invoice is created (synchronized: false).
 */
export async function syncWorkOrderInvoice(
  executor: QueryExecutor,
  ordenId: number,
  usuarioId?: number
): Promise<InvoiceSyncResult> {
  // 1. Check if invoice exists for this Work Order
  const factRes = await executor.query(`
    SELECT
      factura_id,
      numero_factura,
      subtotal,
      descuento_total,
      impuesto_total,
      total_factura,
      monto_pagado,
      balance_pendiente,
      estado
    FROM admin.facturas
    WHERE orden_trabajo_id = $1
    ORDER BY factura_id DESC
    FOR UPDATE
  `, [ordenId]);

  const factRows = factRes.rows ? factRes.rows : (Array.isArray(factRes) ? factRes : []);
  if (!factRows || factRows.length === 0) {
    return {
      synchronized: false,
      factura_id: null
    };
  }

  const invoice = factRows[0];
  const facturaId = Number(invoice.factura_id);
  const totalAnterior = parseFloat(invoice.total_factura || "0");

  // 2. Fetch current active billable services
  const servRes = await executor.query(`
    SELECT
      os.orden_servicio_id,
      os.tipo_servicio_id,
      COALESCE(ts.nombre, os.descripcion_servicio, 'Servicio de Taller') AS descripcion,
      COALESCE(os.cantidad, 1.00) AS cantidad,
      COALESCE(os.precio_unitario, 0.00) AS precio_unitario,
      COALESCE(os.valor_descuento, 0.00) AS descuento,
      COALESCE(NULLIF(os.subtotal, 0), ROUND((COALESCE(os.cantidad, 1.00) * COALESCE(os.precio_unitario, 0.00)) - COALESCE(os.valor_descuento, 0.00), 2)) AS subtotal
    FROM admin.orden_servicios os
    LEFT JOIN admin.tipo_servicio ts ON os.tipo_servicio_id = ts.tipo_servicio_id
    WHERE os.orden_trabajo_id = $1 AND (os.activo IS DISTINCT FROM false)
    ORDER BY os.orden_servicio_id ASC
  `, [ordenId]);
  const services = servRes.rows ? servRes.rows : (Array.isArray(servRes) ? servRes : []);

  // 3. Fetch current active billable labor
  const laborRes = await executor.query(`
    SELECT
      mo.orden_servicio_mano_obra_id,
      mo.orden_servicio_id,
      COALESCE(mo.detalle_mano_obra, 'Mano de Obra') AS descripcion,
      1.00 AS cantidad,
      COALESCE(mo.costo_total, 0.00) AS precio_unitario,
      0.00 AS descuento,
      COALESCE(mo.costo_total, 0.00) AS subtotal
    FROM admin.orden_servicio_mano_obra mo
    JOIN admin.orden_servicios s ON mo.orden_servicio_id = s.orden_servicio_id
    WHERE s.orden_trabajo_id = $1
      AND (mo.activo IS DISTINCT FROM false)
      AND (s.activo IS DISTINCT FROM false)
      AND mo.detalle_mano_obra IS NOT NULL
      AND BTRIM(mo.detalle_mano_obra) <> ''
    ORDER BY mo.orden_servicio_mano_obra_id ASC
  `, [ordenId]);
  const labor = laborRes.rows ? laborRes.rows : (Array.isArray(laborRes) ? laborRes : []);

  // 4. Fetch current active products/parts
  const prodRes = await executor.query(`
    SELECT
      op.orden_producto_id,
      op.producto_id,
      COALESCE(p.nombre, 'Repuesto / Producto #' || op.producto_id::text) AS descripcion,
      COALESCE(op.cantidad, 1.00) AS cantidad,
      COALESCE(op.precio_unitario, 0.00) AS precio_unitario,
      COALESCE(op.valor_descuento, 0.00) AS descuento,
      COALESCE(NULLIF(op.subtotal, 0), ROUND((COALESCE(op.cantidad, 1.00) * COALESCE(op.precio_unitario, 0.00)) - COALESCE(op.valor_descuento, 0.00), 2)) AS subtotal
    FROM admin.orden_productos op
    LEFT JOIN admin.productos p ON op.producto_id = p.producto_id
    WHERE op.orden_trabajo_id = $1
    ORDER BY op.orden_producto_id ASC
  `, [ordenId]);
  const products = prodRes.rows ? prodRes.rows : (Array.isArray(prodRes) ? prodRes : []);

  // 5. Synchronize admin.detalle_factura
  // Delete existing lines for this invoice only
  await executor.query(`
    DELETE FROM admin.detalle_factura WHERE factura_id = $1
  `, [facturaId]);

  let totalLineasInsertadas = 0;

  // Insert Services
  for (const s of services) {
    totalLineasInsertadas++;
    await executor.query(`
      INSERT INTO admin.detalle_factura (
        factura_id,
        tipo_detalle,
        servicio_id,
        producto_id,
        descripcion,
        cantidad,
        precio_unitario,
        descuento,
        subtotal,
        fecha_registro,
        usuario_registro
      ) VALUES (
        $1, 'SERVICIO', $2, NULL, $3, $4, $5, $6, $7, NOW(), $8
      )
      RETURNING detalle_factura_id
    `, [
      facturaId,
      s.orden_servicio_id,
      s.descripcion,
      parseFloat(s.cantidad || "1"),
      parseFloat(s.precio_unitario || "0"),
      parseFloat(s.descuento || "0"),
      parseFloat(s.subtotal || "0"),
      usuarioId ?? null
    ]);
  }

  // Insert Labor
  for (const m of labor) {
    totalLineasInsertadas++;
    await executor.query(`
      INSERT INTO admin.detalle_factura (
        factura_id,
        tipo_detalle,
        servicio_id,
        producto_id,
        descripcion,
        cantidad,
        precio_unitario,
        descuento,
        subtotal,
        fecha_registro,
        usuario_registro
      ) VALUES (
        $1, 'MANO_OBRA', $2, NULL, $3, $4, $5, $6, $7, NOW(), $8
      )
      RETURNING detalle_factura_id
    `, [
      facturaId,
      m.orden_servicio_id,
      m.descripcion,
      parseFloat(m.cantidad || "1"),
      parseFloat(m.precio_unitario || "0"),
      parseFloat(m.descuento || "0"),
      parseFloat(m.subtotal || "0"),
      usuarioId ?? null
    ]);
  }

  // Insert Products
  for (const p of products) {
    totalLineasInsertadas++;
    await executor.query(`
      INSERT INTO admin.detalle_factura (
        factura_id,
        tipo_detalle,
        servicio_id,
        producto_id,
        descripcion,
        cantidad,
        precio_unitario,
        descuento,
        subtotal,
        fecha_registro,
        usuario_registro
      ) VALUES (
        $1, 'PRODUCTO', NULL, $2, $3, $4, $5, $6, $7, NOW(), $8
      )
      RETURNING detalle_factura_id
    `, [
      facturaId,
      p.producto_id,
      p.descripcion,
      parseFloat(p.cantidad || "1"),
      parseFloat(p.precio_unitario || "0"),
      parseFloat(p.descuento || "0"),
      parseFloat(p.subtotal || "0"),
      usuarioId ?? null
    ]);
  }

  // 6. Compute Invoice Totals
  const subtotalServicios = services.reduce((acc: number, s: any) => acc + parseFloat(s.subtotal || "0"), 0);
  const subtotalManoObra = labor.reduce((acc: number, m: any) => acc + parseFloat(m.subtotal || "0"), 0);
  const subtotalProductos = products.reduce((acc: number, p: any) => acc + parseFloat(p.subtotal || "0"), 0);
  const descuentoTotal = services.reduce((acc: number, s: any) => acc + parseFloat(s.descuento || "0"), 0) +
                         products.reduce((acc: number, p: any) => acc + parseFloat(p.descuento || "0"), 0);

  const subtotalFactura = parseFloat((subtotalServicios + subtotalManoObra + subtotalProductos).toFixed(2));
  const totalFactura = subtotalFactura; // Subtotals already reflect discounts

  // 7. Fetch Factual Applied Payments (admin.pagos is NEVER modified)
  const pagosRes = await executor.query(`
    SELECT COALESCE(SUM(monto_pago), 0)::numeric AS total_pagado
    FROM admin.pagos
    WHERE factura_id = $1 AND estado = 'APLICADO'
  `, [facturaId]);
  const pagosRow = pagosRes.rows ? pagosRes.rows[0] : (Array.isArray(pagosRes) ? pagosRes[0] : pagosRes);
  const montoPagadoFactual = parseFloat(pagosRow?.total_pagado || "0");

  const balancePendiente = Math.max(0, parseFloat((totalFactura - montoPagadoFactual).toFixed(2)));
  const sobrepago = montoPagadoFactual > totalFactura ? parseFloat((montoPagadoFactual - totalFactura).toFixed(2)) : 0;

  // Determine invoice status within CHECK constraint ('PENDIENTE', 'EMITIDA', 'PAGADA', 'ANULADA')
  let nuevoEstado = invoice.estado || "PENDIENTE";
  if (totalFactura <= 0) {
    nuevoEstado = montoPagadoFactual > 0 ? "PAGADA" : "PENDIENTE";
  } else if (montoPagadoFactual >= totalFactura) {
    nuevoEstado = "PAGADA";
  } else if (montoPagadoFactual > 0) {
    nuevoEstado = "EMITIDA";
  } else {
    // montoPagado === 0
    nuevoEstado = (invoice.estado === "EMITIDA" || invoice.estado === "PAGADA") ? "EMITIDA" : "PENDIENTE";
  }

  // 8. Update admin.facturas
  await executor.query(`
    UPDATE admin.facturas
    SET
      subtotal = $1,
      descuento_total = $2,
      impuesto_total = 0.00,
      total_factura = $3,
      monto_pagado = $4,
      balance_pendiente = $5,
      estado = $6,
      fecha_actualizacion = NOW(),
      usuario_actualizacion = $7
    WHERE factura_id = $8
  `, [
    subtotalFactura,
    descuentoTotal,
    totalFactura,
    montoPagadoFactual,
    balancePendiente,
    nuevoEstado,
    usuarioId ?? null,
    facturaId
  ]);

  return {
    synchronized: true,
    factura_id: facturaId,
    numero_factura: invoice.numero_factura,
    total_anterior: totalAnterior,
    total_nuevo: totalFactura,
    subtotal: subtotalFactura,
    descuento_total: descuentoTotal,
    impuesto_total: 0,
    monto_pagado: montoPagadoFactual,
    balance_pendiente: balancePendiente,
    sobrepago,
    estado: nuevoEstado,
    lineas_detalle_count: totalLineasInsertadas
  };
}
