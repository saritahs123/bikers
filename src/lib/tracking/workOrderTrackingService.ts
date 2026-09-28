/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto";
import QRCode from "qrcode";
import { query } from "@/lib/db";
import { PoolClient } from "pg";
import {
  resolvePipelineStep,
  getPipelineStatusMessage,
  ResolvedPipelineStep,
} from "@/lib/workshop/workOrderPipelineConfig";

export interface WorkOrderTrackingRecord {
  orden_tracking_id: number;
  orden_trabajo_id: number;
  public_token: string;
  short_code: string;
  token_hash: string;
  activo: boolean;
  fecha_creacion: Date | string;
  fecha_ultimo_acceso: Date | string | null;
  fecha_desactivacion: Date | string | null;
  usuario_registro: number | null;
}

export interface WorkOrderTrackingInfo {
  ordenTrackingId: number;
  ordenTrabajoId: number;
  publicToken: string;
  shortCode: string;
  token: string; // Alias for backward compatibility
  tokenHash: string;
  activo: boolean;
  publicUrl: string;
  qrDataUrl?: string;
  fechaCreacion: string;
  fechaUltimoAcceso: string | null;
  fechaDesactivacion: string | null;
}

export interface PublicWorkOrderDTO {
  codigoOrden: string;
  estado: string;
  estadoLabel: string;
  estadoColor: string;
  pasoActual: number;
  pasosTotales: number;
  esEntregada: boolean;
  isHold: boolean;
  pipelineSteps: ResolvedPipelineStep[];
  statusMessage: string;
  fechaRecepcion: string;
  fechaPrometidaEstimada: string | null;
  fechaEntregaReal: string | null;
  ultimaActualizacion: string;
  clienteNombre: string | null;
  bicicleta: {
    marca: string | null;
    modelo: string | null;
    tipo: string | null;
    color: string | null;
    ano: number | null;
    anio?: number | null;
    fotoUrl: string | null;
  };
  timeline: Array<{
    id: number;
    estadoCodigo: string;
    estadoLabel: string;
    color: string;
    fecha: string;
    comentario: string;
    esEstadoActual: boolean;
  }>;
  servicios: Array<{
    secuencia: number;
    nombre: string;
    estado: string;
    estadoLabel: string;
    completado: boolean;
  }>;
}

const BASE62_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Generates an unpredictable, URL-safe Base62 short code (8 characters by default).
 * Has ~2.18 * 10^14 combinations without modulo bias.
 * Decoupled completely from IDs, sequences, or order codes.
 */
export function generateShortCode(length = 8): string {
  let result = "";
  const bytes = crypto.randomBytes(length * 2);
  let byteIndex = 0;
  while (result.length < length && byteIndex < bytes.length) {
    const byte = bytes[byteIndex++];
    // 62 * 4 = 248. Discard >= 248 to avoid modulo bias
    if (byte < 248) {
      result += BASE62_CHARS[byte % 62];
    }
  }
  while (result.length < length) {
    const extraByte = crypto.randomBytes(1)[0];
    if (extraByte < 248) {
      result += BASE62_CHARS[extraByte % 62];
    }
  }
  return result;
}

/**
 * Generates a cryptographically random, unpredictable 32-byte (64 hex characters) public token.
 * Decoupled from IDs, codes, or predictable sequences.
 */
export function generateCryptographicToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Computes the SHA-256 hash of the tracking token for secure validation and integrity.
 */
export function hashTrackingToken(token: string): string {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * Resolves the public base URL for tracking links dynamically without hardcoded domains.
 */
export function getPublicTrackingBaseUrl(requestOrigin?: string | null): string {
  if (requestOrigin && !requestOrigin.includes("undefined")) {
    return requestOrigin.replace(/\/$/, "");
  }
  const envUrl =
    process.env.APP_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

/**
 * Generates dynamic QR code data URL (PNG format) from tracking URL.
 */
export async function generateTrackingQrDataUrl(url: string): Promise<string> {
  return await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });
}

/**
 * Generates dynamic QR code SVG string from tracking URL.
 */
export async function generateTrackingQrSvg(url: string): Promise<string> {
  return await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
  });
}

