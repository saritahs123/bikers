/**
 * WORK ORDER SMS NOTIFICATION SERVICE
 * Handles business logic, idempotency, phone normalization, public tracking URL resolution,
 * batch status tracking, and audit persistence for work order SMS notifications via TextBee.
 */

import { query } from "@/lib/db";
import {
  sendTextBeeSms,
  getTextBeeBatchStatus,
  TextBeeSendSmsResult,
} from "./textBeeSmsService";
import {
  ensureWorkOrderTracking,
} from "@/lib/tracking/workOrderTrackingService";

export type NotificationType = "BIENVENIDA" | "ESTADO" | "CIERRE";
export type DeliveryStatus = "PENDIENTE" | "ENVIADO" | "ENTREGADO" | "ERROR" | "NO_ENVIADO";

export interface SendNotificationParams {
  ordenTrabajoId: number;
  usuarioId?: number | null;
  empresaId?: number | null;
  baseUrl?: string | null;
}

export interface SendNotificationResult {
  success: boolean;
  tipoNotificacion: NotificationType;
  estadoEnvio: DeliveryStatus;
  estadoProveedor?: string | null;
  smsBatchId?: string | null;
  skipped?: boolean;
  missingPhone?: boolean;
  message?: string;
  errorMessage?: string | null;
  statusCode?: number | null;
}

const MAX_SMS_LENGTH = 128;

/**
 * Normalizes phone numbers to standard E.164 format.
 * Specifically handles Dominican Republic numbers (809, 829, 849) and existing formats.
 * Does not mutate database records.
 */
