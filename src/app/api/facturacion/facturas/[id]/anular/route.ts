import { NextRequest, NextResponse } from "next/server";
import { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { INVENTORY_SYSTEM_CODES, generarCodigoMovimiento, ensureEmpresaCodigoSistemaProvisioned } from "@/lib/inventory/inventoryConstants";
import { calcularNuevoPMP } from "@/lib/inventory/inventoryMovementService";
import {
  ensureReversalTraceabilitySchema,
  resolverMovimientosParaReversionFactura,
  obtenerReglaReversion
} from "@/lib/billing/inventoryReversalTraceability";

export const dynamic = "force-dynamic";

const BILLING_ADVISORY_LOCK_ID = 7005;

export interface RouteParams {
  params: Promise<{ id: string }>;
}

export interface AnularFacturaBody {
  motivo_anulacion_factura_id?: number | string;
  motivo?: string;
  observacion?: string;
  destino_producto?: "DISPONIBLE" | "DAÑADO" | "DEFECTUOSO" | "CUARENTENA" | string;
  usuario_autorizacion_id?: number | string;
}

export class AnulacionFacturaError extends Error {
  code: string;
  statusCode: number;
  details?: unknown;

  constructor(code: string, message: string, statusCode: number = 400, details?: unknown) {
    super(message);
    this.name = "AnulacionFacturaError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface AnulacionFacturaResult {
  success: boolean;
  message: string;
  data: {
    factura_id: number;
    codigo_factura: string;
    estado: string;
    motivo_anulacion: string;
    motivo_codigo: string;
    observacion: string;
    destino_producto: string;
    reversos_inventario: number;
    movimientos_reversados: number[];
  };
}

export async function anularFactura(
  facturaId: number,
  empresaId: number,
  usuarioId: number,
  body: AnularFacturaBody,
  externalClient?: PoolClient
): Promise<AnulacionFacturaResult> {
  const isLocalClient = !externalClient;
  const pool = getPool();
  const client = externalClient || (await pool.connect());
  let inTransaction = false;

  try {
    // =========================================================================
    // FASE 1: DESCUBRIMIENTO DE ESQUEMA Y METADATOS (BEFORE BEGIN)
    // El catálogo ANSI information_schema nunca falla ni aborta transacciones.
    // =========================================================================

    // A. Descubrimiento de Tablas existentes en esquema 'admin'
    const tablesRes = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'admin' AND table_name IN ('factura_anulacion', 'motivo_anulacion_factura', 'codigo_sistema', 'facturas', 'detalle_factura', 'movimientos_inventario', 'tipo_movimiento_inventario', 'existencias_producto')`
    );
    const existingTables = new Set((tablesRes.rows || []).map(r => String(r.table_name).toLowerCase()));
    const hasFacturaAnulacionTable = existingTables.has("factura_anulacion");
    const hasMotivoAnulacionTable = existingTables.has("motivo_anulacion_factura");

    // B. Descubrimiento de Columnas reales
    const facColsRes = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'facturas'`
    );
    const facCols = new Set((facColsRes.rows || []).map(r => String(r.column_name).toLowerCase()));

    const detColsRes = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'detalle_factura'`
    );
    const detCols = new Set((detColsRes.rows || []).map(r => String(r.column_name).toLowerCase()));

    const movColsRes = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'movimientos_inventario'`
    );
    const movCols = new Set((movColsRes.rows || []).map(r => String(r.column_name).toLowerCase()));


    // C. Pre-verificación de snapshot existente en admin.factura_anulacion (Obligatoria)
    if (!hasFacturaAnulacionTable) {
      throw new AnulacionFacturaError(
        "TABLA_AUDITORIA_FALTANTE",
        "La tabla de auditoría admin.factura_anulacion es obligatoria para anular facturas. Asegúrese de aplicar la migración 033.",
        500
      );
    }

    const faCheck = await client.query(
      `SELECT factura_anulacion_id FROM admin.factura_anulacion WHERE factura_id = $1`,
      [facturaId]
    );
    if (faCheck.rows && faCheck.rows.length > 0) {
      throw new AnulacionFacturaError(
        "FACTURA_YA_ANULADA",
        "La factura ya cuenta con un registro histórico de anulación.",
        409
      );
    }

    // D. Resolver Motivo de Anulación desde Catálogo (BEFORE BEGIN)
    let motivoRow: {
      motivo_anulacion_factura_id: number;
      codigo: string;
      motivo_anulacion: string;
      descripcion: string | null;
      genera_movimiento: boolean;
      tipo_movimiento_id: number | null;
      codigo_tipo_movimiento?: string | null;
      nombre_tipo_movimiento?: string | null;
      naturaleza?: string | null;
      requiere_observacion: boolean;
      requiere_autorizacion: boolean;
    } | null = null;

    const motivoId = body.motivo_anulacion_factura_id
      ? parseInt(String(body.motivo_anulacion_factura_id), 10)
      : null;

    if (hasMotivoAnulacionTable) {
      if (motivoId && !isNaN(motivoId) && motivoId > 0) {
        const mafRes = await client.query(
          `SELECT
              maf.motivo_anulacion_factura_id,
              maf.codigo,
              maf.motivo_anulacion,
              maf.descripcion,
              maf.genera_movimiento,
              maf.tipo_movimiento_id,
              maf.requiere_observacion,
              maf.requiere_autorizacion,
              tmi.codigo AS codigo_tipo_movimiento,
              tmi.nombre AS nombre_tipo_movimiento,
              tmi.naturaleza
           FROM admin.motivo_anulacion_factura maf
           LEFT JOIN admin.tipo_movimiento_inventario tmi ON maf.tipo_movimiento_id = tmi.tipo_movimiento_id
           WHERE maf.motivo_anulacion_factura_id = $1 AND maf.estado = 'ACTIVO'
           LIMIT 1`,
          [motivoId]
        );
        if (mafRes.rows && mafRes.rows.length > 0) {
          motivoRow = mafRes.rows[0];
        }
      }

      if (!motivoRow && body.motivo && body.motivo.trim()) {
        const mafTextRes = await client.query(
          `SELECT
              maf.motivo_anulacion_factura_id,
              maf.codigo,
              maf.motivo_anulacion,
              maf.descripcion,
              maf.genera_movimiento,
              maf.tipo_movimiento_id,
              maf.requiere_observacion,
              maf.requiere_autorizacion,
              tmi.codigo AS codigo_tipo_movimiento,
              tmi.nombre AS nombre_tipo_movimiento,
              tmi.naturaleza
           FROM admin.motivo_anulacion_factura maf
           LEFT JOIN admin.tipo_movimiento_inventario tmi ON maf.tipo_movimiento_id = tmi.tipo_movimiento_id
           WHERE (LOWER(maf.codigo) = LOWER($1) OR LOWER(maf.motivo_anulacion) = LOWER($1))
             AND maf.estado = 'ACTIVO'
           LIMIT 1`,
          [body.motivo.trim()]
        );
        if (mafTextRes.rows && mafTextRes.rows.length > 0) {
          motivoRow = mafTextRes.rows[0];
        }
      }
    }

    // Fallback defensivo si no existe catálogo en la base de datos
    if (!motivoRow) {
      const fallbackNombre = (body.motivo || "Anulación de Factura").trim();
      const devVentaFallbackRes = await client.query(
        `SELECT tipo_movimiento_id, codigo, nombre, naturaleza
         FROM admin.tipo_movimiento_inventario
         WHERE codigo = 'DEV_VENTA'
         LIMIT 1`
      );
      const fallbackTipoMov = devVentaFallbackRes.rows[0] || null;

      motivoRow = {
        motivo_anulacion_factura_id: 1,
        codigo: "FALLBACK_ANULACION",
        motivo_anulacion: fallbackNombre,
        descripcion: "Motivo genérico de anulación",
        genera_movimiento: true,
        tipo_movimiento_id: fallbackTipoMov ? fallbackTipoMov.tipo_movimiento_id : null,
        codigo_tipo_movimiento: fallbackTipoMov ? fallbackTipoMov.codigo : "DEV_VENTA",
        nombre_tipo_movimiento: fallbackTipoMov ? fallbackTipoMov.nombre : "Devolución de Venta",
        naturaleza: fallbackTipoMov ? fallbackTipoMov.naturaleza : "ENTRADA",
        requiere_observacion: false,
        requiere_autorizacion: false
      };
    }

    // Regla de negocio: Validar motivos sin movimiento
    const codMotivo = String(motivoRow.codigo || "").toUpperCase();
    const nombreMotivo = String(motivoRow.motivo_anulacion || "").toLowerCase();
    const esSinMovimiento =
      codMotivo === "CAMBIO_FORMA_PAGO" ||
      codMotivo === "FACTURA_DUPLICADA" ||
      codMotivo === "AJUSTE_ADMINISTRATIVO" ||
      nombreMotivo.includes("cambio de forma de pago") ||
      nombreMotivo.includes("factura duplicada") ||
      nombreMotivo.includes("sin movimiento") ||
      motivoRow.genera_movimiento === false;

    if (esSinMovimiento) {
      motivoRow.genera_movimiento = false;
      motivoRow.tipo_movimiento_id = null;
    }

    let snapshotTipoMovId: number | null = motivoRow.tipo_movimiento_id ? Number(motivoRow.tipo_movimiento_id) : null;
    let snapshotTipoMovCodigo: string | null = motivoRow.codigo_tipo_movimiento || null;
    let snapshotTipoMovNombre: string | null = motivoRow.nombre_tipo_movimiento || null;

    // Asegurar esquemas y códigos de sistema
    try {
      await ensureEmpresaCodigoSistemaProvisioned(client, empresaId);
      await ensureReversalTraceabilitySchema(client);
    } catch (errProv) {
      console.warn("Could not ensure codigo_sistema or reversal schema provisioned:", errProv);
    }

    // =========================================================================
    // FASE 2: INICIO DE TRANSACCIÓN ATÓMICA DE ANULACIÓN
    // =========================================================================
    if (isLocalClient) {
      await client.query("BEGIN");
      inTransaction = true;
    } else {
      await client.query("SAVEPOINT sp_anular_factura");
      inTransaction = true;
    }

    // 1. Concurrencia segura: Advisory Lock a nivel de transacción
    await client.query("SELECT pg_advisory_xact_lock($1)", [BILLING_ADVISORY_LOCK_ID]);

    // 2. Bloquear fila de factura con FOR UPDATE
    const colFacCodigo = facCols.has("codigo_factura")
      ? "f.codigo_factura"
      : "'FAC-' || f.factura_id::text AS codigo_factura";
    const colFacNumero = facCols.has("numero_factura")
      ? "f.numero_factura"
      : (facCols.has("codigo_factura") ? "f.codigo_factura" : "'FAC-' || f.factura_id::text") + " AS numero_factura";
    const colFacEstado = facCols.has("estado")
      ? "f.estado"
      : (facCols.has("estado_factura") ? "f.estado_factura AS estado" : "'EMITIDA' AS estado");

    const facSql = `
      SELECT
        f.factura_id,
        ${colFacCodigo},
        ${colFacNumero},
        ${colFacEstado},
        ${facCols.has("tipo_factura_id") ? "f.tipo_factura_id" : "NULL::int AS tipo_factura_id"},
        ${facCols.has("orden_trabajo_id") ? "f.orden_trabajo_id" : "NULL::int AS orden_trabajo_id"}
      FROM admin.facturas f
      WHERE f.factura_id = $1 AND f.empresa_id = $2
      FOR UPDATE OF f;
    `;
    const facRows = await client.query(facSql, [facturaId, empresaId]);

    if (!facRows.rows || facRows.rows.length === 0) {
      throw new AnulacionFacturaError(
        "NOT_FOUND",
        "La factura solicitada no existe o no pertenece a su empresa.",
        404
      );
    }

    const factura = facRows.rows[0];

    // 3. Validar si ya está anulada
    if (String(factura.estado).toUpperCase() === "ANULADA") {
      throw new AnulacionFacturaError(
        "FACTURA_YA_ANULADA",
        "La factura ya ha sido anulada previamente.",
        409
      );
    }

    const codigoFactura = factura.codigo_factura || `FAC-${facturaId}`;
    let ordenTrabajoId = factura.orden_trabajo_id ? Number(factura.orden_trabajo_id) : null;
    const observacion = (body.observacion || body.motivo || "").trim();

    let validatedAutorizacionUsuarioId: number | null = usuarioId;
    if (body.usuario_autorizacion_id) {
      const autId = parseInt(String(body.usuario_autorizacion_id), 10);
      if (!isNaN(autId) && autId > 0) {
        validatedAutorizacionUsuarioId = autId;
      }
    }

    const rawDestino = (body.destino_producto || "DISPONIBLE").trim().toUpperCase();
    const allowedDestinos = ["DISPONIBLE", "DAÑADO", "DEFECTUOSO", "CUARENTENA"];
    const destinoProducto = allowedDestinos.includes(rawDestino) ? rawDestino : "DISPONIBLE";

    // 4. Cargar detalle de la factura con columnas seguras
    const exprDetTipoLinea = detCols.has("tipo_linea")
      ? "df.tipo_linea"
      : (detCols.has("tipo_detalle") ? "COALESCE(df.tipo_detalle, 'PRODUCTO')" : "'PRODUCTO'");

    const detSql = `
      SELECT
        df.detalle_factura_id,
        df.factura_id,
        df.producto_id,
        df.cantidad,
        df.precio_unitario,
        df.descripcion,
        ${detCols.has("almacen_id") ? "df.almacen_id" : "NULL::int AS almacen_id"},
        ${exprDetTipoLinea} AS tipo_linea,
        ${detCols.has("orden_producto_id") ? "df.orden_producto_id" : "NULL::int AS orden_producto_id"},
        ${detCols.has("orden_servicio_id") ? "df.orden_servicio_id" : "NULL::int AS orden_servicio_id"},
        ${detCols.has("movimiento_inventario_id") ? "df.movimiento_inventario_id" : "NULL::int AS movimiento_inventario_id"},
        ${detCols.has("costo_unitario") ? "df.costo_unitario" : "NULL::numeric AS costo_unitario"}
      FROM admin.detalle_factura df
      WHERE df.factura_id = $1
      ORDER BY df.detalle_factura_id ASC;
    `;
    const detRows = await client.query(detSql, [facturaId]);
    const lineas = detRows.rows || [];

    if (!ordenTrabajoId) {
      const lineaConOt = lineas.find(l => l.orden_producto_id || l.orden_servicio_id);
      if (lineaConOt && (lineaConOt.orden_producto_id || lineaConOt.orden_servicio_id)) {
        try {
          if (lineaConOt.orden_producto_id) {
            const opRes = await client.query(
              `SELECT orden_trabajo_id FROM admin.orden_productos WHERE orden_producto_id = $1 LIMIT 1`,
              [lineaConOt.orden_producto_id]
            );
            if (opRes.rows.length > 0) {
              ordenTrabajoId = Number(opRes.rows[0].orden_trabajo_id);
            }
          } else if (lineaConOt.orden_servicio_id) {
            const osRes = await client.query(
              `SELECT orden_trabajo_id FROM admin.orden_servicios WHERE orden_servicio_id = $1 LIMIT 1`,
              [lineaConOt.orden_servicio_id]
            );
            if (osRes.rows.length > 0) {
              ordenTrabajoId = Number(osRes.rows[0].orden_trabajo_id);
            }
          }
        } catch (otErr) {
          console.warn("Could not discover orden_trabajo_id from line details:", otErr);
        }
      }
    }

    // 5. MOTOR DE REVERSIÓN DE INVENTARIO BASADO EN TRAZABILIDAD Y REGLAS
    const reversosGenerados: number[] = [];

    // Solo líneas físicas elegibles: PRODUCTO o REPUESTO. Los SERVICIOS nunca generan inventario.
    const lineasFisicas = lineas.filter(l => {
      const tipo = String(l.tipo_linea || "").toUpperCase();
      return (tipo === "PRODUCTO" || tipo === "REPUESTO") && l.producto_id && Number(l.cantidad) > 0;
    });

    const debeRevertirInventario = motivoRow.genera_movimiento && lineasFisicas.length > 0;

    if (debeRevertirInventario) {
      // 5.1. Resolver movimientos origen mediante trazabilidad explícita o fallback histórico estricto
      const resolucion = await resolverMovimientosParaReversionFactura(
        client,
        facturaId,
        empresaId,
        "ANULACION_FACTURA"
      );

      if (!resolucion.exito || !resolucion.movimientos) {
        const status = resolucion.error?.code === "MOVIMIENTO_ORIGEN_AMBIGUO" ? 409 : 422;
        throw new AnulacionFacturaError(
          resolucion.error?.code || "ERROR_REVERSION",
          resolucion.error?.message || "Error al resolver los movimientos para la reversión de inventario.",
          status,
          resolucion.error?.details
        );
      }

      // 5.2. Ejecutar la reversión física de cada movimiento origen
      for (const mov of resolucion.movimientos) {
        const cantRevertir = mov.cantidad;
        if (cantRevertir <= 0) continue;

        // Obtener la regla de reversión configurada (sin IDs hardcodeados)
        const regla = await obtenerReglaReversion(client, mov.tipo_movimiento_origen_id, "ANULACION_FACTURA");
        if (!regla) {
          throw new AnulacionFacturaError(
            "REGLA_REVERSION_NO_CONFIGURADA",
            `No existe regla de reversión configurada para el tipo de movimiento origen #${mov.tipo_movimiento_origen_id} (${mov.tipo_movimiento_origen_codigo}).`,
            422,
            {
              tipo_movimiento_origen_id: mov.tipo_movimiento_origen_id,
              tipo_movimiento_origen_codigo: mov.tipo_movimiento_origen_codigo
            }
          );
        }

        snapshotTipoMovId = regla.tipo_movimiento_reversion_id;
        snapshotTipoMovCodigo = regla.codigo_reversion;
        snapshotTipoMovNombre = regla.nombre_reversion;

        const targetAlmId = mov.almacen_id || 1;
        const costoUnitarioHistorico = mov.costo_unitario_historico;
        const costoTotalHistorico = Number((cantRevertir * costoUnitarioHistorico).toFixed(2));

        let stockActual = 0;
        let nuevoStockActual = 0;

        // Actualizar existencias según destino
        if (destinoProducto === "DISPONIBLE") {
          let exRes = await client.query(
            `SELECT existencia_producto_id, cantidad_actual, cantidad_reservada, costo_promedio
             FROM admin.existencias_producto
             WHERE empresa_id = $1 AND producto_id = $2 AND almacen_id = $3
             FOR UPDATE`,
            [empresaId, mov.producto_id, targetAlmId]
          );

          if (!exRes.rows || exRes.rows.length === 0) {
            const maxExRes = await client.query(
              `SELECT COALESCE(MAX(existencia_producto_id), 0) + 1 AS next_id FROM admin.existencias_producto`
            );
            const nextExId = Number(maxExRes.rows[0]?.next_id) || 1;

            await client.query(
              `INSERT INTO admin.existencias_producto (
                 existencia_producto_id,
                 empresa_id,
                 producto_id,
                 almacen_id,
                 cantidad_actual,
                 cantidad_reservada,
                 costo_promedio,
                 fecha_actualizacion
               ) VALUES ($1, $2, $3, $4, 0, 0, $5, NOW())`,
              [nextExId, empresaId, mov.producto_id, targetAlmId, costoUnitarioHistorico]
            );

            exRes = await client.query(
              `SELECT existencia_producto_id, cantidad_actual, cantidad_reservada, costo_promedio
               FROM admin.existencias_producto
               WHERE existencia_producto_id = $1
               FOR UPDATE`,
              [nextExId]
            );
          }

          const exRow = exRes.rows[0];
          stockActual = Number(exRow.cantidad_actual);
          const costoPromedioActual = Number(exRow.costo_promedio || 0);

          nuevoStockActual = parseFloat((stockActual + cantRevertir).toFixed(4));
          const nuevoCostoPromedio = calcularNuevoPMP(
            stockActual,
            costoPromedioActual,
            cantRevertir,
            costoUnitarioHistorico
          );

          await client.query(
            `UPDATE admin.existencias_producto
             SET cantidad_actual = $1,
                 costo_promedio = $2,
                 fecha_actualizacion = NOW()
             WHERE existencia_producto_id = $3`,
            [nuevoStockActual, nuevoCostoPromedio, exRow.existencia_producto_id]
          );
        } else {
          // Destino no disponible (DAÑADO / DEFECTUOSO / CUARENTENA)
          const exRes = await client.query(
            `SELECT existencia_producto_id, cantidad_actual
             FROM admin.existencias_producto
             WHERE empresa_id = $1 AND producto_id = $2 AND almacen_id = $3`,
            [empresaId, mov.producto_id, targetAlmId]
          );
          stockActual = exRes.rows[0] ? Number(exRes.rows[0].cantidad_actual) : 0;
          nuevoStockActual = stockActual;
        }

        // Generar código de movimiento único
        let codigoMovimientoReverso: string | null = null;
        try {
          codigoMovimientoReverso = await generarCodigoMovimiento(
            client,
            empresaId,
            INVENTORY_SYSTEM_CODES.DEVOLUCION_VENTA
          );
        } catch (errCod) {
          console.warn("Could not generate movement code via function:", errCod);
        }

        // Generar movimiento_inventario_id seguro
        const maxMovRes = await client.query(
          `SELECT COALESCE(MAX(movimiento_inventario_id), 0) + 1 AS next_id FROM admin.movimientos_inventario`
        );
        const nextMovId = Number(maxMovRes.rows[0]?.next_id) || 1;

        // Crear registro reverso en admin.movimientos_inventario
        const movData: Record<string, unknown> = {
          movimiento_inventario_id: nextMovId,
          empresa_id: empresaId,
          almacen_id: targetAlmId,
          producto_id: mov.producto_id,
          tipo_movimiento_id: regla.tipo_movimiento_reversion_id,
          cantidad: cantRevertir,
          costo_unitario: costoUnitarioHistorico,
          costo_total: costoTotalHistorico,
          cantidad_anterior: stockActual,
          cantidad_despues: nuevoStockActual,
          codigo_factura: codigoFactura,
          referencia: `Anulación ${codigoFactura}`,
          codigo_movimiento: codigoMovimientoReverso,
          movimiento_origen_id: mov.movimiento_inventario_id,
          orden_producto_id: mov.orden_producto_id,
          orden_trabajo_id: ordenTrabajoId,
          observacion: observacion
            ? `Reversión por anulación (${motivoRow.motivo_anulacion} - Destino: ${destinoProducto}): ${observacion}`
            : `Reversión por anulación (${motivoRow.motivo_anulacion} - Destino: ${destinoProducto})`,
          usuario_creacion_id: usuarioId,
          usuario_registro: usuarioId,
          fecha_movimiento: new Date(),
          fecha_registro: new Date()
        };

        const validMovEntries = Object.entries(movData).filter(([col]) => movCols.has(col));
        const movColNames = validMovEntries.map(([col]) => col).join(", ");
        const movPlaceholders = validMovEntries.map((_, idx) => `$${idx + 1}`).join(", ");
        const movValues = validMovEntries.map(([, val]) => val);

        await client.query(
          `INSERT INTO admin.movimientos_inventario (${movColNames})
           VALUES (${movPlaceholders})`,
          movValues
        );

        reversosGenerados.push(nextMovId);
      }
    }

    // 6. Registrar snapshot OBLIGATORIO en admin.factura_anulacion
    // Si falla el INSERT, la transacción falla y ejecuta ROLLBACK TOTAL (no se permite factura anulada sin auditoría)
    const totalRevertido = debeRevertirInventario
      ? lineasFisicas.reduce((sum, l) => sum + Number(l.cantidad), 0)
      : 0;

    await client.query(
      `INSERT INTO admin.factura_anulacion (
        empresa_id,
        factura_id,
        motivo_anulacion_factura_id,
        codigo_motivo,
        motivo_anulacion,
        descripcion_motivo,
        genera_movimiento,
        tipo_movimiento_reversion_id,
        codigo_movimiento_reversion,
        nombre_movimiento_reversion,
        destino_producto,
        cantidad_revertida,
        observacion,
        usuario_autorizacion_id,
        usuario_anulacion_id,
        fecha_anulacion,
        fecha_registro
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, clock_timestamp()
      )`,
      [
        empresaId,
        facturaId,
        motivoRow.motivo_anulacion_factura_id || null,
        motivoRow.codigo || "OTRO",
        motivoRow.motivo_anulacion,
        motivoRow.descripcion || null,
        debeRevertirInventario,
        debeRevertirInventario ? snapshotTipoMovId : null,
        debeRevertirInventario ? snapshotTipoMovCodigo : null,
        debeRevertirInventario ? snapshotTipoMovNombre : null,
        debeRevertirInventario ? destinoProducto : null,
        debeRevertirInventario ? totalRevertido : 0,
        observacion || null,
        validatedAutorizacionUsuarioId,
        usuarioId,
        new Date()
      ]
    );

    // 7. Actualizar admin.facturas como ANULADA
    const updateSet: string[] = [];
    if (facCols.has("estado")) {
      updateSet.push("estado = 'ANULADA'");
    }
    if (facCols.has("estado_factura")) {
      updateSet.push("estado_factura = 'ANULADA'");
    }
    if (updateSet.length === 0) {
      updateSet.push("estado = 'ANULADA'");
    }

    const updateParams: (string | number)[] = [facturaId];
    let updateIdx = 2;

    if (facCols.has("motivo_anulacion")) {
      const textoFinalMotivo = observacion
        ? `${motivoRow.motivo_anulacion}: ${observacion}`
        : motivoRow.motivo_anulacion;
      updateSet.push(`motivo_anulacion = $${updateIdx}`);
      updateParams.push(textoFinalMotivo);
      updateIdx++;
    }

    if (facCols.has("fecha_anulacion")) {
      updateSet.push(`fecha_anulacion = NOW()`);
    }

    if (facCols.has("usuario_anulacion_id")) {
      updateSet.push(`usuario_anulacion_id = $${updateIdx}`);
      updateParams.push(usuarioId);
      updateIdx++;
    }

    if (facCols.has("fecha_modificacion")) {
      updateSet.push(`fecha_modificacion = NOW()`);
    }

    if (facCols.has("usuario_modificacion_id")) {
      updateSet.push(`usuario_modificacion_id = $${updateIdx}`);
      updateParams.push(usuarioId);
      updateIdx++;
    }

    await client.query(
      `UPDATE admin.facturas
       SET ${updateSet.join(", ")}
       WHERE factura_id = $1 AND empresa_id = $${updateIdx}`,
      [...updateParams, empresaId]
    );

    // 8. Commit final
    if (isLocalClient) {
      await client.query("COMMIT");
      inTransaction = false;
    } else {
      await client.query("RELEASE SAVEPOINT sp_anular_factura");
      inTransaction = false;
    }

    return {
      success: true,
      message: "Factura anulada exitosamente.",
      data: {
        factura_id: facturaId,
        codigo_factura: codigoFactura,
        estado: "ANULADA",
        motivo_anulacion: motivoRow.motivo_anulacion,
        motivo_codigo: motivoRow.codigo,
        observacion,
        destino_producto: destinoProducto,
        reversos_inventario: reversosGenerados.length,
        movimientos_reversados: reversosGenerados
      }
    };
  } catch (err: unknown) {
    if (inTransaction) {
      if (isLocalClient) {
        await client.query("ROLLBACK").catch(() => {});
      } else {
        await client.query("ROLLBACK TO SAVEPOINT sp_anular_factura").catch(() => {});
      }
    }
    throw err;
  } finally {
    if (isLocalClient) {
      client.release();
    }
  }
}