/**
 * Ensures a work order has an active tracking record with persistent short_code.
 * If one exists, reuses the existing short_code without generating a new link.
 * If not, creates one atomically.
 */
export async function ensureWorkOrderTracking(
  ordenTrabajoId: number,
  usuarioRegistroId?: number | null,
  client?: PoolClient,
  requestOrigin?: string | null
): Promise<WorkOrderTrackingInfo> {
  const runQuery = async <T = any>(sql: string, params: unknown[] = []): Promise<T[]> => {
    if (client) {
      const res = await client.query(sql, params);
      return res.rows as T[];
    }
    return await query<T>(sql, params);
  };

  const baseUrl = getPublicTrackingBaseUrl(requestOrigin);

  // 1. Check if tracking record already exists
  const existingRows = await runQuery<WorkOrderTrackingRecord>(
    `SELECT 
       orden_tracking_id,
       orden_trabajo_id,
       public_token,
       short_code,
       token_hash,
       activo,
       fecha_creacion,
       fecha_ultimo_acceso,
       fecha_desactivacion,
       usuario_registro
     FROM admin.orden_tracking
     WHERE orden_trabajo_id = $1`,
    [ordenTrabajoId]
  );

  if (existingRows.length > 0) {
    const row = existingRows[0];

    // If both short_code and public_token exist, reuse them directly
    if (row.short_code && row.public_token) {
      return {
        ordenTrackingId: row.orden_tracking_id,
        ordenTrabajoId: row.orden_trabajo_id,
        publicToken: row.public_token,
        shortCode: row.short_code,
        token: row.short_code,
        tokenHash: row.token_hash,
        activo: row.activo,
        publicUrl: `${baseUrl}/${row.short_code}`,
        fechaCreacion: new Date(row.fecha_creacion).toISOString(),
        fechaUltimoAcceso: row.fecha_ultimo_acceso ? new Date(row.fecha_ultimo_acceso).toISOString() : null,
        fechaDesactivacion: row.fecha_desactivacion ? new Date(row.fecha_desactivacion).toISOString() : null,
      };
    }

    // Failsafe backfill for any legacy record lacking short_code or public_token
    const finalShortCode = row.short_code || generateShortCode(8);
    const finalPublicToken = row.public_token || generateCryptographicToken();
    const finalHash = row.token_hash || hashTrackingToken(finalPublicToken);

    await runQuery(
      `UPDATE admin.orden_tracking
       SET short_code = $1, public_token = $2, token_hash = $3
       WHERE orden_tracking_id = $4`,
      [finalShortCode, finalPublicToken, finalHash, row.orden_tracking_id]
    );

    return {
      ordenTrackingId: row.orden_tracking_id,
      ordenTrabajoId: row.orden_trabajo_id,
      publicToken: finalPublicToken,
      shortCode: finalShortCode,
      token: finalShortCode,
      tokenHash: finalHash,
      activo: row.activo,
      publicUrl: `${baseUrl}/${finalShortCode}`,
      fechaCreacion: new Date(row.fecha_creacion).toISOString(),
      fechaUltimoAcceso: row.fecha_ultimo_acceso ? new Date(row.fecha_ultimo_acceso).toISOString() : null,
      fechaDesactivacion: row.fecha_desactivacion ? new Date(row.fecha_desactivacion).toISOString() : null,
    };
  }

  // 2. Create new tracking record with random short_code, public_token and its sha256 hash
  const shortCode = generateShortCode(8);
  const publicToken = generateCryptographicToken();
  const tokenHash = hashTrackingToken(publicToken);

  const insertSql = `
    INSERT INTO admin.orden_tracking (
      orden_trabajo_id,
      public_token,
      short_code,
      token_hash,
      activo,
      fecha_creacion,
      usuario_registro
    ) VALUES ($1, $2, $3, $4, true, clock_timestamp(), $5)
    ON CONFLICT (orden_trabajo_id) DO UPDATE SET
      activo = true
    RETURNING 
      orden_tracking_id,
      orden_trabajo_id,
      public_token,
      short_code,
      token_hash,
      activo,
      fecha_creacion,
      fecha_ultimo_acceso,
      fecha_desactivacion,
      usuario_registro
  `;

  const insertedRows = await runQuery<WorkOrderTrackingRecord>(insertSql, [
    ordenTrabajoId,
    publicToken,
    shortCode,
    tokenHash,
    usuarioRegistroId || null,
  ]);

  const record = insertedRows[0];
  const finalCode = record.short_code || shortCode;
  const finalToken = record.public_token || publicToken;

  return {
    ordenTrackingId: record.orden_tracking_id,
    ordenTrabajoId: record.orden_trabajo_id,
    publicToken: finalToken,
    shortCode: finalCode,
    token: finalCode,
    tokenHash: record.token_hash,
    activo: record.activo,
    publicUrl: `${baseUrl}/${finalCode}`,
    fechaCreacion: new Date(record.fecha_creacion).toISOString(),
    fechaUltimoAcceso: record.fecha_ultimo_acceso ? new Date(record.fecha_ultimo_acceso).toISOString() : null,
    fechaDesactivacion: record.fecha_desactivacion ? new Date(record.fecha_desactivacion).toISOString() : null,
  };
}