export function normalizeDominicanPhone(rawPhone?: string | null): string | null {
  if (!rawPhone || typeof rawPhone !== "string") return null;

  const trimmed = rawPhone.trim();
  const digits = trimmed.replace(/\D/g, "");

  // 10 digits (e.g. 8095551234, 8295551234, 8495551234)
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // 11 digits starting with country code 1 (e.g. 18095551234)
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // International standard E.164 already prefixed with +
  if (trimmed.startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

/**
 * Builds the canonical official message for each notification event.
 * Strictly adheres to official templates:
 * - BIENVENIDA: Ridelab: Tu orden {codigo_orden} ha sido creada. Consúltala aquí: {url}
 * - ESTADO:     Ridelab: Tu orden {codigo_orden} ha sido actualizada. Consúltala aquí: {url}
 * - CIERRE:     Ridelab: Tu orden {codigo_orden} ha sido completada. Consúltala aquí: {url}
 */
export function buildNotificationMessage(
  tipo: NotificationType,
  codigoOrden: string,
  url: string
): string {
  switch (tipo) {
    case "BIENVENIDA":
      return `Ridelab: Tu orden ${codigoOrden} ha sido creada. Consúltala aquí: ${url}`;
    case "ESTADO":
      return `Ridelab: Tu orden ${codigoOrden} ha sido actualizada. Consúltala aquí: ${url}`;
    case "CIERRE":
      return `Ridelab: Tu orden ${codigoOrden} ha sido completada. Consúltala aquí: ${url}`;
    default:
      throw new Error(`Tipo de notificación no soportado: ${tipo}`);
  }
}

/**
 * Records an entry into the audit table admin.notificacion_orden_trabajo.
 * Never throws exceptions that break the calling workflow.
 */
async function recordNotificationAudit({
  empresaId,
  ordenTrabajoId,
  tipoNotificacion,
  telefonoDestino,
  mensaje,
  estadoEnvio,
  estadoProveedor = null,
  textbeeBatchId = null,
  codigoHttp = null,
  respuestaProveedor = null,
  errorMensaje = null,
  fechaEnvio = null,
  usuarioRegistro = null,
}: {
  empresaId: number;
  ordenTrabajoId: number;
  tipoNotificacion: NotificationType;
  telefonoDestino: string | null;
  mensaje: string;
  estadoEnvio: DeliveryStatus;
  estadoProveedor?: string | null;
  textbeeBatchId?: string | null;
  codigoHttp?: number | null;
  respuestaProveedor?: unknown;
  errorMensaje?: string | null;
  fechaEnvio?: Date | null;
  usuarioRegistro?: number | null;
}): Promise<number | null> {
  try {
    const res = await query<{ notificacion_orden_trabajo_id: number }>(
      `INSERT INTO admin.notificacion_orden_trabajo (
        empresa_id,
        orden_trabajo_id,
        tipo_notificacion,
        telefono_destino,
        mensaje,
        estado_envio,
        estado_proveedor,
        textbee_batch_id,
        codigo_http,
        respuesta_proveedor,
        error_mensaje,
        fecha_envio,
        fecha_registro,
        usuario_registro
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13
      ) RETURNING notificacion_orden_trabajo_id`,
      [
        empresaId,
        ordenTrabajoId,
        tipoNotificacion,
        telefonoDestino,
        mensaje,
        estadoEnvio,
        estadoProveedor,
        textbeeBatchId,
        codigoHttp,
        respuestaProveedor ? JSON.stringify(respuestaProveedor) : null,
        errorMensaje,
        fechaEnvio,
        usuarioRegistro,
      ]
    );
    return res[0]?.notificacion_orden_trabajo_id || null;
  } catch (auditErr) {
    console.error("Error al registrar auditoría de notificación SMS:", auditErr);
    return null;
  }
}

/**
 * Status priority hierarchy to prevent state degradation (Section 3).
 * PENDIENTE (1) < ENVIADO (2) < ENTREGADO (3)
 */
export const STATUS_PRIORITY: Record<DeliveryStatus, number> = {
  NO_ENVIADO: 0,
  ERROR: 0,
  PENDIENTE: 1,
  ENVIADO: 2,
  ENTREGADO: 3,
};

/**
 * Updates an audit record with provider batch inquiry results.
 * Respects status hierarchy: never downgrades ENTREGADO -> ENVIADO/PENDIENTE, nor ENVIADO -> PENDIENTE.
 */
async function updateNotificationAudit({
  notificacionId,
  estadoEnvio,
  estadoProveedor,
  respuestaProveedor,
  fechaEnvio = null,
  errorMensaje = null,
}: {
  notificacionId: number;
  estadoEnvio: DeliveryStatus;
  estadoProveedor: string | null;
  respuestaProveedor?: unknown;
  fechaEnvio?: Date | null;
  errorMensaje?: string | null;
}): Promise<void> {
  try {
    await query(
      `UPDATE admin.notificacion_orden_trabajo
       SET estado_envio = CASE
             WHEN estado_envio = 'ENTREGADO' THEN 'ENTREGADO'
             WHEN estado_envio = 'ENVIADO' AND $1 IN ('PENDIENTE', 'ERROR') THEN 'ENVIADO'
             ELSE $1
           END,
           estado_proveedor = $2,
           respuesta_proveedor = COALESCE($3, respuesta_proveedor),
           fecha_envio = COALESCE($4, fecha_envio),
           error_mensaje = COALESCE($5, error_mensaje),
           fecha_actualizacion = NOW()
       WHERE notificacion_orden_trabajo_id = $6`,
      [
        estadoEnvio,
        estadoProveedor,
        respuestaProveedor ? JSON.stringify(respuestaProveedor) : null,
        fechaEnvio,
        errorMensaje,
        notificacionId,
      ]
    );
  } catch (err) {
    console.error("Error al actualizar auditoría de notificación SMS:", err);
  }
}

/**
 * Core notification dispatcher handling data gathering, phone validation,
 * idempotency checks, TextBee SMS transmission, batch status verification, and audit logging.
 */
export async function sendWorkOrderSmsNotification(
  tipo: NotificationType,
  { ordenTrabajoId, usuarioId = null, empresaId = null }: SendNotificationParams
): Promise<SendNotificationResult> {
  try {
    if (!ordenTrabajoId || isNaN(Number(ordenTrabajoId))) {
      return {
        success: false,
        tipoNotificacion: tipo,
        estadoEnvio: "NO_ENVIADO",
        errorMessage: "Identificador de orden inválido.",
      };
    }

    // 1. Idempotencia automática (Sección 6)
    // BIENVENIDA y CIERRE: verificar si ya existe registro con:
    // estado_envio IN ('PENDIENTE', 'ENVIADO', 'ENTREGADO') O con textbee_batch_id válido.
    // Si ya existe con batch válido -> NO duplicar.
    // Si existe con ERROR y textbee_batch_id IS NULL -> permitir reintento controlado.
    if (tipo === "BIENVENIDA" || tipo === "CIERRE") {
      const priorSendRes = await query<{
        notificacion_orden_trabajo_id: number;
        estado_envio: DeliveryStatus;
        textbee_batch_id: string | null;
      }>(
        `SELECT notificacion_orden_trabajo_id, estado_envio, textbee_batch_id
         FROM admin.notificacion_orden_trabajo
         WHERE orden_trabajo_id = $1
           AND tipo_notificacion = $2
           AND (estado_envio IN ('ENVIADO', 'ENTREGADO', 'PENDIENTE') OR textbee_batch_id IS NOT NULL)
         ORDER BY notificacion_orden_trabajo_id DESC
         LIMIT 1`,
        [ordenTrabajoId, tipo]
      );

      if (priorSendRes && priorSendRes.length > 0) {
        const prior = priorSendRes[0];
        return {
          success: true,
          tipoNotificacion: tipo,
          estadoEnvio: prior.estado_envio,
          smsBatchId: prior.textbee_batch_id,
          skipped: true,
          message: `Notificación ${tipo} ya fue procesada previamente para esta orden (Batch: ${prior.textbee_batch_id || "N/A"}).`,
        };
      }
    }

    // 2. Fetch Work Order, Client, and Multitenancy data
    const orderRes = await query<{
      orden_trabajo_id: number;
      codigo_orden: string;
      cliente_id: number;
      empresa_id: number;
      telefono_principal: string | null;
      telefono_secundario: string | null;
      public_portal_url: string | null;
    }>(
      `SELECT
         ot.orden_trabajo_id,
         ot.codigo_orden,
         ot.cliente_id,
         COALESCE(c.empresa_id, 1) AS empresa_id,
         c.telefono_principal,
         c.telefono_secundario,
         e.public_portal_url
       FROM admin.ordenes_trabajo ot
       JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
       LEFT JOIN admin.empresa e ON e.empresa_id = COALESCE(c.empresa_id, 1)
       WHERE ot.orden_trabajo_id = $1
       LIMIT 1`,
      [ordenTrabajoId]
    );

    if (!orderRes || orderRes.length === 0) {
      return {
        success: false,
        tipoNotificacion: tipo,
        estadoEnvio: "NO_ENVIADO",
        errorMessage: "Orden de trabajo no encontrada para notificación.",
      };
    }

    const order = orderRes[0];
    const resolvedEmpresaId = empresaId || order.empresa_id || 1;

    // Multitenancy boundary check
    if (empresaId && Number(order.empresa_id) !== Number(empresaId)) {
      return {
        success: false,
        tipoNotificacion: tipo,
        estadoEnvio: "NO_ENVIADO",
        errorMessage: "La orden no pertenece a la empresa de la sesión actual.",
      };
    }

    // 3. Resolve public short link via canonical tracking engine (Sección 7)
    let trackingRes = await query<{ short_code: string; public_token: string }>(
      `SELECT short_code, public_token
       FROM admin.orden_tracking
       WHERE orden_trabajo_id = $1
         AND activo = true`,
      [ordenTrabajoId]
    );

    if (!trackingRes || trackingRes.length === 0 || !trackingRes[0].short_code) {
      try {
        await ensureWorkOrderTracking(ordenTrabajoId);
        trackingRes = await query<{ short_code: string; public_token: string }>(
          `SELECT short_code, public_token
           FROM admin.orden_tracking
           WHERE orden_trabajo_id = $1
             AND activo = true`,
          [ordenTrabajoId]
        );
      } catch (ensureErr) {
        console.error("[workOrderNotificationService] Error al asegurar tracking para notificación SMS:", ensureErr);
      }
    }

    const shortCode = trackingRes && trackingRes[0] ? trackingRes[0].short_code : null;
    if (!shortCode) {
      const errorMsg = "No se pudo obtener el short_code de seguimiento válido y activo para la orden.";
      await recordNotificationAudit({
        empresaId: resolvedEmpresaId,
        ordenTrabajoId,
        tipoNotificacion: tipo,
        telefonoDestino: null,
        mensaje: `Error: Short link no disponible para ${order.codigo_orden}`,
        estadoEnvio: "NO_ENVIADO",
        errorMensaje: errorMsg,
        usuarioRegistro: usuarioId,
      });

      return {
        success: false,
        tipoNotificacion: tipo,
        estadoEnvio: "NO_ENVIADO",
        errorMessage: errorMsg,
      };
    }

    const publicPortalBase = (order.public_portal_url || "").trim().replace(/\/+$/, "");
    const shortUrl = `${publicPortalBase}/${shortCode}`;

    // 4. Construct message and validate length <= 128 characters
    const message = buildNotificationMessage(tipo, order.codigo_orden, shortUrl);

    if (message.length > MAX_SMS_LENGTH) {
      const errorMsg = `El mensaje final supera el límite de ${MAX_SMS_LENGTH} caracteres (longitud: ${message.length}).`;
      await recordNotificationAudit({
        empresaId: resolvedEmpresaId,
        ordenTrabajoId,
        tipoNotificacion: tipo,
        telefonoDestino: null,
        mensaje: message,
        estadoEnvio: "ERROR",
        errorMensaje: errorMsg,
        usuarioRegistro: usuarioId,
      });

      return {
        success: false,
        tipoNotificacion: tipo,
        estadoEnvio: "ERROR",
        errorMessage: errorMsg,
      };
    }

    // 5. Resolve and normalize client phone (Sección 8: OT -> cliente -> telefono)
    const rawPhone = order.telefono_principal?.trim() || order.telefono_secundario?.trim() || null;
    const normalizedPhone = normalizeDominicanPhone(rawPhone);

    if (!normalizedPhone) {
      const errorMsg = "El cliente no tiene un teléfono válido registrado.";
      await recordNotificationAudit({
        empresaId: resolvedEmpresaId,
        ordenTrabajoId,
        tipoNotificacion: tipo,
        telefonoDestino: rawPhone,
        mensaje: message,
        estadoEnvio: "NO_ENVIADO",
        errorMensaje: errorMsg,
        usuarioRegistro: usuarioId,
      });

      return {
        success: false,
        tipoNotificacion: tipo,
        estadoEnvio: "NO_ENVIADO",
        missingPhone: true,
        errorMessage: errorMsg,
      };
    }

    // 6. Send SMS via TextBee Gateway (Sección 2, 4, 5)
    const sendResult: TextBeeSendSmsResult = await sendTextBeeSms({
      recipient: normalizedPhone,
      message,
    });

    if (sendResult.success) {
      const smsBatchId = sendResult.smsBatchId || null;
      let currentEstadoEnvio: DeliveryStatus = "PENDIENTE";
      let currentEstadoProveedor = "pending";
      let fechaEnvio: Date | null = null;
      let finalErrorMessage: string | null = null;

      // HTTP 200 en TextBee indica que la solicitud fue encolada correctamente.
      // Se registra como PENDIENTE con fecha_envio = NULL, batchId y codigoHttp = 200.
      const auditId = await recordNotificationAudit({
        empresaId: resolvedEmpresaId,
        ordenTrabajoId,
        tipoNotificacion: tipo,
        telefonoDestino: normalizedPhone,
        mensaje: message,
        estadoEnvio: currentEstadoEnvio,
        estadoProveedor: currentEstadoProveedor,
        textbeeBatchId: smsBatchId,
        codigoHttp: sendResult.statusCode || 200,
        respuestaProveedor: sendResult.providerResponse,
        fechaEnvio: null,
        usuarioRegistro: usuarioId,
      });

      // 7. Sincronización Inmediata controlada (Sección 9 y 10)
      // Si el POST inicial fue aceptado y ya existe smsBatchId:
      // un fallo o timeout consultando estado posteriormente NO DEBE convertir el envío en ERROR/failed.
      // Debe quedar en PENDIENTE y luego el cron sincroniza.
      if (smsBatchId && auditId) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          let batchStatus = await getTextBeeBatchStatus(smsBatchId, 6000);

          // Si el proveedor responde 'sent', la entrega al celular del cliente suele confirmarse en 1-2 segundos adicionales:
          if (batchStatus.success && batchStatus.status === "sent") {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            const secondCheck = await getTextBeeBatchStatus(smsBatchId, 4000);
            if (secondCheck.success && secondCheck.status === "delivered") {
              batchStatus = secondCheck;
            }
          }

          if (batchStatus.success) {
            if (batchStatus.status === "sent") {
              currentEstadoEnvio = "ENVIADO";
              fechaEnvio = batchStatus.sentAt || new Date();
              currentEstadoProveedor = batchStatus.rawStatus || "sent";
            } else if (batchStatus.status === "delivered") {
              currentEstadoEnvio = "ENTREGADO";
              fechaEnvio = batchStatus.deliveredAt || batchStatus.sentAt || new Date();
              currentEstadoProveedor = batchStatus.rawStatus || "delivered";
            } else if (batchStatus.status === "failed") {
              // Dispositivo TextBee explícitamente reportó fallo
              currentEstadoEnvio = "ERROR";
              currentEstadoProveedor = batchStatus.rawStatus || "failed";
              finalErrorMessage = batchStatus.errorMessage || "Fallo en envío reportado por dispositivo TextBee";
            } else {
              // dispatched, pending, unknown -> se mantiene en PENDIENTE
              currentEstadoEnvio = "PENDIENTE";
              currentEstadoProveedor = batchStatus.rawStatus || batchStatus.status;
            }

            await updateNotificationAudit({
              notificacionId: auditId,
              estadoEnvio: currentEstadoEnvio,
              estadoProveedor: currentEstadoProveedor,
              respuestaProveedor: batchStatus.providerResponse,
              fechaEnvio,
              errorMensaje: finalErrorMessage,
            });
          }
        } catch (syncErr) {
          // Timeout o error en consulta posterior NUNCA degrada a ERROR si existe smsBatchId
          console.warn("[workOrderNotificationService] Advertencia en verificación inmediata de batch (cron sincronizará):", syncErr);
        }
      }

      const isDeliveredOrSent = currentEstadoEnvio === "ENVIADO" || currentEstadoEnvio === "ENTREGADO";
      const userMessage = isDeliveredOrSent
        ? "Notificación enviada al cliente."
        : "Notificación enviada a la cola de envío.";

      return {
        success: currentEstadoEnvio !== "ERROR",
        tipoNotificacion: tipo,
        estadoEnvio: currentEstadoEnvio,
        estadoProveedor: currentEstadoProveedor,
        smsBatchId,
        statusCode: sendResult.statusCode || 200,
        message: userMessage,
        errorMessage: finalErrorMessage,
      };
    } else {
      // Falló ANTES de obtener smsBatchId -> Registrar ERROR de envío inicial
      await recordNotificationAudit({
        empresaId: resolvedEmpresaId,
        ordenTrabajoId,
        tipoNotificacion: tipo,
        telefonoDestino: normalizedPhone,
        mensaje: message,
        estadoEnvio: "ERROR",
        estadoProveedor: "failed",
        textbeeBatchId: null,
        codigoHttp: sendResult.statusCode,
        respuestaProveedor: sendResult.providerResponse,
        errorMensaje: sendResult.errorMessage,
        usuarioRegistro: usuarioId,
      });

      return {
        success: false,
        tipoNotificacion: tipo,
        estadoEnvio: "ERROR",
        estadoProveedor: "failed",
        statusCode: sendResult.statusCode,
        errorMessage: sendResult.errorMessage || "No fue posible enviar la notificación.",
      };
    }
  } catch (error: unknown) {
    const errorDetail = error instanceof Error ? error.message : "Error inesperado en servicio de notificaciones";
    console.error("Excepción en sendWorkOrderSmsNotification:", error);

    return {
      success: false,
      tipoNotificacion: tipo,
      estadoEnvio: "ERROR",
      errorMessage: errorDetail,
    };
  }
}

