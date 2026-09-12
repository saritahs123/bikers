import { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import { recordUserAudit, recordUserActivity } from "@/lib/auditLogger";

export interface ActorInfo {
  usuario_id: number;
  nombre: string;
  correo?: string;
  empresa_id?: number;
}

export interface DeleteWorkOrderResult {
  success: boolean;
  historial_uuid?: string;
  codigo_orden?: string;
  codigo_recepcion?: string;
  error?: string;
  message?: string;
  status?: number;
}

/**
 * Strips any sensitive fields (passwords, tokens, credentials, secrets) from an object.
 */
function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("password") ||
      lower.includes("hash") ||
      lower.includes("token") ||
      lower.includes("secret") ||
      lower.includes("jwt") ||
      lower.includes("cookie") ||
      lower.includes("auth") ||
      lower.includes("credential")
    ) {
      continue;
    }
    clean[key] = typeof val === "object" ? sanitizeObject(val) : val;
  }
  return clean;
}

/**
 * Builds the full historical snapshot of a work order and its related operational entities.
 */
async function buildWorkOrderSnapshot(
  client: PoolClient,
  ordenTrabajoId: number,
  actor: ActorInfo,
  motivo: string
) {
  // 1. Fetch Order and basic denormalized joins FOR UPDATE
  const orderRes = await client.query(`
    SELECT
      ot.*,
      eot.nombre AS estado_orden_nombre,
      eot.codigo AS estado_orden_codigo,
      pot.nombre AS prioridad_orden_nombre,
      pot.codigo AS prioridad_orden_codigo,
      c.cliente_id AS cl_id,
      c.empresa_id AS cl_empresa_id,
      c.nombre_completo AS cl_nombre,
      c.identificacion AS cl_identificacion,
      c.telefono_principal AS cl_telefono,
      c.correo AS cl_correo,
      b.bicicleta_id AS bic_id,
      b.marca AS bic_marca,
      b.modelo AS bic_modelo,
      b.ano AS bic_ano,
      b.color AS bic_color,
      b.numero_serie_cuadro AS bic_serie,
      COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), ui.correo_electronico, ('Mecánico #' || u.usuario_id::text)) AS mecanico_nombre_display,
      r.codigo_recepcion AS r_codigo_recepcion
    FROM admin.ordenes_trabajo ot
    JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
    LEFT JOIN admin.bicicletas b ON ot.bicicleta_id = b.bicicleta_id
    LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
    LEFT JOIN admin.prioridad_orden_trabajo pot ON ot.prioridad_orden_id = pot.prioridad_orden_trabajo_id
    LEFT JOIN admin.usuario u ON ot.mecanico_id = u.usuario_id
    LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
    LEFT JOIN admin.recepciones r ON ot.recepcion_id = r.recepcion_id
    WHERE ot.orden_trabajo_id = $1
    FOR UPDATE OF ot
  `, [ordenTrabajoId]);

  if (orderRes.rows.length === 0) {
    return null;
  }

  const ot = orderRes.rows[0];
  const recepcionId = ot.recepcion_id || null;

  // 2. Fetch Reception (if exists)
  let datosRecepcion: any = null;
  if (recepcionId) {
    const recRes = await client.query(`
      SELECT r.*, er.nombre AS estado_recepcion_nombre, er.codigo AS estado_recepcion_codigo
      FROM admin.recepciones r
      LEFT JOIN admin.estado_recepcion er ON r.estado_recepcion_id = er.estado_recepcion_id
      WHERE r.recepcion_id = $1
      FOR UPDATE OF r
    `, [recepcionId]);
    if (recRes.rows.length > 0) {
      datosRecepcion = sanitizeObject(recRes.rows[0]);
    }
  }

  // 3. Fetch Reception Checklist & Evidences
  let datosChecklist: any[] = [];
  let datosEvidencias: any[] = [];
  if (recepcionId) {
    const chkRes = await client.query(`
      SELECT rc.*, icr.nombre AS item_nombre, ec.nombre AS estado_checklist_nombre
      FROM admin.recepcion_checklist rc
      LEFT JOIN admin.item_checklist_recepcion icr ON rc.item_checklist_id = icr.item_checklist_id
      LEFT JOIN admin.estado_checklist ec ON rc.estado_checklist_id = ec.estado_checklist_id
      WHERE rc.recepcion_id = $1
      ORDER BY rc.orden_visual ASC, rc.recepcion_checklist_id ASC
    `, [recepcionId]);
    datosChecklist = chkRes.rows.map(sanitizeObject);

    // Extract evidence metadata (excluding signed temporary URLs)
    datosEvidencias = chkRes.rows
      .filter(r => r.evidencia_foto || r.ruta_archivo || r.url_archivo)
      .map(r => ({
        recepcion_checklist_id: r.recepcion_checklist_id,
        item_checklist_id: r.item_checklist_id,
        nombre_archivo: r.nombre_archivo,
        ruta_archivo: r.ruta_archivo,
        url_archivo: r.url_archivo,
        descripcion_foto: r.descripcion_foto,
        fecha_evaluacion: r.fecha_evaluacion
      }));
  }

  // 4. Fetch Reception Signature
  let datosFirma: any = null;
  if (recepcionId) {
    const sigRes = await client.query(`
      SELECT fr.*
      FROM admin.firma_recepcion fr
      WHERE fr.recepcion_id = $1
    `, [recepcionId]);
    if (sigRes.rows.length > 0) {
      datosFirma = sanitizeObject(sigRes.rows[0]);
    }
  }

  // 5. Fetch Services
  const srvRes = await client.query(`
    SELECT
      os.*,
      ts.nombre AS tipo_servicio_nombre,
      ts.codigo AS tipo_servicio_codigo,
      eos.nombre AS estado_servicio_nombre,
      eos.codigo AS estado_servicio_codigo
    FROM admin.orden_servicios os
    LEFT JOIN admin.tipo_servicio ts ON os.tipo_servicio_id = ts.tipo_servicio_id
    LEFT JOIN admin.estado_orden_servicio eos ON os.estado_orden_servicio_id = eos.estado_orden_servicio_id
    WHERE os.orden_trabajo_id = $1
    ORDER BY os.secuencia ASC, os.orden_servicio_id ASC
  `, [ordenTrabajoId]);
  const datosServicios = srvRes.rows.map(sanitizeObject);
  const serviceIds = srvRes.rows.map(s => s.orden_servicio_id);

  // 6. Fetch Labor (Mano de Obra)
  let datosManoObra: any[] = [];
  if (serviceIds.length > 0) {
    const moRes = await client.query(`
      SELECT
        mo.*,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), ui.correo_electronico, ('Usuario #' || u.usuario_id::text)) AS usuario_nombre
      FROM admin.orden_servicio_mano_obra mo
      LEFT JOIN admin.usuario u ON mo.usuario_id = u.usuario_id
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      WHERE mo.orden_servicio_id = ANY($1::integer[])
      ORDER BY mo.orden_servicio_mano_obra_id ASC
    `, [serviceIds]);
    datosManoObra = moRes.rows.map(sanitizeObject);
  }

  // 7. Fetch Order Products (Repuestos / Materiales)
  const prodRes = await client.query(`
    SELECT
      op.*,
      p.nombre AS producto_nombre,
      p.codigo_producto AS producto_codigo,
      p.codigo_barra AS producto_codigo_barra
    FROM admin.orden_productos op
    LEFT JOIN admin.productos p ON op.producto_id = p.producto_id
    WHERE op.orden_trabajo_id = $1
    ORDER BY op.orden_producto_id ASC
  `, [ordenTrabajoId]);
  const datosProductos = prodRes.rows.map(sanitizeObject);

  // 8. Fetch Order State History
  const histRes = await client.query(`
    SELECT
      h.*,
      ea.nombre AS estado_anterior_nombre,
      ea.codigo AS estado_anterior_codigo,
      en.nombre AS estado_nuevo_nombre,
      en.codigo AS estado_nuevo_codigo,
      COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), ui.correo_electronico, ('Usuario #' || u.usuario_id::text)) AS usuario_nombre
    FROM admin.orden_historial_estado h
    LEFT JOIN admin.estado_orden_trabajo ea ON h.estado_anterior_id = ea.estado_orden_id
    LEFT JOIN admin.estado_orden_trabajo en ON h.estado_nuevo_id = en.estado_orden_id
    LEFT JOIN admin.usuario u ON h.usuario_cambio = u.usuario_id
    LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
    WHERE h.orden_trabajo_id = $1
    ORDER BY h.fecha_cambio ASC, h.orden_historial_estado_id ASC
  `, [ordenTrabajoId]);
  const datosHistorialEstados = histRes.rows.map(sanitizeObject);

  // 9. Fetch Invoices & Invoice Details
  const factRes = await client.query(`
    SELECT f.*, tf.nombre AS tipo_factura_nombre
    FROM admin.facturas f
    LEFT JOIN admin.tipo_factura tf ON f.tipo_factura_id = tf.tipo_factura_id
    WHERE f.orden_trabajo_id = $1
    ORDER BY f.factura_id ASC
  `, [ordenTrabajoId]);

  const facturaIds = factRes.rows.map(f => f.factura_id);
  let datosFacturacion: any[] = [];
  let datosPagos: any[] = [];

  if (facturaIds.length > 0) {
    const detRes = await client.query(`
      SELECT df.*
      FROM admin.detalle_factura df
      WHERE df.factura_id = ANY($1::integer[])
      ORDER BY df.detalle_factura_id ASC
    `, [facturaIds]);

    const pagosRes = await client.query(`
      SELECT p.*, tp.nombre AS tipo_pago_nombre
      FROM admin.pagos p
      LEFT JOIN admin.tipo_pago tp ON p.tipo_pago_id = tp.tipo_pago_id
      WHERE p.factura_id = ANY($1::integer[])
      ORDER BY p.pago_id ASC
    `, [facturaIds]);

    const detByFactura = new Map<number, any[]>();
    detRes.rows.forEach(d => {
      const arr = detByFactura.get(d.factura_id) || [];
      arr.push(sanitizeObject(d));
      detByFactura.set(d.factura_id, arr);
    });

    datosFacturacion = factRes.rows.map(f => {
      const cleanF = sanitizeObject(f);
      cleanF.detalles = detByFactura.get(f.factura_id) || [];
      return cleanF;
    });

    datosPagos = pagosRes.rows.map(sanitizeObject);
  }

  // Build full bicycle description
  const bicDesc = [
    ot.bic_marca,
    ot.bic_modelo,
    ot.bic_ano ? `(${ot.bic_ano})` : null,
    ot.bic_color ? `- ${ot.bic_color}` : null,
    ot.bic_serie ? `[Serie: ${ot.bic_serie}]` : null
  ].filter(Boolean).join(" ");

  const cleanOrder = sanitizeObject(ot);

  return {
    rawOrder: ot,
    recepcionId,
    snapshotRow: {
      orden_trabajo_id: ot.orden_trabajo_id,
      codigo_orden: ot.codigo_orden,
      recepcion_id: recepcionId,
      codigo_recepcion: ot.r_codigo_recepcion || (datosRecepcion ? datosRecepcion.codigo_recepcion : null),
      empresa_id: ot.cl_empresa_id || actor.empresa_id || null,

      cliente_id: ot.cl_id,
      cliente_nombre: ot.cl_nombre || null,
      cliente_identificacion: ot.cl_identificacion || null,
      cliente_telefono: ot.cl_telefono || null,
      cliente_correo: ot.cl_correo || null,

      bicicleta_id: ot.bic_id || null,
      bicicleta_descripcion: bicDesc || null,

      estado_orden_id: ot.estado_orden_id,
      estado_orden_codigo: ot.estado_orden_codigo || null,
      estado_orden_nombre: ot.estado_orden_nombre || null,

      prioridad_orden_id: ot.prioridad_orden_id,
      prioridad_codigo: ot.prioridad_orden_codigo || null,
      prioridad_nombre: ot.prioridad_orden_nombre || null,

      mecanico_id: ot.mecanico_id || null,
      mecanico_nombre: ot.mecanico_nombre_display || null,

      diagnostico: ot.diagnostico_inicial || null,
      observaciones: ot.observacion_interna || ot.descripcion_cliente || null,

      fecha_registro: ot.fecha_registro || null,
      fecha_inicio: ot.fecha_inicio_trabajo || null,
      fecha_finalizacion: ot.fecha_finalizacion || null,
      fecha_entrega_estimada: ot.fecha_entrega_estimada || null,
      fecha_entrega_real: ot.fecha_entrega_real || null,

      facturado: Boolean(ot.facturado),

      subtotal: ot.subtotal_general != null ? Number(ot.subtotal_general) : null,
      impuestos: ot.impuesto != null ? Number(ot.impuesto) : null,
      descuento: (Number(ot.descuento_servicios || 0) + Number(ot.descuento_productos || 0)),
      total: ot.total_orden != null ? Number(ot.total_orden) : null,

      datos_orden: cleanOrder,
      datos_recepcion: datosRecepcion,
      datos_servicios: datosServicios,
      datos_mano_obra: datosManoObra,
      datos_productos: datosProductos,
      datos_historial_estados: datosHistorialEstados,
      datos_checklist: datosChecklist,
      datos_firma: datosFirma,
      datos_evidencias: datosEvidencias,
      datos_facturacion: datosFacturacion,
      datos_pagos: datosPagos,

      eliminado_por_usuario_id: actor.usuario_id,
      eliminado_por_nombre: actor.nombre,
      motivo_eliminacion: motivo.trim(),
      origen: "RIDE_LAB"
    },
    evidenciasParaS3: datosEvidencias
  };
}