/**
 * Regenerates the tracking link for a work order, immediately invalidating the previous code and token.
 * Generates a new short_code, new public_token and new token_hash and persists in a single query.
 */
export async function regenerateWorkOrderTracking(
  ordenTrabajoId: number,
  usuarioId?: number | null,
  requestOrigin?: string | null
): Promise<WorkOrderTrackingInfo> {
  const newShortCode = generateShortCode(8);
  const newPublicToken = generateCryptographicToken();
  const newTokenHash = hashTrackingToken(newPublicToken);
  const baseUrl = getPublicTrackingBaseUrl(requestOrigin);

  const updateSql = `
    INSERT INTO admin.orden_tracking (
      orden_trabajo_id,
      public_token,
      short_code,
      token_hash,
      activo,
      fecha_creacion,
      usuario_registro
    ) VALUES ($1, $2, $3, $4, true, clock_timestamp(), $5)
    ON CONFLICT (orden_trabajo_id) DO UPDATE SET
      public_token = EXCLUDED.public_token,
      short_code = EXCLUDED.short_code,
      token_hash = EXCLUDED.token_hash,
      activo = true,
      fecha_creacion = EXCLUDED.fecha_creacion,
      fecha_desactivacion = NULL
    RETURNING 
      orden_tracking_id,
      orden_trabajo_id,
      public_token,
      short_code,
      token_hash,
      activo,
      fecha_creacion,
      fecha_ultimo_acceso,
      fecha_desactivacion
  `;

  const res = await query<any>(updateSql, [
    ordenTrabajoId,
    newPublicToken,
    newShortCode,
    newTokenHash,
    usuarioId || null,
  ]);

  const record = res[0];
  const finalCode = record.short_code || newShortCode;

  return {
    ordenTrackingId: record.orden_tracking_id,
    ordenTrabajoId: record.orden_trabajo_id,
    publicToken: record.public_token,
    shortCode: finalCode,
    token: finalCode,
    tokenHash: record.token_hash,
    activo: record.activo,
    publicUrl: `${baseUrl}/${finalCode}`,
    fechaCreacion: new Date(record.fecha_creacion).toISOString(),
    fechaUltimoAcceso: record.fecha_ultimo_acceso ? new Date(record.fecha_ultimo_acceso).toISOString() : null,
    fechaDesactivacion: record.fecha_desactivacion ? new Date(record.fecha_desactivacion).toISOString() : null,
  };
}

/**
 * Deactivates tracking for a work order without deleting the short code.
 * Any public attempt to access it will return a generic 404.
 */
export async function deactivateWorkOrderTracking(
  ordenTrabajoId: number
): Promise<{ success: boolean; activo: boolean }> {
  const updateSql = `
    UPDATE admin.orden_tracking
    SET activo = false,
        fecha_desactivacion = clock_timestamp()
    WHERE orden_trabajo_id = $1
    RETURNING orden_tracking_id, activo
  `;
  const res = await query<any>(updateSql, [ordenTrabajoId]);
  return {
    success: res.length > 0,
    activo: false,
  };
}

/**
 * Reactivates tracking for a work order, maintaining the same short_code if not regenerated.
 */