export const processOrderNotification = sendWorkOrderSmsNotification;

/**
 * 1. BIENVENIDA: Automático al crear la OT.
 */
export async function sendWelcomeNotification(
  params: SendNotificationParams
): Promise<SendNotificationResult> {
  return sendWorkOrderSmsNotification("BIENVENIDA", params);
}

/**
 * 2. ESTADO: Manual desde botón "Reenviar Notificación" en detalle de OT.
 */
export async function sendStatusNotification(
  params: SendNotificationParams
): Promise<SendNotificationResult> {
  return sendWorkOrderSmsNotification("ESTADO", params);
}

/**
 * 3. CIERRE: Automático cuando la OT pasa a estado COMPLETADA.
 */
export async function sendCompletionNotification(
  params: SendNotificationParams
): Promise<SendNotificationResult> {
  return sendWorkOrderSmsNotification("CIERRE", params);
}

export interface SyncNotificationRow {
  notificacion_orden_trabajo_id: number;
  orden_trabajo_id: number;
  tipo_notificacion: NotificationType;
  telefono_destino: string | null;
  estado_envio: DeliveryStatus;
  estado_proveedor: string | null;
  textbee_batch_id: string;
  fecha_registro: Date | string;
  fecha_envio?: Date | string | null;
}

export interface SyncNotificationResult {
  notificacionId: number;
  batchId: string;
  previousEstadoEnvio: DeliveryStatus;
  newEstadoEnvio: DeliveryStatus;
  previousEstadoProveedor: string | null;
  newEstadoProveedor: string | null;
  updated: boolean;
  fechaEnvioReal: Date | null;
  error?: string | null;
}

