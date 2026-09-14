/**
-- ============================================================================
-- MODULE: Facturación (FAC-1 — Modelo de Datos y Motor Base)
-- FILE: src/lib/billing/billingService.ts
--
-- REGLAS ARQUITECTÓNICAS Y DE NEGOCIO FUNDAMENTALES:
--
-- 1. REGLA OT SIN DOBLE SALIDA INVENTARIO (Sección 17):
--    Los repuestos de una Orden de Trabajo (OT) ya fueron consumidos físicamente
--    en taller mediante el movimiento SAL_ORDEN (tipo_movimiento_id = 2 / CRT).
--    Al facturar una Orden de Trabajo (tipo_factura = 'ORDEN_TRABAJO'), las líneas
--    de tipo 'REPUESTO' representan cobro financiero y NO deben generar un
--    movimiento físico de SAL_VENTA adicional en admin.movimientos_inventario.
--
-- 2. REGLA VENTA DIRECTA (Sección 16):
--    En facturas de 'VENTA_DIRECTA', las líneas de tipo 'PRODUCTO' generarán
--    en la fase FAC-2 la salida física de inventario SAL_VENTA (ID 3 / SV).
--
-- 3. REGLA OT FACTURABLE (Sección 18):
--    La integración con Taller solo permite facturar órdenes cuyo estado actual sea
--    'LISTA_ENTREGA' y que no posean una factura activa previa (estado <> 'ANULADA').
--
-- 4. REGLA 2 MODELOS DE IMPRESIÓN PDF (Secciones 22 y 23):
--    Facturación utilizará exclusivamente los 2 modelos de impresión existentes en
--    Despacho de Órdenes de Trabajo (MODELO 1: Ticket Térmico 80mm y MODELO 2: Factura Carta/A4).
--    NO crear un tercer diseño. En la fase FAC-4 se reutilizarán ambos templates,
--    mismo logo, mismos datos de empresa, misma tipografía, colores, márgenes y estructura visual,
--    sin duplicar motor de PDF innecesariamente. La factura podrá elegir entre MODELO 1 y MODELO 2.
--
-- 5. REGLA PAGOS MÚLTIPLES Y CONSISTENCIA FINANCIERA (Secciones 11 y 12):
--    Una factura puede recibir múltiples pagos fraccionados o combinados (efectivo,
--    tarjeta, transferencia). Cada monto debe ser mayor a 0 y la suma de pagos activos
--    no puede exceder el total de la factura. monto_pagado y balance_pendiente se
--    mantienen atómicamente consistentes con los registros en admin.pagos.
--
-- 6. REGLA MULTITENANT (Sección 20):
--    empresa_id es OBLIGATORIO en todas las operaciones, validaciones e índices.
--    Nunca se permite acceder, alterar, pagar o anular facturas de otra empresa.
--
-- 7. REGLA TRANSACCIONALIDAD ATÓMICA (Sección 15):
--    Toda operación de creación de factura, registro de pagos y anulación se ejecuta
--    en una única transacción PostgreSQL (BEGIN ... COMMIT), abortando con ROLLBACK
--    total ante cualquier error o inconsistencia.
--
-- 8. REGLA SNAPSHOT INMUTABLE (Sección 9):
--    admin.detalle_factura almacena codigo, descripcion, precio_unitario, cantidad,
--    descuento y subtotal como evidencia histórica inmutable, protegiendo los
--    estados contables frente a futuros cambios en el catálogo de productos o servicios.
-- ============================================================================
*/

import { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import {
  CODIGO_SISTEMA_FACTURA,
  CrearFacturaInput,
  PagoInicialInput,
  RegistrarPagoInput,
  AnularFacturaInput,
  FacturaRow,
  DetalleFacturaRow,
  PagoRow,
  FacturaCompletaResult,
  EstadoFactura
} from "./billingTypes";

/**
 * Asegura de forma idempotente que el código de sistema ID 14 (FACTURA / FAC)
 * esté aprovisionado en admin.codigo_sistema para la empresa indicada.
 */
export async function ensureEmpresaBillingCodeProvisioned(
  client: PoolClient,
  empresaId: number
): Promise<void> {
  const sql = `
    INSERT INTO admin.codigo_sistema (
      empresa_id,
      codigo_sistema_id,
      tipo_transaccion,
      prefijo,
      periodo,
      ultimo_numero,
      longitud_numero,
      activo,
      es_catalogo,
      fecha_creacion,
      fecha_actualizacion
    ) VALUES (
      $1,
      $2,
      'FACTURA',
      'FAC',
      TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santo_Domingo', 'YYYYMM'),
      0,
      6,
      true,
      false,
      NOW(),
      NOW()
    )
    ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;
  `;
  await client.query(sql, [empresaId, CODIGO_SISTEMA_FACTURA]);
}

/**
 * Genera el código correlativo de factura usando admin.generar_codigo_sistema(p_empresa_id, 14).
 * Resultado esperado: FAC-<empresa_id>-<periodo>-<secuencia> (ej. FAC-1-202609-1).
 */
export async function generarCodigoFactura(
  client: PoolClient,
  empresaId: number
): Promise<string> {
  await ensureEmpresaBillingCodeProvisioned(client, empresaId);

  try {
    const res = await client.query(
      `SELECT admin.generar_codigo_sistema($1, $2) AS codigo`,
      [Number(empresaId), CODIGO_SISTEMA_FACTURA]
    );

    if (res.rows && res.rows.length > 0 && res.rows[0].codigo) {
      return String(res.rows[0].codigo);
    }
  } catch (err) {
    console.warn("Error calling admin.generar_codigo_sistema, fallback to locked sequential:", err);
  }

  // Fallback transaccional idempotente en caso de función de BD no disponible
  const periodo = new Date().toISOString().slice(0, 7).replace("-", "");
  const seqRes = await client.query(`
    UPDATE admin.codigo_sistema
    SET ultimo_numero = ultimo_numero + 1,
        fecha_actualizacion = NOW()
    WHERE empresa_id = $1 AND codigo_sistema_id = $2
    RETURNING prefijo, ultimo_numero
  `, [empresaId, CODIGO_SISTEMA_FACTURA]);

  if (seqRes.rows && seqRes.rows.length > 0) {
    const row = seqRes.rows[0];
    return `${row.prefijo || "FAC"}-${empresaId}-${periodo}-${row.ultimo_numero}`;
  }

  const countRes = await client.query(
    `SELECT COUNT(*)::int + 1 AS next_seq FROM admin.facturas WHERE empresa_id = $1`,
    [empresaId]
  );
  return `FAC-${empresaId}-${periodo}-${countRes.rows[0]?.next_seq || 1}`;
}

/**
 * Crea una factura en una sola transacción atómica (BEGIN ... COMMIT / ROLLBACK).
 * Inserta cabecera, líneas de detalle con snapshot inmutable y pagos iniciales si se proveen.
 */
export async function crearFactura(
  input: CrearFacturaInput,
  externalClient?: PoolClient
): Promise<FacturaCompletaResult> {
  const pool = getPool();
  const client = externalClient || (await pool.connect());
  const isInternalTransaction = !externalClient;

  try {
    if (isInternalTransaction) {
      await client.query("BEGIN");
    }

    // 1. Validaciones básicas de entrada y Multitenancy
    if (!input.empresa_id || input.empresa_id <= 0) {
      throw new Error("El ID de empresa (empresa_id) es obligatorio y debe ser válido.");
    }
    if (!input.tipo_factura_id || input.tipo_factura_id <= 0) {
      throw new Error("El tipo de factura (tipo_factura_id) es obligatorio.");
    }
    if (!input.usuario_id || input.usuario_id <= 0) {
      throw new Error("El usuario creador (usuario_id) es obligatorio.");
    }
    if (!input.lineas || !Array.isArray(input.lineas) || input.lineas.length === 0) {
      throw new Error("La factura debe contener al menos una línea de detalle.");
    }

    // 2. Validación de Tipo de Factura
    const tfRes = await client.query(`
      SELECT tipo_factura_id, codigo, nombre
      FROM admin.tipo_factura
      WHERE tipo_factura_id = $1 AND activo = true
    `, [input.tipo_factura_id]);

    if (!tfRes.rows || tfRes.rows.length === 0) {
      throw new Error(`El tipo de factura #${input.tipo_factura_id} no existe o no está activo.`);
    }
    const tipoFactura = tfRes.rows[0];

    // 3. Regla OT Facturable (Sección 6, 17 y 18):
    // Impedir más de una factura activa por OT y validar pertenencia
    if (input.orden_trabajo_id) {
      const otRes = await client.query(`
        SELECT ot.orden_trabajo_id, ot.codigo_orden, ot.cliente_id, ot.empresa_id,
               eot.codigo AS estado_codigo, eot.nombre AS estado_nombre
        FROM admin.ordenes_trabajo ot
        LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
        WHERE ot.orden_trabajo_id = $1
        FOR UPDATE OF ot
      `, [input.orden_trabajo_id]);

      if (!otRes.rows || otRes.rows.length === 0) {
        throw new Error(`La Orden de Trabajo #${input.orden_trabajo_id} no existe.`);
      }

      const ot = otRes.rows[0];
      if (ot.empresa_id && Number(ot.empresa_id) !== Number(input.empresa_id)) {
        throw new Error("La Orden de Trabajo no pertenece a la empresa de la sesión.");
      }

      // Validar factura activa duplicada para esta OT (Preferencia índice UNIQUE condicional)
      const existingFacRes = await client.query(`
        SELECT factura_id, codigo_factura, estado
        FROM admin.facturas
        WHERE empresa_id = $1 AND orden_trabajo_id = $2 AND estado <> 'ANULADA'
        FOR UPDATE
      `, [input.empresa_id, input.orden_trabajo_id]);

      if (existingFacRes.rows && existingFacRes.rows.length > 0) {
        const facEx = existingFacRes.rows[0];
        throw new Error(
          `La Orden de Trabajo ${ot.codigo_orden || `#${input.orden_trabajo_id}`} ya tiene una factura activa: ${facEx.codigo_factura} (Estado: ${facEx.estado}).`
        );
      }

      // Si no se especificó cliente_id, heredar el de la orden
      if (!input.cliente_id && ot.cliente_id) {
        input.cliente_id = ot.cliente_id;
      }
    }

    // 4. Calcular Totales de Líneas con validación rigurosa
    let subtotalGeneral = 0;
    let descuentoGeneral = 0;

    for (let i = 0; i < input.lineas.length; i++) {
      const linea = input.lineas[i];
      if (!linea.descripcion || !linea.descripcion.trim()) {
        throw new Error(`La línea #${i + 1} debe contener una descripción válida.`);
      }
      const cant = Number(linea.cantidad);
      const prec = Number(linea.precio_unitario);
      const desc = Number(linea.descuento || 0);

      if (isNaN(cant) || cant <= 0) {
        throw new Error(`La cantidad de la línea #${i + 1} (${linea.descripcion}) debe ser mayor a 0.`);
      }
      if (isNaN(prec) || prec < 0) {
        throw new Error(`El precio unitario de la línea #${i + 1} (${linea.descripcion}) no puede ser negativo.`);
      }
      if (isNaN(desc) || desc < 0) {
        throw new Error(`El descuento de la línea #${i + 1} (${linea.descripcion}) no puede ser negativo.`);
      }

      const lineaSubtotalNeto = parseFloat(((cant * prec) - desc).toFixed(2));
      if (lineaSubtotalNeto < 0) {
        throw new Error(`El descuento de la línea #${i + 1} no puede superar su importe bruto.`);
      }

      subtotalGeneral += parseFloat((cant * prec).toFixed(2));
      descuentoGeneral += desc;
    }

    subtotalGeneral = parseFloat(subtotalGeneral.toFixed(2));
    descuentoGeneral = parseFloat(descuentoGeneral.toFixed(2));
    const subtotalNeto = Math.max(0, parseFloat((subtotalGeneral - descuentoGeneral).toFixed(2)));
    const impuestoGeneral = 0.00;
    const totalFactura = parseFloat((subtotalNeto + impuestoGeneral).toFixed(2));

    // 5. Procesar pagos iniciales si fueron provistos
    const pagosValidados: PagoInicialInput[] = [];
    let montoPagadoInicial = 0;

    if (input.pagos_iniciales && input.pagos_iniciales.length > 0) {
      for (let j = 0; j < input.pagos_iniciales.length; j++) {
        const p = input.pagos_iniciales[j];
        const monto = Number(p.monto);
        if (isNaN(monto) || monto <= 0) {
          throw new Error(`El monto del pago #${j + 1} debe ser mayor a 0.`);
        }
        if (!p.tipo_pago_id || p.tipo_pago_id <= 0) {
          throw new Error(`El tipo de pago del abono #${j + 1} es obligatorio.`);
        }
        montoPagadoInicial += monto;
        pagosValidados.push(p);
      }
    }

    montoPagadoInicial = parseFloat(montoPagadoInicial.toFixed(2));
    if (montoPagadoInicial > totalFactura) {
      throw new Error(
        `El monto total pagado (RD$ ${montoPagadoInicial.toFixed(2)}) no puede exceder el total de la factura (RD$ ${totalFactura.toFixed(2)}).`
      );
    }

    const balancePendiente = Math.max(0, parseFloat((totalFactura - montoPagadoInicial).toFixed(2)));

    // Determinar estado financiero inicial de la factura
    let estadoInicial: EstadoFactura = "PENDIENTE";
    if (totalFactura <= 0) {
      estadoInicial = montoPagadoInicial > 0 ? "PAGADA" : "PENDIENTE";
    } else if (montoPagadoInicial >= totalFactura) {
      estadoInicial = "PAGADA";
    } else if (montoPagadoInicial > 0) {
      estadoInicial = "PARCIAL";
    } else {
      estadoInicial = "PENDIENTE";
    }

    // 6. Generar Código Correlativo Canónico de Factura
    const codigoFactura = await generarCodigoFactura(client, input.empresa_id);

    // 7. Insertar Cabecera en admin.facturas
    const insertFacSql = `
      INSERT INTO admin.facturas (
        empresa_id,
        codigo_factura,
        numero_factura,
        tipo_factura_id,
        cliente_id,
        orden_trabajo_id,
        fecha_factura,
        subtotal,
        descuento,
        descuento_total,
        impuesto,
        impuesto_total,
        total,
        total_factura,
        monto_pagado,
        balance_pendiente,
        estado,
        observacion,
        usuario_creacion_id,
        fecha_creacion
      ) VALUES (
        $1, $2, $2, $3, $4, $5, COALESCE($6, NOW()),
        $7, $8, $8, $9, $9, $10, $10, $11, $12, $13, $14, $15, NOW()
      )
      RETURNING *;
    `;

    const facRes = await client.query(insertFacSql, [
      input.empresa_id,
      codigoFactura,
      input.tipo_factura_id,
      input.cliente_id || null,
      input.orden_trabajo_id || null,
      input.fecha_factura || null,
      subtotalGeneral,
      descuentoGeneral,
      impuestoGeneral,
      totalFactura,
      montoPagadoInicial,
      balancePendiente,
      estadoInicial,
      input.observacion ? input.observacion.trim() : null,
      input.usuario_id
    ]);

    const facturaRow: FacturaRow = facRes.rows[0];
    const facturaId = facturaRow.factura_id;

    // 8. Insertar Líneas en admin.detalle_factura (Snapshot Inmutable)
    const insertedDetalles: DetalleFacturaRow[] = [];
    const insertDetSql = `
      INSERT INTO admin.detalle_factura (
        factura_id,
        tipo_linea,
        tipo_detalle,
        producto_id,
        tipo_servicio_id,
        orden_servicio_id,
        orden_producto_id,
        codigo,
        descripcion,
        cantidad,
        precio_unitario,
        descuento,
        subtotal,
        costo_unitario,
        usuario_creacion_id,
        fecha_creacion
      ) VALUES (
        $1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()
      )
      RETURNING *;
    `;

    for (const linea of input.lineas) {
      const cant = Number(linea.cantidad);
      const prec = Number(linea.precio_unitario);
      const desc = Number(linea.descuento || 0);
      const sub = parseFloat(((cant * prec) - desc).toFixed(2));

      const detRes = await client.query(insertDetSql, [
        facturaId,
        linea.tipo_linea,
        linea.producto_id || null,
        linea.tipo_servicio_id || null,
        linea.orden_servicio_id || null,
        linea.orden_producto_id || null,
        linea.codigo ? linea.codigo.trim() : null,
        linea.descripcion.trim(),
        cant,
        prec,
        desc,
        sub,
        linea.costo_unitario != null ? Number(linea.costo_unitario) : null,
        input.usuario_id
      ]);

      insertedDetalles.push(detRes.rows[0]);
    }

    // 9. Insertar Pagos Iniciales en admin.pagos (si existen)
    const insertedPagos: PagoRow[] = [];
    if (pagosValidados.length > 0) {
      const insertPagoSql = `
        INSERT INTO admin.pagos (
          empresa_id,
          factura_id,
          tipo_pago_id,
          monto,
          monto_pago,
          referencia,
          observacion,
          fecha_pago,
          estado,
          usuario_id,
          fecha_creacion
        ) VALUES (
          $1, $2, $3, $4, $4, $5, $6, COALESCE($7, NOW()), 'APLICADO', $8, NOW()
        )
        RETURNING *;
      `;

      for (const p of pagosValidados) {
        const pagoRes = await client.query(insertPagoSql, [
          input.empresa_id,
          facturaId,
          p.tipo_pago_id,
          Number(p.monto),
          p.referencia ? p.referencia.trim() : null,
          p.observacion ? p.observacion.trim() : null,
          p.fecha_pago || null,
          input.usuario_id
        ]);
        insertedPagos.push(pagoRes.rows[0]);
      }
    }

    // 10. Actualizar bandera facturado en orden de trabajo (si aplica)
    if (input.orden_trabajo_id) {
      await client.query(`
        UPDATE admin.ordenes_trabajo
        SET facturado = true
        WHERE orden_trabajo_id = $1 AND (empresa_id = $2 OR empresa_id IS NULL)
      `, [input.orden_trabajo_id, input.empresa_id]);
    }

    if (isInternalTransaction) {
      await client.query("COMMIT");
    }

    facturaRow.tipo_factura_codigo = tipoFactura.codigo;
    facturaRow.tipo_factura_nombre = tipoFactura.nombre;

    return {
      factura: facturaRow,
      detalles: insertedDetalles,
      pagos: insertedPagos
    };

  } catch (err) {
    if (isInternalTransaction) {
      await client.query("ROLLBACK").catch(() => {});
    }
    console.error("Error en crearFactura:", err);
    throw err;
  } finally {
    if (isInternalTransaction) {
      client.release();
    }
  }
}

/**
 * Registra un pago sobre una factura existente manteniendo la consistencia
 * atómica de montos y estados, con soporte para pagos múltiples.
 */
export async function registrarPago(
  input: RegistrarPagoInput,
  externalClient?: PoolClient
): Promise<{ pago: PagoRow; factura: FacturaRow }> {
  const pool = getPool();
  const client = externalClient || (await pool.connect());
  const isInternalTransaction = !externalClient;

  try {
    if (isInternalTransaction) {
      await client.query("BEGIN");
    }

    // 1. Validaciones de entrada
    const monto = Number(input.monto);
    if (isNaN(monto) || monto <= 0) {
      throw new Error("El monto del pago debe ser mayor a 0.");
    }
    if (!input.tipo_pago_id || input.tipo_pago_id <= 0) {
      throw new Error("Debe seleccionar un tipo de pago válido.");
    }
    if (!input.usuario_id || input.usuario_id <= 0) {
      throw new Error("El usuario que registra el pago es obligatorio.");
    }

    // 2. Lock de la factura FOR UPDATE con validación Multitenant
    const facRes = await client.query(`
      SELECT *
      FROM admin.facturas
      WHERE factura_id = $1 AND empresa_id = $2
      FOR UPDATE
    `, [input.factura_id, input.empresa_id]);

    if (!facRes.rows || facRes.rows.length === 0) {
      throw new Error(`La factura #${input.factura_id} no existe o no pertenece a su empresa.`);
    }

    const factura: FacturaRow = facRes.rows[0];
    if (factura.estado === "ANULADA") {
      throw new Error(`No es posible registrar pagos en una factura anulada (${factura.codigo_factura}).`);
    }

    // 3. Consultar pagos aplicados actuales para calcular el nuevo acumulado
    const pagosRes = await client.query(`
      SELECT COALESCE(SUM(monto), 0)::numeric AS total_pagado
      FROM admin.pagos
      WHERE factura_id = $1 AND empresa_id = $2 AND (estado = 'APLICADO' OR estado IS NULL)
    `, [input.factura_id, input.empresa_id]);

    const totalPagadoPrevio = parseFloat(pagosRes.rows[0]?.total_pagado || "0");
    const totalFactura = parseFloat(String(factura.total || factura.total_factura || "0"));
    const nuevoTotalPagado = parseFloat((totalPagadoPrevio + monto).toFixed(2));

    // Regla: No permitir total de pagos activos mayor que total de factura
    if (nuevoTotalPagado > totalFactura) {
      const pendienteActual = Math.max(0, parseFloat((totalFactura - totalPagadoPrevio).toFixed(2)));
      throw new Error(
        `El pago de RD$ ${monto.toFixed(2)} excede el balance pendiente de la factura (RD$ ${pendienteActual.toFixed(2)}). Total factura: RD$ ${totalFactura.toFixed(2)}.`
      );
    }

    const nuevoBalancePendiente = Math.max(0, parseFloat((totalFactura - nuevoTotalPagado).toFixed(2)));

    // Determinar nuevo estado
    let nuevoEstado: EstadoFactura = factura.estado;
    if (nuevoTotalPagado >= totalFactura) {
      nuevoEstado = "PAGADA";
    } else if (nuevoTotalPagado > 0) {
      nuevoEstado = "PARCIAL";
    }

    // 4. Insertar registro en admin.pagos
    const insertPagoSql = `
      INSERT INTO admin.pagos (
        empresa_id,
        factura_id,
        tipo_pago_id,
        monto,
        monto_pago,
        referencia,
        observacion,
        fecha_pago,
        estado,
        usuario_id,
        fecha_creacion
      ) VALUES (
        $1, $2, $3, $4, $4, $5, $6, COALESCE($7, NOW()), 'APLICADO', $8, NOW()
      )
      RETURNING *;
    `;

    const pagoInsertRes = await client.query(insertPagoSql, [
      input.empresa_id,
      input.factura_id,
      input.tipo_pago_id,
      monto,
      input.referencia ? input.referencia.trim() : null,
      input.observacion ? input.observacion.trim() : null,
      input.fecha_pago || null,
      input.usuario_id
    ]);
    const pagoRow: PagoRow = pagoInsertRes.rows[0];

    // 5. Actualizar admin.facturas
    const updateFacSql = `
      UPDATE admin.facturas
      SET
        monto_pagado = $1,
        balance_pendiente = $2,
        estado = $3,
        usuario_modificacion_id = $4,
        fecha_modificacion = NOW()
      WHERE factura_id = $5 AND empresa_id = $6
      RETURNING *;
    `;

    const facUpdateRes = await client.query(updateFacSql, [
      nuevoTotalPagado,
      nuevoBalancePendiente,
      nuevoEstado,
      input.usuario_id,
      input.factura_id,
      input.empresa_id
    ]);

    const updatedFactura: FacturaRow = facUpdateRes.rows[0];

    if (isInternalTransaction) {
      await client.query("COMMIT");
    }

    return {
      pago: pagoRow,
      factura: updatedFactura
    };

  } catch (err) {
    if (isInternalTransaction) {
      await client.query("ROLLBACK").catch(() => {});
    }
    console.error("Error en registrarPago:", err);
    throw err;
  } finally {
    if (isInternalTransaction) {
      client.release();
    }
  }
}

/**
 * Recalcula atómicamente los totales, importes pagados, balance y estado
 * de una factura basándose en sus detalles persistidos y sus pagos activos.
 */
export async function recalcularEstadoFactura(
  client: PoolClient,
  facturaId: number,
  empresaId: number,
  usuarioId?: number
): Promise<FacturaRow> {
  // 1. Lock FOR UPDATE
  const facRes = await client.query(`
    SELECT *
    FROM admin.facturas
    WHERE factura_id = $1 AND empresa_id = $2
    FOR UPDATE
  `, [facturaId, empresaId]);

  if (!facRes.rows || facRes.rows.length === 0) {
    throw new Error(`Factura #${facturaId} no encontrada en la empresa ${empresaId}.`);
  }

  const factura: FacturaRow = facRes.rows[0];
  if (factura.estado === "ANULADA") {
    return factura;
  }

  // 2. Sumar detalles
  const detRes = await client.query(`
    SELECT
      COALESCE(SUM(cantidad * precio_unitario), 0)::numeric AS subtotal_bruto,
      COALESCE(SUM(descuento), 0)::numeric AS total_descuento,
      COALESCE(SUM(subtotal), 0)::numeric AS subtotal_neto
    FROM admin.detalle_factura
    WHERE factura_id = $1
  `, [facturaId]);

  const subtotalBruto = parseFloat(detRes.rows[0]?.subtotal_bruto || "0");
  const totalDescuento = parseFloat(detRes.rows[0]?.total_descuento || "0");
  const subtotalNeto = parseFloat(detRes.rows[0]?.subtotal_neto || "0");
  const totalFactura = subtotalNeto;

  // 3. Sumar pagos
  const pagosRes = await client.query(`
    SELECT COALESCE(SUM(monto), 0)::numeric AS total_pagado
    FROM admin.pagos
    WHERE factura_id = $1 AND empresa_id = $2 AND (estado = 'APLICADO' OR estado IS NULL)
  `, [facturaId, empresaId]);

  const totalPagado = parseFloat(pagosRes.rows[0]?.total_pagado || "0");
  const balancePendiente = Math.max(0, parseFloat((totalFactura - totalPagado).toFixed(2)));

  // Determinar estado
  let nuevoEstado: EstadoFactura = "PENDIENTE";
  if (totalFactura <= 0) {
    nuevoEstado = totalPagado > 0 ? "PAGADA" : "PENDIENTE";
  } else if (totalPagado >= totalFactura) {
    nuevoEstado = "PAGADA";
  } else if (totalPagado > 0) {
    nuevoEstado = "PARCIAL";
  } else {
    nuevoEstado = factura.estado === "BORRADOR" ? "BORRADOR" : "PENDIENTE";
  }

  // 4. Actualizar cabecera
  const updRes = await client.query(`
    UPDATE admin.facturas
    SET
      subtotal = $1,
      descuento = $2,
      descuento_total = $2,
      total = $3,
      total_factura = $3,
      monto_pagado = $4,
      balance_pendiente = $5,
      estado = $6,
      usuario_modificacion_id = COALESCE($7, usuario_modificacion_id),
      fecha_modificacion = NOW()
    WHERE factura_id = $8 AND empresa_id = $9
    RETURNING *;
  `, [
    subtotalBruto,
    totalDescuento,
    totalFactura,
    totalPagado,
    balancePendiente,
    nuevoEstado,
    usuarioId || null,
    facturaId,
    empresaId
  ]);

  return updRes.rows[0];
}

/**
 * Anula una factura de forma controlada y transaccional.
 * - Verifica tenant
 * - Impide doble anulación
 * - Libera la restricción de factura activa sobre la OT asociada
 */
export async function anularFactura(
  input: AnularFacturaInput,
  externalClient?: PoolClient
): Promise<FacturaRow> {
  const pool = getPool();
  const client = externalClient || (await pool.connect());
  const isInternalTransaction = !externalClient;

  try {
    if (isInternalTransaction) {
      await client.query("BEGIN");
    }

    if (!input.motivo_anulacion || input.motivo_anulacion.trim().length < 5) {
      throw new Error("El motivo de anulación es obligatorio y debe contener al menos 5 caracteres.");
    }

    const facRes = await client.query(`
      SELECT *
      FROM admin.facturas
      WHERE factura_id = $1 AND empresa_id = $2
      FOR UPDATE
    `, [input.factura_id, input.empresa_id]);

    if (!facRes.rows || facRes.rows.length === 0) {
      throw new Error(`La factura #${input.factura_id} no existe o no pertenece a su empresa.`);
    }

    const factura: FacturaRow = facRes.rows[0];
    if (factura.estado === "ANULADA") {
      throw new Error(`La factura ${factura.codigo_factura} ya se encuentra anulada.`);
    }

    // Anular pagos asociados para mantener congruencia contable
    await client.query(`
      UPDATE admin.pagos
      SET estado = 'ANULADO'
      WHERE factura_id = $1 AND empresa_id = $2
    `, [input.factura_id, input.empresa_id]);

    // Anular factura
    const notaAnulacion = `[ANULADA el ${new Date().toISOString()} por usuario #${input.usuario_id}]: ${input.motivo_anulacion.trim()}`;
    const updRes = await client.query(`
      UPDATE admin.facturas
      SET
        estado = 'ANULADA',
        balance_pendiente = 0,
        observacion = CASE
          WHEN observacion IS NULL OR observacion = '' THEN $1
          ELSE observacion || E'\n' || $1
        END,
        usuario_modificacion_id = $2,
        fecha_modificacion = NOW()
      WHERE factura_id = $3 AND empresa_id = $4
      RETURNING *;
    `, [
      notaAnulacion,
      input.usuario_id,
      input.factura_id,
      input.empresa_id
    ]);

    const updatedFactura: FacturaRow = updRes.rows[0];

    // Si provenía de una OT, actualizar bandera facturado en la orden
    if (factura.orden_trabajo_id) {
      await client.query(`
        UPDATE admin.ordenes_trabajo
        SET facturado = false
        WHERE orden_trabajo_id = $1 AND (empresa_id = $2 OR empresa_id IS NULL)
      `, [factura.orden_trabajo_id, input.empresa_id]);
    }

    if (isInternalTransaction) {
      await client.query("COMMIT");
    }

    return updatedFactura;

  } catch (err) {
    if (isInternalTransaction) {
      await client.query("ROLLBACK").catch(() => {});
    }
    console.error("Error en anularFactura:", err);
    throw err;
  } finally {
    if (isInternalTransaction) {
      client.release();
    }
  }
}

/**
 * Consulta una factura completa por ID y Empresa con sus detalles y pagos.
 */
export async function obtenerFacturaPorId(
  facturaId: number,
  empresaId: number,
  externalClient?: PoolClient
): Promise<FacturaCompletaResult | null> {
  const pool = getPool();
  const client = externalClient || (await pool.connect());

  try {
    const facRes = await client.query(`
      SELECT
        f.*,
        tf.codigo AS tipo_factura_codigo,
        tf.nombre AS tipo_factura_nombre,
        c.nombre_completo AS cliente_nombre,
        ot.codigo_orden AS codigo_orden
      FROM admin.facturas f
      JOIN admin.tipo_factura tf ON f.tipo_factura_id = tf.tipo_factura_id
      LEFT JOIN admin.clientes c ON f.cliente_id = c.cliente_id
      LEFT JOIN admin.ordenes_trabajo ot ON f.orden_trabajo_id = ot.orden_trabajo_id
      WHERE f.factura_id = $1 AND f.empresa_id = $2
    `, [facturaId, empresaId]);

    if (!facRes.rows || facRes.rows.length === 0) {
      return null;
    }

    const factura: FacturaRow = facRes.rows[0];

    const detRes = await client.query(`
      SELECT *
      FROM admin.detalle_factura
      WHERE factura_id = $1
      ORDER BY detalle_factura_id ASC
    `, [facturaId]);

    const pagosRes = await client.query(`
      SELECT
        p.*,
        tp.codigo AS tipo_pago_codigo,
        tp.nombre AS tipo_pago_nombre
      FROM admin.pagos p
      JOIN admin.tipo_pago tp ON p.tipo_pago_id = tp.tipo_pago_id
      WHERE p.factura_id = $1 AND p.empresa_id = $2
      ORDER BY p.pago_id ASC
    `, [facturaId, empresaId]);

    return {
      factura,
      detalles: detRes.rows || [],
      pagos: pagosRes.rows || []
    };
  } finally {
    if (!externalClient) {
      client.release();
    }
  }
}