export async function activateWorkOrderTracking(
  ordenTrabajoId: number,
  requestOrigin?: string | null
): Promise<WorkOrderTrackingInfo> {
  const baseUrl = getPublicTrackingBaseUrl(requestOrigin);

  const res = await query<any>(
    `UPDATE admin.orden_tracking
     SET activo = true,
         fecha_desactivacion = NULL
     WHERE orden_trabajo_id = $1
     RETURNING
       orden_tracking_id,
       orden_trabajo_id,
       public_token,
       short_code,
       token_hash,
       activo,
       fecha_creacion,
       fecha_ultimo_acceso,
       fecha_desactivacion`,
    [ordenTrabajoId]
  );

  if (res && res.length > 0) {
    const row = res[0];
    const finalCode = row.short_code || generateShortCode(8);

    // If short_code was missing, ensure it's saved
    if (!row.short_code) {
      await query(
        `UPDATE admin.orden_tracking SET short_code = $1 WHERE orden_tracking_id = $2`,
        [finalCode, row.orden_tracking_id]
      );
    }

    return {
      ordenTrackingId: row.orden_tracking_id,
      ordenTrabajoId: row.orden_trabajo_id,
      publicToken: row.public_token,
      shortCode: finalCode,
      token: finalCode,
      tokenHash: row.token_hash,
      activo: true,
      publicUrl: `${baseUrl}/${finalCode}`,
      fechaCreacion: new Date(row.fecha_creacion).toISOString(),
      fechaUltimoAcceso: row.fecha_ultimo_acceso ? new Date(row.fecha_ultimo_acceso).toISOString() : null,
      fechaDesactivacion: null,
    };
  }

  return await ensureWorkOrderTracking(ordenTrabajoId, null, undefined, requestOrigin);
}

/**
 * Friendly translation for service status codes.
 */
export function translateServiceStatus(rawCode?: string, rawName?: string): {
  label: string;
  completado: boolean;
} {
  const code = (rawCode || "").trim().toUpperCase();
  const name = (rawName || "").trim().toUpperCase();

  if (code === "COMPLETADO" || name === "COMPLETADO") {
    return { label: "Completado", completado: true };
  }
  if (code === "EN_PROCESO" || name === "EN PROCESO") {
    return { label: "En proceso", completado: false };
  }
  if (code === "CANCELADO" || name === "CANCELADO") {
    return { label: "Cancelado", completado: false };
  }
  if (code === "SUSPENDIDO" || name === "SUSPENDIDO") {
    return { label: "En pausa", completado: false };
  }

  return { label: "Pendiente", completado: false };
}

/**
 * Fetches secure public DTO for an order by its short code or tracking token.
 * Validates by short_code, token_hash, or public_token.
 * Returns null if invalid or inactive (allowing generic 404).
 */