export interface SyncRecentBatchResult {
  totalPending: number;
  processed: number;
  updatedCount: number;
  results: SyncNotificationResult[];
}

/**
 * Core synchronization unit for a single TextBee notification record.
 * Checks real TextBee batch state, maps to delivery status, uses real provider
 * timestamps (sentAt / deliveredAt), and prevents state degradation.
 */
export async function syncPendingTextBeeNotification(
  row: SyncNotificationRow
): Promise<SyncNotificationResult> {
  const notificacionId = row.notificacion_orden_trabajo_id;
  const batchId = row.textbee_batch_id?.trim();

  if (!batchId) {
    return {
      notificacionId,
      batchId: "",
      previousEstadoEnvio: row.estado_envio,
      newEstadoEnvio: row.estado_envio,
      previousEstadoProveedor: row.estado_proveedor,
      newEstadoProveedor: row.estado_proveedor,
      updated: false,
      fechaEnvioReal: null,
      error: "Sin textbee_batch_id registrado",
    };
  }

  const batchStatus = await getTextBeeBatchStatus(batchId);

  if (!batchStatus.success) {
    return {
      notificacionId,
      batchId,
      previousEstadoEnvio: row.estado_envio,
      newEstadoEnvio: row.estado_envio,
      previousEstadoProveedor: row.estado_proveedor,
      newEstadoProveedor: row.estado_proveedor,
      updated: false,
      fechaEnvioReal: null,
      error: batchStatus.errorMessage || "Fallo al consultar TextBee",
    };
  }

  let targetEstadoEnvio: DeliveryStatus = row.estado_envio;
  let finalFechaEnvio: Date | null = row.fecha_envio ? new Date(row.fecha_envio) : null;
  let errorMsg: string | null = null;

  if (batchStatus.status === "sent") {
    targetEstadoEnvio = "ENVIADO";
    finalFechaEnvio = batchStatus.sentAt || finalFechaEnvio || new Date();
  } else if (batchStatus.status === "delivered") {
    targetEstadoEnvio = "ENTREGADO";
    finalFechaEnvio = batchStatus.deliveredAt || batchStatus.sentAt || finalFechaEnvio || new Date();
  } else if (batchStatus.status === "failed") {
    targetEstadoEnvio = "ERROR";
    errorMsg = batchStatus.errorMessage || "Fallo en envío de SMS";
  } else if (batchStatus.status === "dispatched" || batchStatus.status === "pending" || batchStatus.status === "unknown") {
    targetEstadoEnvio = "PENDIENTE";
  }

  // Prevenir degradación de estados (Sección 3):
  // PENDIENTE (1) < ENVIADO (2) < ENTREGADO (3)
  const currentRank = STATUS_PRIORITY[row.estado_envio] || 0;
  const targetRank = STATUS_PRIORITY[targetEstadoEnvio] || 0;

  let resolvedEstadoEnvio = targetEstadoEnvio;
  if (currentRank > targetRank && currentRank >= 2) {
    resolvedEstadoEnvio = row.estado_envio;
  }

  const rawProvStatus = batchStatus.rawStatus || batchStatus.status;

  await updateNotificationAudit({
    notificacionId,
    estadoEnvio: resolvedEstadoEnvio,
    estadoProveedor: rawProvStatus,
    respuestaProveedor: batchStatus.providerResponse,
    fechaEnvio: finalFechaEnvio,
    errorMensaje: errorMsg,
  });

  const wasUpdated =
    resolvedEstadoEnvio !== row.estado_envio ||
    rawProvStatus !== row.estado_proveedor;

  return {
    notificacionId,
    batchId,
    previousEstadoEnvio: row.estado_envio,
    newEstadoEnvio: resolvedEstadoEnvio,
    previousEstadoProveedor: row.estado_proveedor,
    newEstadoProveedor: rawProvStatus,
    updated: wasUpdated,
    fechaEnvioReal: finalFechaEnvio,
  };
}

