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
  EstadoFactura,
  CondicionVenta,
  GetOrCreateInvoiceForWorkOrderInput,
  LineaFacturaInput
} from "./billingTypes";
import { registrarMovimientoInventario } from "@/lib/inventory/inventoryMovementService";
import { INVENTORY_SYSTEM_CODES, generarCodigoMovimiento } from "@/lib/inventory/inventoryConstants";

const BILLING_ADVISORY_LOCK_ID = 7005;

/**
 * Retorna el conjunto de columnas existentes en una tabla de admin en minúsculas.
 */
async function getTableColumns(client: PoolClient, tableName: string): Promise<Set<string>> {
  const res = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = $1`,
    [tableName]
  );
  return new Set((res.rows || []).map((r: { column_name: string }) => String(r.column_name).toLowerCase()));
}

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

    // 0. Concurrencia segura: Lock consultivo a nivel de transacción para facturación
    await client.query("SELECT pg_advisory_xact_lock($1)", [BILLING_ADVISORY_LOCK_ID]);

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
      WHERE tipo_factura_id = $1
    `, [input.tipo_factura_id]);

    if (!tfRes.rows || tfRes.rows.length === 0) {
      throw new Error(`El tipo de factura #${input.tipo_factura_id} no existe o no está activo.`);
    }
    const tipoFactura = tfRes.rows[0];

    // 3. Regla OT Facturable (Sección 6, 14, 15, 17 y 18):
    // Impedir más de una factura activa por OT, validar estado LISTA_ENTREGA y pertenencia
    if (input.orden_trabajo_id) {
      const otRes = await client.query(`
        SELECT ot.orden_trabajo_id, ot.codigo_orden, ot.cliente_id, c.empresa_id,
               ot.estado_orden_id,
               eot.codigo AS estado_codigo, eot.nombre AS estado_nombre
        FROM admin.ordenes_trabajo ot
        JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
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

      // Validar que la orden esté en estado LISTA_ENTREGA (Sección 2 y 14)
      const estadoCod = String(ot.estado_codigo || "").toUpperCase();
      const estadoId = Number(ot.estado_orden_id);
      if (estadoCod !== "LISTA_ENTREGA" && estadoId !== 7) {
        const errEstado: Error & { code?: string } = new Error(
          `La Orden de Trabajo ${ot.codigo_orden || `#${input.orden_trabajo_id}`} no puede facturarse en estado '${ot.estado_nombre || ot.estado_codigo}'. Solo órdenes en estado 'LISTA_ENTREGA' son facturables.`
        );
        errEstado.code = "OT_ESTADO_INVALIDO";
        throw errEstado;
      }

      // Validar factura activa duplicada para esta OT (Sección 3 y 15)
      const existingFacRes = await client.query(`
        SELECT f.factura_id,
               COALESCE(f.numero_factura, f.factura_id::text) AS codigo_factura,
               f.numero_factura,
               f.estado
        FROM admin.facturas f
        WHERE f.orden_trabajo_id = $1 AND f.empresa_id = $2 AND f.estado <> 'ANULADA'
        FOR UPDATE OF f
      `, [input.orden_trabajo_id, input.empresa_id]);

      if (existingFacRes.rows && existingFacRes.rows.length > 0) {
        const facEx = existingFacRes.rows[0];
        const errObj: Error & { code?: string } = new Error(
          `La Orden de Trabajo ${ot.codigo_orden || `#${input.orden_trabajo_id}`} ya tiene una factura activa: ${facEx.codigo_factura} (Estado: ${facEx.estado}).`
        );
        errObj.code = "OT_YA_FACTURADA";
        throw errObj;
      }

      // Si la factura proviene de una OT, el cliente DEBE ser el cliente de la OT (Sección 6)
      if (ot.cliente_id) {
        if (input.cliente_id && Number(input.cliente_id) !== Number(ot.cliente_id)) {
          const errCli: Error & { code?: string } = new Error(
            `No se permite cambiar el cliente. La factura de la OT ${ot.codigo_orden || `#${input.orden_trabajo_id}`} debe permanecer ligada al cliente de la orden.`
          );
          errCli.code = "CLIENTE_OT_INCONSISTENTE";
          throw errCli;
        }
        input.cliente_id = ot.cliente_id;
      }
    }

    // 3.1. Proteger y reconstruir líneas SERVICIO y REPUESTO desde la OT oficial (Sección 13, 14, 15)
    if (input.orden_trabajo_id) {
      const srvSql = `
        SELECT
          os.orden_servicio_id,
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
        WHERE os.orden_trabajo_id = $1 AND (os.activo IS DISTINCT FROM false)
        ORDER BY os.orden_servicio_id ASC;
      `;
      const srvRes = await client.query<{
        orden_servicio_id: number;
        tipo_servicio_id: number | null;
        codigo: string;
        descripcion: string;
        cantidad: string | number;
        precio_unitario: string | number;
        descuento: string | number;
        subtotal: string | number;
      }>(srvSql, [input.orden_trabajo_id]);

      const partSql = `
        SELECT
          op.orden_producto_id,
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
          COALESCE(ep.costo_promedio, p.costo_actual, 0)::numeric AS costo_unitario
        FROM admin.orden_productos op
        LEFT JOIN admin.productos p ON op.producto_id = p.producto_id
        LEFT JOIN admin.existencias_producto ep ON (ep.producto_id = op.producto_id AND ep.almacen_id = op.almacen_id)
        WHERE op.orden_trabajo_id = $1 AND op.utilizado = true
        ORDER BY op.orden_producto_id ASC;
      `;
      const partRes = await client.query<{
        orden_producto_id: number;
        producto_id: number;
        almacen_id: number | null;
        codigo: string;
        descripcion: string;
        cantidad: string | number;
        precio_unitario: string | number;
        descuento: string | number;
        subtotal: string | number;
        costo_unitario: string | number | null;
      }>(partSql, [input.orden_trabajo_id]);

      // Extraer productos adicionales manuales ingresados por el usuario
      const manualProducts = (input.lineas || []).filter(
        (l) => l.tipo_linea === "PRODUCTO" && !l.orden_servicio_id && !l.orden_producto_id
      );

      input.lineas = [
        ...srvRes.rows.map((s) => ({
          tipo_linea: "SERVICIO" as const,
          tipo_servicio_id: s.tipo_servicio_id ? Number(s.tipo_servicio_id) : null,
          orden_servicio_id: Number(s.orden_servicio_id),
          producto_id: null,
          almacen_id: null,
          codigo: s.codigo,
          descripcion: s.descripcion,
          cantidad: Number(s.cantidad),
          precio_unitario: Number(s.precio_unitario),
          descuento: Number(s.descuento || 0),
          costo_unitario: null
        })),
        ...partRes.rows.map((r) => ({
          tipo_linea: "REPUESTO" as const,
          producto_id: Number(r.producto_id),
          orden_producto_id: Number(r.orden_producto_id),
          almacen_id: r.almacen_id ? Number(r.almacen_id) : null,
          tipo_servicio_id: null,
          orden_servicio_id: null,
          codigo: r.codigo,
          descripcion: r.descripcion,
          cantidad: Number(r.cantidad),
          precio_unitario: Number(r.precio_unitario),
          descuento: Number(r.descuento || 0),
          costo_unitario: r.costo_unitario != null ? Number(r.costo_unitario) : null
        })),
        ...manualProducts
      ];
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

    if (totalFactura <= 0) {
      throw new Error("El total de la factura debe ser mayor a 0.");
    }

    // 5. Condición de Venta y Procesamiento de Pagos (CONTADO vs CRÉDITO)
    const condicionVenta: CondicionVenta = input.condicion_venta || (input.pagos_iniciales && input.pagos_iniciales.length > 0 ? "CONTADO" : "CREDITO");

    const pagosValidados: PagoInicialInput[] = [];
    let montoPagadoInicial = 0;

    if (condicionVenta === "CREDITO") {
      // En venta a crédito: NO se genera pago inicial, estado = PENDIENTE, balance = total
      montoPagadoInicial = 0;
    } else {
      // En venta al CONTADO: se genera el pago completo en la misma transacción
      if (!input.pagos_iniciales || input.pagos_iniciales.length === 0) {
        throw new Error("Debe seleccionar un tipo de pago para ventas al contado.");
      }

      const rawP = input.pagos_iniciales[0];
      if (!rawP.tipo_pago_id || rawP.tipo_pago_id <= 0) {
        throw new Error("Debe seleccionar un tipo de pago válido para ventas al contado.");
      }

      const tpRes = await client.query<{ codigo: string; nombre: string }>(
        `SELECT codigo, nombre FROM admin.tipo_pago WHERE tipo_pago_id = $1`,
        [rawP.tipo_pago_id]
      );
      const tipoPagoCodigo = tpRes.rows[0]?.codigo || "EFECTIVO";

      let montoRecibido = Number(rawP.monto_recibido != null ? rawP.monto_recibido : (rawP.monto || totalFactura));
      if (isNaN(montoRecibido) || montoRecibido <= 0) {
        montoRecibido = totalFactura;
      }

      let montoDevuelta = 0;
      if (tipoPagoCodigo === "EFECTIVO") {
        if (montoRecibido < totalFactura) {
          throw new Error(
            `El monto recibido en efectivo (RD$ ${montoRecibido.toFixed(2)}) no puede ser menor al total de la factura (RD$ ${totalFactura.toFixed(2)}).`
          );
        }
        montoDevuelta = parseFloat((montoRecibido - totalFactura).toFixed(2));
      } else {
        montoRecibido = totalFactura;
        montoDevuelta = 0;
      }

      // En admin.pagos.monto SIEMPRE se guarda el total real de la factura (Sección 7)
      pagosValidados.push({
        tipo_pago_id: rawP.tipo_pago_id,
        monto: totalFactura,
        monto_recibido: montoRecibido,
        monto_devuelta: montoDevuelta,
        referencia: rawP.referencia ? rawP.referencia.trim() : null,
        observacion: rawP.observacion ? rawP.observacion.trim() : null,
        fecha_pago: rawP.fecha_pago || new Date()
      });

      montoPagadoInicial = totalFactura;
    }

    const balancePendiente = Math.max(0, parseFloat((totalFactura - montoPagadoInicial).toFixed(2)));
    const estadoInicial: EstadoFactura = condicionVenta === "CONTADO" ? "PAGADA" : "PENDIENTE";

    // 6. Generar Código Correlativo Canónico de Factura
    const codigoFactura = await generarCodigoFactura(client, input.empresa_id);

    // 6.1. Generar factura_id seguro bajo lock de transacción
    const maxFacRes = await client.query(
      `SELECT COALESCE(MAX(factura_id), 0) + 1 AS next_id FROM admin.facturas`
    );
    const facturaId = Number(maxFacRes.rows[0]?.next_id) || 1;

    // 7. Insertar Cabecera en admin.facturas de forma tolerante a columnas
    const facCols = await getTableColumns(client, "facturas");
    facCols.add("empresa_id");

    const facData: Record<string, unknown> = {
      factura_id: facturaId,
      empresa_id: input.empresa_id,
      codigo_factura: codigoFactura,
      numero_factura: codigoFactura,
      tipo_factura_id: input.tipo_factura_id,
      condicion_venta: condicionVenta,
      cliente_id: input.cliente_id || null,
      orden_trabajo_id: input.orden_trabajo_id || null,
      fecha_factura: input.fecha_factura || new Date(),
      subtotal: subtotalGeneral,
      descuento: descuentoGeneral,
      descuento_total: descuentoGeneral,
      impuesto: impuestoGeneral,
      impuesto_total: impuestoGeneral,
      total: totalFactura,
      total_factura: totalFactura,
      monto_pagado: montoPagadoInicial,
      balance_pendiente: balancePendiente,
      estado: estadoInicial,
      observacion: input.observacion ? input.observacion.trim() : null,
      usuario_creacion_id: input.usuario_id,
      usuario_registro: input.usuario_id,
      fecha_creacion: new Date(),
      fecha_registro: new Date()
    };

    const validFacEntries = Object.entries(facData).filter(([col]) => facCols.has(col));
    const facColNames = validFacEntries.map(([col]) => col).join(", ");
    const facPlaceholders = validFacEntries.map((_, idx) => `$${idx + 1}`).join(", ");
    const facValues = validFacEntries.map(([, val]) => val);

    const facRes = await client.query(
      `INSERT INTO admin.facturas (${facColNames}) VALUES (${facPlaceholders}) RETURNING *`,
      facValues
    );

    const facturaRow: FacturaRow = facRes.rows[0] || {};
    if (!facturaRow.codigo_factura) {
      facturaRow.codigo_factura = (facturaRow.numero_factura as string) || `FAC-${facturaId}`;
    }
    facturaRow.factura_id = facturaId;
    facturaRow.condicion_venta = condicionVenta;

    // 7.1. Salida física de Inventario para líneas PRODUCTO (FAC-2, FAC-3, Secciones 9, 10, 11)
    // - Las líneas REPUESTO de una OT NO generan SAL_VENTA porque ya salieron vía SAL_ORDEN.
    // - Las líneas SERVICIO NO generan inventario.
    // - Cualquier línea PRODUCTO (sea de Venta Directa o adicional en OT) SÍ genera SAL_VENTA.
    const lineasProducto = input.lineas.filter(l => l.tipo_linea === "PRODUCTO");
    if (lineasProducto.length > 0) {
      // Validar que cada producto tenga almacén asignado
      for (let idx = 0; idx < lineasProducto.length; idx++) {
        const lp = lineasProducto[idx];
        if (!lp.producto_id || !lp.almacen_id) {
          throw new Error(`El producto en la línea #${idx + 1} (${lp.descripcion}) debe tener producto y almacén asignados.`);
        }
      }

      // Ordenar locks por producto_id ASC, almacen_id ASC para evitar deadlocks (Sección 17)
      const lineasOrdenadas = [...lineasProducto].sort((a, b) => {
        if (a.producto_id! !== b.producto_id!) {
          return a.producto_id! - b.producto_id!;
        }
        return (a.almacen_id || 0) - (b.almacen_id || 0);
      });

      // Generar código de operación único para agrupar movimientos de esta factura (Sección 25)
      let codigoMovimientoOp: string | null = null;
      try {
        codigoMovimientoOp = await generarCodigoMovimiento(
          client,
          input.empresa_id,
          INVENTORY_SYSTEM_CODES.SALIDA_VENTA
        );
      } catch (errMov) {
        console.warn("Could not generate movement code via function:", errMov);
      }

      for (const lp of lineasOrdenadas) {
        const movRes = await registrarMovimientoInventario({
          client,
          empresaId: input.empresa_id,
          usuarioId: input.usuario_id,
          tipoMovimientoCodigo: "SAL_VENTA",
          productoId: lp.producto_id!,
          almacenId: lp.almacen_id!,
          cantidad: Number(lp.cantidad),
          referencia: codigoFactura,
          codigoMovimiento: codigoMovimientoOp,
          observacion: `Venta Factura ${codigoFactura} (${tipoFactura.codigo})`
        });

        // Snapshot del costo unitario (PMP del almacén) si no fue provisto
        if (lp.costo_unitario == null) {
          lp.costo_unitario = movRes.costoUnitario;
        }
      }
    }

    // 8. Insertar Líneas en admin.detalle_factura (Snapshot Inmutable)
    const insertedDetalles: DetalleFacturaRow[] = [];
    const detCols = await getTableColumns(client, "detalle_factura");

    const maxDetRes = await client.query(
      `SELECT COALESCE(MAX(detalle_factura_id), 0) AS max_id FROM admin.detalle_factura`
    );
    let nextDetalleId = Number(maxDetRes.rows[0]?.max_id) || 0;

    for (const linea of input.lineas) {
      nextDetalleId += 1;
      const cant = Number(linea.cantidad);
      const prec = Number(linea.precio_unitario);
      const desc = Number(linea.descuento || 0);
      const sub = parseFloat(((cant * prec) - desc).toFixed(2));

      const detData: Record<string, unknown> = {
        detalle_factura_id: nextDetalleId,
        factura_id: facturaId,
        almacen_id: linea.almacen_id || null,
        tipo_linea: linea.tipo_linea,
        tipo_detalle: linea.tipo_linea === "REPUESTO" ? "PRODUCTO" : linea.tipo_linea,
        producto_id: linea.producto_id || null,
        servicio_id: linea.orden_servicio_id || linea.tipo_servicio_id || null,
        tipo_servicio_id: linea.tipo_servicio_id || null,
        orden_servicio_id: linea.orden_servicio_id || null,
        orden_producto_id: linea.orden_producto_id || null,
        codigo: linea.codigo ? linea.codigo.trim() : null,
        descripcion: linea.descripcion.trim(),
        cantidad: cant,
        precio_unitario: prec,
        descuento: desc,
        subtotal: sub,
        costo_unitario: linea.costo_unitario != null ? Number(linea.costo_unitario) : null,
        usuario_creacion_id: input.usuario_id,
        usuario_registro: input.usuario_id,
        fecha_creacion: new Date(),
        fecha_registro: new Date()
      };

      const validDetEntries = Object.entries(detData).filter(([col]) => detCols.has(col));
      const detColNames = validDetEntries.map(([col]) => col).join(", ");
      const detPlaceholders = validDetEntries.map((_, idx) => `$${idx + 1}`).join(", ");
      const detValues = validDetEntries.map(([, val]) => val);

      const detRes = await client.query(
        `INSERT INTO admin.detalle_factura (${detColNames}) VALUES (${detPlaceholders}) RETURNING *`,
        detValues
      );

      insertedDetalles.push(detRes.rows[0]);
    }

    // 9. Insertar Pagos Iniciales en admin.pagos (si existen)
    const insertedPagos: PagoRow[] = [];
    if (pagosValidados.length > 0) {
      const pagoCols = await getTableColumns(client, "pagos");

      const maxPagoRes = await client.query(
        `SELECT COALESCE(MAX(pago_id), 0) AS max_id FROM admin.pagos`
      );
      let nextPagoId = Number(maxPagoRes.rows[0]?.max_id) || 0;

      for (const p of pagosValidados) {
        nextPagoId += 1;
        const pagoData: Record<string, unknown> = {
          pago_id: nextPagoId,
          factura_id: facturaId,
          tipo_pago_id: p.tipo_pago_id,
          monto: Number(p.monto),
          monto_pago: Number(p.monto),
          monto_recibido: p.monto_recibido != null ? Number(p.monto_recibido) : Number(p.monto),
          monto_devuelta: p.monto_devuelta != null ? Number(p.monto_devuelta) : 0,
          referencia: p.referencia ? p.referencia.trim() : null,
          observacion: p.observacion ? p.observacion.trim() : null,
          fecha_pago: p.fecha_pago || new Date(),
          estado: "APLICADO",
          usuario_id: input.usuario_id,
          usuario_registro: input.usuario_id,
          fecha_creacion: new Date(),
          fecha_registro: new Date()
        };

        const validPagoEntries = Object.entries(pagoData).filter(([col]) => pagoCols.has(col));
        const pagoColNames = validPagoEntries.map(([col]) => col).join(", ");
        const pagoPlaceholders = validPagoEntries.map((_, idx) => `$${idx + 1}`).join(", ");
        const pagoValues = validPagoEntries.map(([, val]) => val);

        const pagoRes = await client.query(
          `INSERT INTO admin.pagos (${pagoColNames}) VALUES (${pagoPlaceholders}) RETURNING *, monto_pago AS monto`,
          pagoValues
        );
        const rPago = pagoRes.rows[0] || {};
        insertedPagos.push({
          ...rPago,
          monto: Number(rPago.monto_pago != null ? rPago.monto_pago : p.monto),
          monto_pago: Number(rPago.monto_pago != null ? rPago.monto_pago : p.monto)
        });
      }
    }

    // 10. Actualizar bandera facturado en orden de trabajo (sincronización legacy)
    // La OT permanece en LISTA_ENTREGA hasta que el usuario ejecute la entrega en taller (Sección 16 y 17)
    if (input.orden_trabajo_id) {
      await client.query(`
        UPDATE admin.ordenes_trabajo
        SET facturado = true,
            fecha_facturacion = NOW(),
            usuario_facturacion_id = $2
        WHERE orden_trabajo_id = $1
      `, [input.orden_trabajo_id, input.usuario_id]);
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
 * Obtiene la factura activa de una Orden de Trabajo o la crea automáticamente
 * si aún no existe (FIX-FAC-TALLER-1).
 * Reutiliza íntegramente crearFactura garantizando:
 * - 0 movimientos adicionales de inventario para repuestos consumidos (tipo_linea = REPUESTO)
 * - Mismo motor transaccional
 * - Manejo robusto de concurrencia e idempotencia
 */
export async function getOrCreateInvoiceForWorkOrder(
  input: GetOrCreateInvoiceForWorkOrderInput,
  externalClient?: PoolClient
): Promise<{ factura: FacturaRow; created: boolean }> {
  const pool = getPool();
  const client = externalClient || (await pool.connect());
  const isInternalTransaction = !externalClient;

  try {
    if (isInternalTransaction) {
      await client.query("BEGIN");
    }

    // 1. Verificar si ya existe una factura activa para esta orden (Sección 9)
    const existingFacRes = await client.query(`
      SELECT f.factura_id,
             COALESCE(f.numero_factura, f.factura_id::text) AS codigo_factura,
             f.numero_factura,
             f.estado,
             COALESCE(f.total_factura, 0)::numeric AS total_factura,
             COALESCE(f.monto_pagado, 0)::numeric AS monto_pagado,
             COALESCE(f.balance_pendiente, 0)::numeric AS balance_pendiente
      FROM admin.facturas f
      WHERE f.orden_trabajo_id = $1 AND f.empresa_id = $2 AND f.estado <> 'ANULADA'
      ORDER BY f.factura_id DESC
      LIMIT 1
      FOR UPDATE OF f
    `, [input.orden_trabajo_id, input.empresa_id]);

    if (existingFacRes.rows && existingFacRes.rows.length > 0) {
      const existing = existingFacRes.rows[0] as FacturaRow;
      if (isInternalTransaction) {
        await client.query("COMMIT");
      }
      return { factura: existing, created: false };
    }

    // 2. Si no existe factura activa, cargar la OT y bloquearla (Sección 10, 11, 12)
    const otRes = await client.query(`
      SELECT ot.orden_trabajo_id, ot.codigo_orden, ot.cliente_id, c.empresa_id,
             ot.estado_orden_id, eot.codigo AS estado_codigo, eot.nombre AS estado_nombre
      FROM admin.ordenes_trabajo ot
      JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
      LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
      WHERE ot.orden_trabajo_id = $1
      FOR UPDATE OF ot
    `, [input.orden_trabajo_id]);

    if (!otRes.rows || otRes.rows.length === 0) {
      throw new Error(`La Orden de Trabajo #${input.orden_trabajo_id} no existe.`);
    }

    const ot = otRes.rows[0];

    // 3. Consultar servicios activos
    const servicesRes = await client.query(`
      SELECT
        os.orden_servicio_id,
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
      WHERE os.orden_trabajo_id = $1 AND (os.activo IS DISTINCT FROM false)
      ORDER BY os.orden_servicio_id ASC
    `, [input.orden_trabajo_id]);

    // 4. Consultar repuestos estrictamente utilizados (utilizado = true) (Sección 6)
    const partsRes = await client.query(`
      SELECT
        op.orden_producto_id,
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
        )::numeric AS subtotal
      FROM admin.orden_productos op
      LEFT JOIN admin.productos p ON op.producto_id = p.producto_id
      WHERE op.orden_trabajo_id = $1
        AND op.utilizado = true
      ORDER BY op.orden_producto_id ASC
    `, [input.orden_trabajo_id]);

    // 5. Construir líneas para el motor central de facturación
    const lineas: LineaFacturaInput[] = [];

    for (const s of servicesRes.rows || []) {
      lineas.push({
        tipo_linea: "SERVICIO",
        tipo_servicio_id: s.tipo_servicio_id ? Number(s.tipo_servicio_id) : null,
        orden_servicio_id: Number(s.orden_servicio_id),
        codigo: s.codigo,
        descripcion: s.descripcion,
        cantidad: Number(s.cantidad),
        precio_unitario: Number(s.precio_unitario),
        descuento: Number(s.descuento || 0)
      });
    }

    for (const r of partsRes.rows || []) {
      lineas.push({
        tipo_linea: "REPUESTO",
        producto_id: Number(r.producto_id),
        almacen_id: r.almacen_id ? Number(r.almacen_id) : null,
        orden_producto_id: Number(r.orden_producto_id),
        codigo: r.codigo,
        descripcion: r.descripcion,
        cantidad: Number(r.cantidad),
        precio_unitario: Number(r.precio_unitario),
        descuento: Number(r.descuento || 0)
      });
    }

    if (lineas.length === 0) {
      lineas.push({
        tipo_linea: "SERVICIO",
        codigo: "SRV-TALLER",
        descripcion: `Servicio de Taller — Orden ${ot.codigo_orden || `#${input.orden_trabajo_id}`}`,
        cantidad: 1,
        precio_unitario: 0,
        descuento: 0
      });
    }

    // 6. Obtener ID de tipo_factura para ORDEN_TRABAJO
    let tipoFacturaId = 1;
    const tfRes = await client.query(`
      SELECT tipo_factura_id FROM admin.tipo_factura WHERE codigo = 'ORDEN_TRABAJO' LIMIT 1
    `);
    if (tfRes.rows && tfRes.rows.length > 0) {
      tipoFacturaId = Number(tfRes.rows[0].tipo_factura_id);
    }

    // 7. Invocar el motor central crearFactura
    try {
      const res = await crearFactura({
        empresa_id: input.empresa_id || Number(ot.empresa_id || 1),
        usuario_id: input.usuario_id,
        cliente_id: ot.cliente_id ? Number(ot.cliente_id) : null,
        tipo_factura_id: tipoFacturaId,
        orden_trabajo_id: input.orden_trabajo_id,
        observacion: input.observacion || `Factura de taller generada en entrega de Orden ${ot.codigo_orden || `#${input.orden_trabajo_id}`}`,
        lineas
      }, client);

      if (isInternalTransaction) {
        await client.query("COMMIT");
      }

      return { factura: res.factura, created: true };
    } catch (err: unknown) {
      const dbErr = err as { code?: string; message?: string };
      // Concurrencia (Sección 13): Si otra transacción creó la factura simultáneamente
      if (dbErr.code === "OT_YA_FACTURADA" || dbErr.code === "23505" || String(dbErr.message || "").includes("orden_trabajo")) {
        const raceCheck = await client.query(`
          SELECT f.factura_id,
                 COALESCE(f.numero_factura, f.factura_id::text) AS codigo_factura,
                 f.numero_factura,
                 f.estado,
                 COALESCE(f.total_factura, 0)::numeric AS total_factura,
                 COALESCE(f.monto_pagado, 0)::numeric AS monto_pagado,
                 COALESCE(f.balance_pendiente, 0)::numeric AS balance_pendiente
          FROM admin.facturas f
          WHERE f.orden_trabajo_id = $1 AND f.empresa_id = $2 AND f.estado <> 'ANULADA'
          ORDER BY f.factura_id DESC LIMIT 1
        `, [input.orden_trabajo_id, input.empresa_id]);

        if (raceCheck.rows && raceCheck.rows.length > 0) {
          if (isInternalTransaction) {
            await client.query("COMMIT");
          }
          return { factura: raceCheck.rows[0] as FacturaRow, created: false };
        }
      }
      throw err;
    }
  } catch (err) {
    if (isInternalTransaction) {
      await client.query("ROLLBACK").catch(() => {});
    }
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

    // 0. Concurrencia segura: Lock consultivo para registro de pagos
    await client.query("SELECT pg_advisory_xact_lock($1)", [BILLING_ADVISORY_LOCK_ID]);

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
      SELECT COALESCE(SUM(p.monto_pago), 0)::numeric AS total_pagado
      FROM admin.pagos p
      JOIN admin.facturas f ON p.factura_id = f.factura_id
      WHERE p.factura_id = $1 AND f.empresa_id = $2 AND (p.estado = 'APLICADO' OR p.estado IS NULL)
    `, [input.factura_id, input.empresa_id]);

    const totalPagadoPrevio = parseFloat(pagosRes.rows[0]?.total_pagado || "0");
    const totalFacturaNum = Number(factura.total) > 0
      ? Number(factura.total)
      : (Number(factura.total_factura) > 0
          ? Number(factura.total_factura)
          : (Number(factura.subtotal) > 0
              ? Number(factura.subtotal)
              : Number(factura.balance_pendiente || 0)));
    const totalFactura = parseFloat(totalFacturaNum.toFixed(2));
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

    // 4. Insertar registro en admin.pagos generando pago_id seguro
    const maxPagoRes = await client.query(
      `SELECT COALESCE(MAX(pago_id), 0) + 1 AS next_id FROM admin.pagos`
    );
    const nextPagoId = Number(maxPagoRes.rows[0]?.next_id) || 1;

    const pagoCols = await getTableColumns(client, "pagos");
    const pagoData: Record<string, unknown> = {
      pago_id: nextPagoId,
      factura_id: input.factura_id,
      tipo_pago_id: input.tipo_pago_id,
      monto: monto,
      monto_pago: monto,
      monto_recibido: input.monto_recibido != null ? Number(input.monto_recibido) : monto,
      monto_devuelta: input.monto_devuelta != null ? Number(input.monto_devuelta) : 0,
      referencia: input.referencia ? input.referencia.trim() : null,
      observacion: input.observacion ? input.observacion.trim() : null,
      fecha_pago: input.fecha_pago || new Date(),
      estado: "APLICADO",
      usuario_id: input.usuario_id,
      usuario_registro: input.usuario_id,
      fecha_creacion: new Date(),
      fecha_registro: new Date()
    };

    const validPagoEntries = Object.entries(pagoData).filter(([col]) => pagoCols.has(col));
    const pagoColNames = validPagoEntries.map(([col]) => col).join(", ");
    const pagoPlaceholders = validPagoEntries.map((_, idx) => `$${idx + 1}`).join(", ");
    const pagoValues = validPagoEntries.map(([, val]) => val);

    const pagoInsertRes = await client.query(
      `INSERT INTO admin.pagos (${pagoColNames}) VALUES (${pagoPlaceholders}) RETURNING *, monto_pago AS monto`,
      pagoValues
    );
    const rawPagoRow = pagoInsertRes.rows[0] || {};
    const pagoRow: PagoRow = {
      ...rawPagoRow,
      monto: Number(rawPagoRow.monto_pago != null ? rawPagoRow.monto_pago : (rawPagoRow.monto != null ? rawPagoRow.monto : monto)),
      monto_pago: Number(rawPagoRow.monto_pago != null ? rawPagoRow.monto_pago : (rawPagoRow.monto != null ? rawPagoRow.monto : monto)),
      monto_recibido: rawPagoRow.monto_recibido != null ? Number(rawPagoRow.monto_recibido) : (input.monto_recibido != null ? Number(input.monto_recibido) : monto),
      monto_devuelta: rawPagoRow.monto_devuelta != null ? Number(rawPagoRow.monto_devuelta) : (input.monto_devuelta != null ? Number(input.monto_devuelta) : 0)
    };

    // 5. Actualizar admin.facturas
    const updateFacSql = `
      UPDATE admin.facturas
      SET
        monto_pagado = $1,
        balance_pendiente = $2,
        estado = $3,
        total = CASE WHEN total IS NULL OR total = 0 THEN COALESCE(NULLIF(total_factura, 0), $7) ELSE total END,
        total_factura = CASE WHEN total_factura IS NULL OR total_factura = 0 THEN COALESCE(NULLIF(total, 0), $7) ELSE total_factura END,
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
      input.empresa_id,
      totalFactura
    ]);

    const rawFacturaRow = facUpdateRes.rows[0] || {};
    const updatedFactura: FacturaRow = {
      ...rawFacturaRow,
      total: Number(rawFacturaRow.total) > 0 ? Number(rawFacturaRow.total) : totalFactura,
      total_factura: Number(rawFacturaRow.total_factura) > 0 ? Number(rawFacturaRow.total_factura) : totalFactura,
      monto_pagado: nuevoTotalPagado,
      balance_pendiente: nuevoBalancePendiente,
      estado: nuevoEstado
    };

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
    SELECT COALESCE(SUM(p.monto_pago), 0)::numeric AS total_pagado
    FROM admin.pagos p
    JOIN admin.facturas f ON p.factura_id = f.factura_id
    WHERE p.factura_id = $1 AND f.empresa_id = $2 AND (p.estado = 'APLICADO' OR p.estado IS NULL)
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

    if (!input.motivo_anulacion || input.motivo_anulacion.trim().length < 1) {
      throw new Error("El motivo de anulación es obligatorio.");
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
      throw new Error(`La factura ${factura.codigo_factura || factura.numero_factura || `#${factura.factura_id}`} ya se encuentra anulada.`);
    }

    // Regla 3 & 13: NO borrar ni modificar registros de admin.pagos (se conservan como evidencia histórica)
    // Regla 20 & 21: NO modificar el estado de la Orden de Trabajo si pertenecía a una OT

    // Anular factura con columnas de trazabilidad si existen en el esquema
    const facCols = await getTableColumns(client, "facturas");
    const updateSet: string[] = ["estado = 'ANULADA'"];
    const updateParams: (string | number)[] = [input.factura_id];
    let updateIdx = 2;

    if (facCols.has("motivo_anulacion")) {
      updateSet.push(`motivo_anulacion = $${updateIdx}`);
      updateParams.push(input.motivo_anulacion.trim());
      updateIdx++;
    }

    if (facCols.has("fecha_anulacion")) {
      updateSet.push(`fecha_anulacion = NOW()`);
    }

    if (facCols.has("usuario_anulacion_id")) {
      updateSet.push(`usuario_anulacion_id = $${updateIdx}`);
      updateParams.push(input.usuario_id);
      updateIdx++;
    }

    if (facCols.has("fecha_modificacion")) {
      updateSet.push(`fecha_modificacion = NOW()`);
    }

    if (facCols.has("usuario_modificacion_id")) {
      updateSet.push(`usuario_modificacion_id = $${updateIdx}`);
      updateParams.push(input.usuario_id);
      updateIdx++;
    }

    const updRes = await client.query(`
      UPDATE admin.facturas
      SET ${updateSet.join(", ")}
      WHERE factura_id = $1 AND empresa_id = $${updateIdx}
      RETURNING *;
    `, [...updateParams, input.empresa_id]);

    const updatedFactura: FacturaRow = updRes.rows[0];

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

    const rawFactura = facRes.rows[0];
    const safeTotal = Number(rawFactura.total) > 0
      ? Number(rawFactura.total)
      : (Number(rawFactura.total_factura) > 0
          ? Number(rawFactura.total_factura)
          : (Number(rawFactura.subtotal) > 0 ? Number(rawFactura.subtotal) : Number(rawFactura.balance_pendiente || 0)));

    const factura: FacturaRow = {
      ...rawFactura,
      total: safeTotal,
      total_factura: safeTotal
    };

    const detRes = await client.query(`
      SELECT *
      FROM admin.detalle_factura
      WHERE factura_id = $1
      ORDER BY detalle_factura_id ASC
    `, [facturaId]);

    const pagosRes = await client.query(`
      SELECT
        p.*,
        p.monto_pago AS monto,
        tp.codigo AS tipo_pago_codigo,
        tp.nombre AS tipo_pago_nombre
      FROM admin.pagos p
      JOIN admin.facturas f ON p.factura_id = f.factura_id
      JOIN admin.tipo_pago tp ON p.tipo_pago_id = tp.tipo_pago_id
      WHERE p.factura_id = $1 AND f.empresa_id = $2
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