export async function getPublicTrackingData(
  codeOrToken: string
): Promise<PublicWorkOrderDTO | null> {
  if (!codeOrToken || typeof codeOrToken !== "string" || codeOrToken.trim().length < 6) {
    return null;
  }

  const clean = codeOrToken.trim();
  const tokenHash = hashTrackingToken(clean);

  // 1. Verify tracking record by short_code, token_hash, or public_token
  const trackingRes = await query<any>(
    `SELECT 
       orden_tracking_id,
       orden_trabajo_id,
       public_token,
       short_code,
       token_hash,
       activo
     FROM admin.orden_tracking
     WHERE (short_code = $1 OR token_hash = $2 OR public_token = $1)`,
    [clean, tokenHash]
  );

  if (!trackingRes || trackingRes.length === 0) {
    return null;
  }

  const tracking = trackingRes[0];
  if (!tracking.activo) {
    return null;
  }

  // Asynchronously record last access time
  query(
    `UPDATE admin.orden_tracking 
     SET fecha_ultimo_acceso = clock_timestamp() 
     WHERE orden_tracking_id = $1`,
    [tracking.orden_tracking_id]
  ).catch((err) => {
    console.error("Error updating fecha_ultimo_acceso:", err);
  });

  const ordenTrabajoId = tracking.orden_trabajo_id;

  // 2. Query work order details safely
  const orderRes = await query<any>(
    `SELECT 
       ot.orden_trabajo_id,
       ot.codigo_orden,
       ot.fecha_recepcion,
       ot.fecha_entrega_estimada,
       ot.fecha_entrega_real,
       ot.fecha_actualizacion,
       ot.fecha_registro,
       ot.descripcion_cliente,
       ot.diagnostico_inicial,
       ot.estado_orden_id,
       eot.codigo AS estado_codigo,
       eot.nombre AS estado_nombre,
       eot.color_estado AS estado_color,
       COALESCE(NULLIF(TRIM(b_ot.marca), ''), NULLIF(TRIM(b_rec.marca), '')) AS bicicleta_marca,
       COALESCE(NULLIF(TRIM(b_ot.modelo), ''), NULLIF(TRIM(b_rec.modelo), '')) AS bicicleta_modelo,
       COALESCE(NULLIF(TRIM(b_ot.tipo_bicicleta), ''), NULLIF(TRIM(b_rec.tipo_bicicleta), '')) AS tipo_bicicleta,
       COALESCE(NULLIF(TRIM(b_ot.color), ''), NULLIF(TRIM(b_rec.color), '')) AS bicicleta_color,
       COALESCE(b_ot.ano, b_rec.ano) AS bicicleta_ano,
       COALESCE(ot.bicicleta_id, r.bicicleta_id) AS bicicleta_id,
       COALESCE(
         NULLIF(TRIM(c_ot.nombre_completo), ''),
         NULLIF(TRIM(CONCAT_WS(' ', c_ot.nombre, c_ot.apellido)), ''),
         NULLIF(TRIM(c_rec.nombre_completo), ''),
         NULLIF(TRIM(CONCAT_WS(' ', c_rec.nombre, c_rec.apellido)), '')
       ) AS cliente_nombre
     FROM admin.ordenes_trabajo ot
     JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
     LEFT JOIN admin.recepciones r ON ot.recepcion_id = r.recepcion_id
     LEFT JOIN admin.clientes c_ot ON ot.cliente_id = c_ot.cliente_id
     LEFT JOIN admin.clientes c_rec ON r.cliente_id = c_rec.cliente_id
     LEFT JOIN admin.bicicletas b_ot ON ot.bicicleta_id = b_ot.bicicleta_id
     LEFT JOIN admin.bicicletas b_rec ON r.bicicleta_id = b_rec.bicicleta_id
     WHERE ot.orden_trabajo_id = $1 AND ot.activo = true`,
    [ordenTrabajoId]
  );

  if (!orderRes || orderRes.length === 0) {
    return null;
  }

  const order = orderRes[0];

  // Resolve pipeline step and message using canonical workshop pipeline config
  const pipelineRes = resolvePipelineStep(order.estado_codigo, order.estado_orden_id);
  const statusMessage = getPipelineStatusMessage(order.estado_codigo, order.estado_nombre);

  // 3. Query bicycle main photo if available
  let fotoUrl: string | null = null;
  if (order.bicicleta_id) {
    const fotoRes = await query<any>(
      `SELECT url_archivo, ruta_archivo
       FROM admin.bicicleta_fotos
       WHERE bicicleta_id = $1 AND activo = true
       ORDER BY es_principal DESC, orden_visual ASC, bicicleta_foto_id ASC
       LIMIT 1`,
      [order.bicicleta_id]
    );
    if (fotoRes && fotoRes.length > 0) {
      fotoUrl = fotoRes[0].url_archivo || fotoRes[0].ruta_archivo || null;
    }
  }

  // 4. Query visible services (only friendly names & statuses)
  const servRes = await query<any>(
    `SELECT 
       os.secuencia,
       COALESCE(ts.nombre, os.descripcion_servicio, 'Servicio de Taller') AS nombre_servicio,
       eos.codigo AS estado_servicio_codigo,
       eos.nombre AS estado_servicio_nombre
     FROM admin.orden_servicios os
     LEFT JOIN admin.tipo_servicio ts ON os.tipo_servicio_id = ts.tipo_servicio_id
     LEFT JOIN admin.estado_orden_servicio eos ON os.estado_orden_servicio_id = eos.estado_orden_servicio_id
     WHERE os.orden_trabajo_id = $1 AND (os.activo IS DISTINCT FROM false)
     ORDER BY os.secuencia ASC, os.orden_servicio_id ASC`,
    [ordenTrabajoId]
  );

  const servicios = (servRes || []).map((s: any, idx: number) => {
    const srvTrans = translateServiceStatus(s.estado_servicio_codigo, s.estado_servicio_nombre);
    return {
      secuencia: s.secuencia || idx + 1,
      nombre: s.nombre_servicio,
      estado: s.estado_servicio_codigo || "PENDIENTE",
      estadoLabel: srvTrans.label,
      completado: srvTrans.completado,
    };
  });

  // 5. Query state history for public timeline
  const histRes = await query<any>(
    `SELECT 
       ohe.orden_historial_estado_id,
       e2.codigo AS estado_codigo,
       e2.nombre AS estado_nombre,
       e2.color_estado,
       COALESCE(ohe.fecha_cambio, ohe.fecha_registro) AS fecha,
       ohe.comentario
     FROM admin.orden_historial_estado ohe
     JOIN admin.estado_orden_trabajo e2 ON ohe.estado_nuevo_id = e2.estado_orden_id
     WHERE ohe.orden_trabajo_id = $1 AND (ohe.activo IS DISTINCT FROM false)
     ORDER BY COALESCE(ohe.fecha_cambio, ohe.fecha_registro) ASC, ohe.orden_historial_estado_id ASC`,
    [ordenTrabajoId]
  );

  const timeline = (histRes || []).map((h: any, idx: number) => {
    const stepResolution = resolvePipelineStep(h.estado_codigo);
    const isCurrent = idx === histRes.length - 1;
    return {
      id: h.orden_historial_estado_id,
      estadoCodigo: h.estado_codigo,
      estadoLabel: stepResolution.currentStepLabel,
      color: stepResolution.activeColor,
      fecha: new Date(h.fecha).toISOString(),
      comentario: stepResolution.currentStepLabel,
      esEstadoActual: isCurrent,
    };
  });

  // If timeline is empty, provide initial entry from order creation
  if (timeline.length === 0) {
    timeline.push({
      id: 1,
      estadoCodigo: order.estado_codigo,
      estadoLabel: pipelineRes.currentStepLabel,
      color: pipelineRes.activeColor,
      fecha: new Date(order.fecha_recepcion || order.fecha_registro).toISOString(),
      comentario: pipelineRes.currentStepLabel,
      esEstadoActual: true,
    });
  }

  const isDelivered = pipelineRes.currentStepIndex === 4;
  const ultimaActualizacion = order.fecha_actualizacion || timeline[timeline.length - 1]?.fecha || order.fecha_recepcion;

  return {
    codigoOrden: order.codigo_orden,
    estado: order.estado_codigo,
    estadoLabel: pipelineRes.currentStepLabel,
    estadoColor: pipelineRes.activeColor,
    pasoActual: pipelineRes.currentStepIndex,
    pasosTotales: 4,
    esEntregada: isDelivered,
    isHold: pipelineRes.isHold,
    pipelineSteps: pipelineRes.steps,
    statusMessage,
    fechaRecepcion: new Date(order.fecha_recepcion).toISOString(),
    fechaPrometidaEstimada: order.fecha_entrega_estimada ? new Date(order.fecha_entrega_estimada).toISOString() : null,
    fechaEntregaReal: order.fecha_entrega_real ? new Date(order.fecha_entrega_real).toISOString() : null,
    ultimaActualizacion: new Date(ultimaActualizacion).toISOString(),
    clienteNombre: order.cliente_nombre ? order.cliente_nombre.trim() : null,
    bicicleta: {
      marca: order.bicicleta_marca || null,
      modelo: order.bicicleta_modelo || null,
      tipo: order.tipo_bicicleta || null,
      color: order.bicicleta_color || null,
      ano: order.bicicleta_ano ? Number(order.bicicleta_ano) : null,
      anio: order.bicicleta_ano ? Number(order.bicicleta_ano) : null,
      fotoUrl,
    },
    timeline,
    servicios,
  };
}