/**
 * On-demand synchronization for a specific work order (Section 4).
 * Checks pending notifications with age >= 10 seconds and updates them server-side.
 * Safe and non-blocking: never throws to the caller.
 */
export async function syncOrderPendingNotifications(
  ordenTrabajoId: number
): Promise<{ checked: number; updated: number }> {
  try {
    if (!ordenTrabajoId || isNaN(Number(ordenTrabajoId))) {
      return { checked: 0, updated: 0 };
    }

    const pendingRows = await query<SyncNotificationRow>(
      `SELECT
         notificacion_orden_trabajo_id,
         orden_trabajo_id,
         tipo_notificacion,
         telefono_destino,
         estado_envio,
         estado_proveedor,
         textbee_batch_id,
         fecha_registro,
         fecha_envio
       FROM admin.notificacion_orden_trabajo
       WHERE orden_trabajo_id = $1
         AND estado_envio IN ('PENDIENTE', 'ENVIADO')
         AND (estado_proveedor IS NULL OR estado_proveedor != 'delivered')
         AND textbee_batch_id IS NOT NULL
         AND fecha_registro <= NOW() - INTERVAL '3 seconds'
       ORDER BY notificacion_orden_trabajo_id ASC`,
      [ordenTrabajoId]
    );

    if (!pendingRows || pendingRows.length === 0) {
      return { checked: 0, updated: 0 };
    }

    let updatedCount = 0;
    for (const row of pendingRows) {
      try {
        const res = await syncPendingTextBeeNotification(row);
        if (res.updated) updatedCount++;
      } catch (rowErr) {
        console.warn(`Error al sincronizar notificación ${row.notificacion_orden_trabajo_id}:`, rowErr);
      }
    }

    return { checked: pendingRows.length, updated: updatedCount };
  } catch (err) {
    console.warn(`Fallo silencioso en syncOrderPendingNotifications para OT ${ordenTrabajoId}:`, err);
    return { checked: 0, updated: 0 };
  }
}