export async function POST(request: NextRequest, context: RouteParams) {
  const session = await getWorkshopSession();
  if (!session || !session.empresa_id || !session.usuario_id) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
      { status: 401 }
    );
  }

  const perms = await getModulePermissions("FACTURACION", session.usuario_id);
  if (!perms.puede_eliminar && !perms.puede_inactivar && !perms.puede_editar) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "No tienes permisos para anular facturas en el sistema." },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const facturaId = parseInt(id, 10);
  if (isNaN(facturaId) || facturaId <= 0) {
    return NextResponse.json(
      { error: "INVALID_ID", message: "Identificador de factura no válido." },
      { status: 400 }
    );
  }

  let body: AnularFacturaBody = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "El cuerpo de la petición debe ser un objeto JSON válido." },
      { status: 400 }
    );
  }

  try {
    const result = await anularFactura(facturaId, session.empresa_id, session.usuario_id, body);
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof AnulacionFacturaError) {
      return NextResponse.json(
        { error: err.code, message: err.message, details: err.details },
        { status: err.statusCode }
      );
    }
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Error en POST /api/facturacion/facturas/[id]/anular:", err);

    if (errorMsg.includes("CATALOGO_DEV_VENTA_NO_CONFIGURADO")) {
      return NextResponse.json(
        {
          error: "CATALOGO_DEV_VENTA_NO_CONFIGURADO",
          message: "El tipo de movimiento DEV_VENTA no está configurado en el catálogo del sistema.",
          details: errorMsg
        },
        { status: 500 }
      );
    }

    if (errorMsg.includes("INVENTARIO_FACTURA_INCONSISTENTE")) {
      return NextResponse.json(
        {
          error: "INVENTARIO_FACTURA_INCONSISTENTE",
          message: "No se encontró la salida original de inventario de uno o más productos de la factura.",
          details: errorMsg
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: "ERROR_ANULAR_FACTURA",
        message: "Ocurrió un error al anular la factura y procesar los reversos de inventario.",
        details: errorMsg
      },
      { status: 500 }
    );
  }
}