/**
 * Executes atomic deletion of a work order with mandatory pre-deletion snapshot.
 */
export async function deleteWorkOrderWithSnapshot(
  ordenTrabajoId: number,
  actor: ActorInfo,
  motivo: string,
  req?: Request
): Promise<DeleteWorkOrderResult> {
  const trimmedMotivo = (motivo || "").trim();
  if (!trimmedMotivo || trimmedMotivo.length < 5) {
    return {
      success: false,
      error: "INVALID_REASON",
      message: "El motivo de eliminación es obligatorio y debe contener al menos 5 caracteres.",
      status: 400
    };
  }

  if (trimmedMotivo.length > 1000) {
    return {
      success: false,
      error: "REASON_TOO_LONG",
      message: "El motivo de eliminación no puede exceder 1000 caracteres.",
      status: 400
    };
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Build and capture full pre-deletion snapshot (FOR UPDATE locked)
    const snapshotData = await buildWorkOrderSnapshot(client, ordenTrabajoId, actor, trimmedMotivo);
    if (!snapshotData) {
      await client.query("ROLLBACK");
      return {
        success: false,
        error: "NOT_FOUND",
        message: "La orden de trabajo no existe o ya fue eliminada.",
        status: 404
      };
    }

    const { recepcionId, snapshotRow, evidenciasParaS3 } = snapshotData;

    // Tenant check: ensure the order belongs to the user's company
    if (
      actor.empresa_id != null &&
      snapshotRow.empresa_id != null &&
      Number(actor.empresa_id) !== Number(snapshotRow.empresa_id)
    ) {
      await client.query("ROLLBACK");
      return {
        success: false,
        error: "NOT_FOUND",
        message: "La orden de trabajo no existe o no pertenece a su empresa.",
        status: 404
      };
    }

    // 2. CRITICAL STEP: INSERT INTO HISTORICAL EVIDENCE TABLE BEFORE ANY DELETE
    const insertHistSql = `
      INSERT INTO admin.orden_trabajo_eliminada_historial (
        orden_trabajo_id,
        codigo_orden,
        recepcion_id,
        codigo_recepcion,
        empresa_id,
        cliente_id,
        cliente_nombre,
        cliente_identificacion,
        cliente_telefono,
        cliente_correo,
        bicicleta_id,
        bicicleta_descripcion,
        estado_orden_id,
        estado_orden_codigo,
        estado_orden_nombre,
        prioridad_orden_id,
        prioridad_codigo,
        prioridad_nombre,
        mecanico_id,
        mecanico_nombre,
        diagnostico,
        observaciones,
        fecha_registro,
        fecha_inicio,
        fecha_finalizacion,
        fecha_entrega_estimada,
        fecha_entrega_real,
        facturado,
        subtotal,
        impuestos,
        descuento,
        total,
        datos_orden,
        datos_recepcion,
        datos_servicios,
        datos_mano_obra,
        datos_productos,
        datos_historial_estados,
        datos_checklist,
        datos_firma,
        datos_evidencias,
        datos_facturacion,
        datos_pagos,
        eliminado_por_usuario_id,
        eliminado_por_nombre,
        motivo_eliminacion,
        fecha_eliminacion,
        origen
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
        $41, $42, $43, $44, $45, $46, NOW(), $47
      ) RETURNING historial_uuid
    `;

    const histParams = [
      snapshotRow.orden_trabajo_id,
      snapshotRow.codigo_orden,
      snapshotRow.recepcion_id,
      snapshotRow.codigo_recepcion,
      snapshotRow.empresa_id,
      snapshotRow.cliente_id,
      snapshotRow.cliente_nombre,
      snapshotRow.cliente_identificacion,
      snapshotRow.cliente_telefono,
      snapshotRow.cliente_correo,
      snapshotRow.bicicleta_id,
      snapshotRow.bicicleta_descripcion,
      snapshotRow.estado_orden_id,
      snapshotRow.estado_orden_codigo,
      snapshotRow.estado_orden_nombre,
      snapshotRow.prioridad_orden_id,
      snapshotRow.prioridad_codigo,
      snapshotRow.prioridad_nombre,
      snapshotRow.mecanico_id,
      snapshotRow.mecanico_nombre,
      snapshotRow.diagnostico,
      snapshotRow.observaciones,
      snapshotRow.fecha_registro,
      snapshotRow.fecha_inicio,
      snapshotRow.fecha_finalizacion,
      snapshotRow.fecha_entrega_estimada,
      snapshotRow.fecha_entrega_real,
      snapshotRow.facturado,
      snapshotRow.subtotal,
      snapshotRow.impuestos,
      snapshotRow.descuento,
      snapshotRow.total,
      JSON.stringify(snapshotRow.datos_orden),
      snapshotRow.datos_recepcion ? JSON.stringify(snapshotRow.datos_recepcion) : null,
      JSON.stringify(snapshotRow.datos_servicios),
      JSON.stringify(snapshotRow.datos_mano_obra),
      JSON.stringify(snapshotRow.datos_productos),
      JSON.stringify(snapshotRow.datos_historial_estados),
      JSON.stringify(snapshotRow.datos_checklist),
      snapshotRow.datos_firma ? JSON.stringify(snapshotRow.datos_firma) : null,
      JSON.stringify(snapshotRow.datos_evidencias),
      JSON.stringify(snapshotRow.datos_facturacion),
      JSON.stringify(snapshotRow.datos_pagos),
      snapshotRow.eliminado_por_usuario_id,
      snapshotRow.eliminado_por_nombre,
      snapshotRow.motivo_eliminacion,
      snapshotRow.origen
    ];

    const histInsertRes = await client.query(insertHistSql, histParams);
    if (histInsertRes.rowCount !== 1) {
      await client.query("ROLLBACK");
      return {
        success: false,
        error: "HISTORY_SNAPSHOT_FAILED",
        message: "No fue posible registrar la evidencia histórica de la orden. La eliminación fue abortada.",
        status: 500
      };
    }

    const historialUuid = histInsertRes.rows[0]?.historial_uuid;

    // 3. Enqueue evidence photos into durable s3_cleanup_queue
    const empresaIdForQueue = snapshotRow.empresa_id || actor.empresa_id || 1;
    for (const ev of evidenciasParaS3) {
      const keyToClean = ev.ruta_archivo || ev.nombre_archivo;
      if (keyToClean && typeof keyToClean === "string" && keyToClean.trim()) {
        await client.query(`
          INSERT INTO admin.s3_cleanup_queue (
            empresa_id,
            object_key,
            modulo,
            entidad,
            entidad_id,
            estado,
            intentos,
            fecha_creacion,
            usuario_creacion
          ) VALUES ($1, $2, 'TALLER', 'RECEPCION_CHECKLIST', $3, 'PENDIENTE', 0, NOW(), $4)
        `, [empresaIdForQueue, keyToClean.trim(), ev.recepcion_checklist_id || null, actor.usuario_id]);
      }
    }

    // 4. Break Circular FK: recepciones.convertido_orden_id -> ordenes_trabajo.orden_trabajo_id
    if (recepcionId) {
      await client.query(`
        UPDATE admin.recepciones
        SET convertido_orden_id = NULL
        WHERE recepcion_id = $1 OR convertido_orden_id = $2
      `, [recepcionId, ordenTrabajoId]);
    }

    // 5. Delete Billing dependencies exclusively belonging to this Work Order
    await client.query(`
      DELETE FROM admin.pagos
      WHERE factura_id IN (
        SELECT factura_id FROM admin.facturas WHERE orden_trabajo_id = $1
      )
    `, [ordenTrabajoId]);

    await client.query(`
      DELETE FROM admin.detalle_factura
      WHERE factura_id IN (
        SELECT factura_id FROM admin.facturas WHERE orden_trabajo_id = $1
      )
    `, [ordenTrabajoId]);

    await client.query(`
      DELETE FROM admin.facturas
      WHERE orden_trabajo_id = $1
    `, [ordenTrabajoId]);

    // 5.5. Release inventory reservations for unconsumed products in deterministic order
    const unconsumedLinesRes = await client.query(`
      SELECT
        op.producto_id,
        op.almacen_id,
        SUM(op.cantidad)::numeric AS total_a_liberar
      FROM admin.orden_productos op
      WHERE (op.orden_trabajo_id = $1 OR op.orden_servicio_id IN (
        SELECT orden_servicio_id FROM admin.orden_servicios WHERE orden_trabajo_id = $1
      ))
        AND op.utilizado = false
        AND op.almacen_id IS NOT NULL
      GROUP BY op.producto_id, op.almacen_id
      ORDER BY op.producto_id ASC, op.almacen_id ASC
    `, [ordenTrabajoId]);

    const targetEmpresaId = snapshotRow.empresa_id || actor.empresa_id;
    const existencesToRelease: { existencia_producto_id: number; total_a_liberar: number }[] = [];

    // Deterministically lock and validate ALL reservations before applying any change
    for (const group of unconsumedLinesRes.rows) {
      const prodId = parseInt(group.producto_id, 10);
      const almId = parseInt(group.almacen_id, 10);
      const qtyToRelease = parseFloat(group.total_a_liberar || "0");

      if (qtyToRelease <= 0) continue;

      const exRes = await client.query(`
        SELECT existencia_producto_id, cantidad_actual, cantidad_reservada
        FROM admin.existencias_producto
        WHERE empresa_id = $1 AND producto_id = $2 AND almacen_id = $3
        FOR UPDATE
      `, [targetEmpresaId, prodId, almId]);

      if (exRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return {
          success: false,
          error: "INCONSISTENCIA_STOCK_RESERVADO",
          message: `Inconsistencia de inventario al eliminar orden: no existe existencia registrada para producto #${prodId} en almacén #${almId}.`,
          status: 409
        };
      }

      const ex = exRes.rows[0];
      const stockActual = parseFloat(ex.cantidad_actual || "0");
      const cantidadReservada = parseFloat(ex.cantidad_reservada || "0");

      if (cantidadReservada < qtyToRelease || cantidadReservada > stockActual || cantidadReservada < 0) {
        await client.query("ROLLBACK");
        return {
          success: false,
          error: "INCONSISTENCIA_STOCK_RESERVADO",
          message: `Inconsistencia de inventario al eliminar orden: el producto #${prodId} en almacén #${almId} tiene reservado ${cantidadReservada} pero se intenta liberar ${qtyToRelease}.`,
          status: 409
        };
      }

      existencesToRelease.push({
        existencia_producto_id: ex.existencia_producto_id,
        total_a_liberar: qtyToRelease
      });
    }

    // Only if ALL reservations are consistent, execute release without GREATEST
    for (const item of existencesToRelease) {
      await client.query(`
        UPDATE admin.existencias_producto
        SET cantidad_reservada = cantidad_reservada - $1,
            fecha_actualizacion = CURRENT_TIMESTAMP,
            usuario_actualizacion = $2
        WHERE existencia_producto_id = $3
      `, [item.total_a_liberar, actor.usuario_id, item.existencia_producto_id]);
    }

    // 6. Delete Workshop child dependencies
    await client.query(`
      DELETE FROM admin.orden_servicio_mano_obra
      WHERE orden_servicio_id IN (
        SELECT orden_servicio_id FROM admin.orden_servicios WHERE orden_trabajo_id = $1
      )
    `, [ordenTrabajoId]);

    await client.query(`
      DELETE FROM admin.orden_productos
      WHERE orden_trabajo_id = $1
         OR orden_servicio_id IN (
           SELECT orden_servicio_id FROM admin.orden_servicios WHERE orden_trabajo_id = $1
         )
    `, [ordenTrabajoId]);

    await client.query(`
      DELETE FROM admin.orden_servicios
      WHERE orden_trabajo_id = $1
    `, [ordenTrabajoId]);

    await client.query(`
      DELETE FROM admin.orden_historial_estado
      WHERE orden_trabajo_id = $1
    `, [ordenTrabajoId]);

    // 7. Delete Work Order Operational Record
    const delOtRes = await client.query(`
      DELETE FROM admin.ordenes_trabajo
      WHERE orden_trabajo_id = $1
    `, [ordenTrabajoId]);

    if (delOtRes.rowCount !== 1) {
      await client.query("ROLLBACK");
      return {
        success: false,
        error: "WORK_ORDER_DELETE_FAILED",
        message: "No fue posible eliminar el registro principal de la orden de trabajo.",
        status: 500
      };
    }

    // 8. Delete Associated Reception and its exclusive dependencies (if exists)
    if (recepcionId) {
      await client.query(`
        DELETE FROM admin.firma_recepcion
        WHERE recepcion_id = $1
      `, [recepcionId]);

      await client.query(`
        DELETE FROM admin.recepcion_checklist
        WHERE recepcion_id = $1
      `, [recepcionId]);

      await client.query(`
        DELETE FROM admin.recepciones
        WHERE recepcion_id = $1
      `, [recepcionId]);
    }

    // 9. Record Global Audit Log
    await recordUserAudit({
      userId: actor.usuario_id,
      accion: "ELIMINAR_ORDEN_TRABAJO",
      valorAnterior: {
        orden_trabajo_id: ordenTrabajoId,
        codigo_orden: snapshotRow.codigo_orden,
        recepcion_id: recepcionId,
        codigo_recepcion: snapshotRow.codigo_recepcion,
        estado: snapshotRow.estado_orden_nombre,
        total: snapshotRow.total
      },
      valorNuevo: {
        historial_uuid: historialUuid,
        motivo: trimmedMotivo,
        eliminado: true
      },
      motivo: trimmedMotivo,
      resultado: "COMPLETADO",
      client,
      throwOnError: true
    });

    // 10. Atomic COMMIT
    await client.query("COMMIT");

    // 11. Record Global User Activity (outside transaction, non-blocking)
    if (req) {
      await recordUserActivity({
        userId: actor.usuario_id,
        modulo: "TALLER_ORDENES",
        evento: "WORK_ORDER_DELETED",
        descripcion: `Orden de trabajo ${snapshotRow.codigo_orden} (#${ordenTrabajoId}) eliminada permanentemente. Motivo: ${trimmedMotivo}. Evidencia histórica: ${historialUuid}`,
        resultado: "Exitoso",
        req
      }).catch(err => console.error("Error logging WORK_ORDER_DELETED activity:", err));
    }

    return {
      success: true,
      historial_uuid: historialUuid,
      codigo_orden: snapshotRow.codigo_orden,
      codigo_recepcion: snapshotRow.codigo_recepcion,
      message: "Orden de trabajo eliminada correctamente."
    };

  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("deleteWorkOrderWithSnapshot Exception:", err);
    return {
      success: false,
      error: "SERVER_ERROR",
      message: "Error interno al procesar la eliminación de la orden de trabajo.",
      status: 500
    };
  } finally {
    client.release();
  }
}