/**
 * Periodic / Cron synchronization service (Section 5).
 * Queries recent pending notifications (within last 2 hours) and synchronizes them in small batches.
 * Idempotent, safe, and returns diagnostic metrics.
 */
export async function syncRecentPendingTextBeeNotifications(
  limit: number = 50
): Promise<SyncRecentBatchResult> {
  const safeLimit = Math.min(Math.max(1, limit), 200);

  const pendingRows = await query<SyncNotificationRow>(
    `SELECT
       notificacion_orden_trabajo_id,
       orden_trabajo_id,
       tipo_notificacion,
       telefono_destino,
       estado_envio,
       estado_proveedor,
       textbee_batch_id,
       fecha_registro,
       fecha_envio
     FROM admin.notificacion_orden_trabajo
     WHERE estado_envio IN ('PENDIENTE', 'ENVIADO')
       AND (estado_proveedor IS NULL OR estado_proveedor != 'delivered')
       AND textbee_batch_id IS NOT NULL
       AND fecha_registro >= NOW() - INTERVAL '24 hours'
     ORDER BY notificacion_orden_trabajo_id ASC
     LIMIT $1`,
    [safeLimit]
  );

  const results: SyncNotificationResult[] = [];
  let updatedCount = 0;

  const settled = await Promise.allSettled(
    pendingRows.map(async (row) => {
      try {
        return await syncPendingTextBeeNotification(row);
      } catch (rowErr) {
        console.warn(`Error al sincronizar batch reciente ${row.textbee_batch_id}:`, rowErr);
        return null;
      }
    })
  );

  for (const outcome of settled) {
    if (outcome.status === "fulfilled" && outcome.value) {
      results.push(outcome.value);
      if (outcome.value.updated) updatedCount++;
    }
  }

  return {
    totalPending: pendingRows.length,
    processed: results.length,
    updatedCount,
    results,
  };
}
