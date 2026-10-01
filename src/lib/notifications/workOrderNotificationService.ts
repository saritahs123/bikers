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
import { ensureWorkOrderTracking } from "@/lib/tracking/workOrderTrackingService";

export type NotificationType = "BIENVENIDA" | "ESTADO" | "CIERRE";
export type DeliveryStatus = "PENDIENTE" | "ENVIADO" | "ENTREGADO" | "ERROR" | "NO_ENVIADO";

export interface SendNotificationParams {
  ordenTrabajoId: number;
  usuarioId?: number | null;
  empresaId?: number | null;
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

const PUBLIC_PORTAL_BASE = "https://web.bikerrd.com";
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
 * Updates an audit record with provider batch inquiry results.
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
       SET estado_envio = $1,
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
async function processOrderNotification(
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

    // 1. Idempotency check:
    // BIENVENIDA and CIERRE can only have ONE successful delivery per order.
    // ESTADO can be sent multiple times.
    if (tipo === "BIENVENIDA" || tipo === "CIERRE") {
      const priorSendRes = await query<{ count: string }>(
        `SELECT COUNT(*)::int AS count
         FROM admin.notificacion_orden_trabajo
         WHERE orden_trabajo_id = $1
           AND tipo_notificacion = $2
           AND estado_envio IN ('ENVIADO', 'ENTREGADO', 'PENDIENTE')`,
        [ordenTrabajoId, tipo]
      );

      const alreadySent = parseInt(priorSendRes[0]?.count || "0", 10) > 0;
      if (alreadySent) {
        return {
          success: true,
          tipoNotificacion: tipo,
          estadoEnvio: "ENVIADO",
          skipped: true,
          message: `Notificación ${tipo} ya fue procesada previamente para esta orden.`,
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
    }>(
      `SELECT
         ot.orden_trabajo_id,
         ot.codigo_orden,
         ot.cliente_id,
         COALESCE(c.empresa_id, 1) AS empresa_id,
         c.telefono_principal,
         c.telefono_secundario
       FROM admin.ordenes_trabajo ot
       JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
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

    // 3. Resolve public short link via canonical tracking engine
    let trackingRes = await query<{ short_code: string; public_token: string }>(
      `SELECT short_code, public_token
       FROM admin.orden_tracking
       WHERE orden_trabajo_id = $1`,
      [ordenTrabajoId]
    );

    if (!trackingRes || trackingRes.length === 0 || !trackingRes[0].short_code) {
      try {
        await ensureWorkOrderTracking(ordenTrabajoId);
        trackingRes = await query<{ short_code: string; public_token: string }>(
          `SELECT short_code, public_token
           FROM admin.orden_tracking
           WHERE orden_trabajo_id = $1`,
          [ordenTrabajoId]
        );
      } catch (ensureErr) {
        console.error("Error al asegurar tracking para notificación SMS:", ensureErr);
      }
    }

    const shortCode = trackingRes && trackingRes[0] ? trackingRes[0].short_code : null;
    if (!shortCode) {
      const errorMsg = "No se pudo obtener el short_code de seguimiento para la orden.";
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

    const shortUrl = `${PUBLIC_PORTAL_BASE}/${shortCode}`;

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

    // 5. Resolve and normalize client phone
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

    // 6. Send SMS via TextBee Gateway
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
      // Se registra inicialmente como PENDIENTE con fecha_envio = NULL.
      const auditId = await recordNotificationAudit({
        empresaId: resolvedEmpresaId,
        ordenTrabajoId,
        tipoNotificacion: tipo,
        telefonoDestino: normalizedPhone,
        mensaje: message,
        estadoEnvio: currentEstadoEnvio,
        estadoProveedor: currentEstadoProveedor,
        textbeeBatchId: smsBatchId,
        codigoHttp: sendResult.statusCode,
        respuestaProveedor: sendResult.providerResponse,
        fechaEnvio: null,
        usuarioRegistro: usuarioId,
      });

      // 7. Sincronización Inmediata controlada (Section 7)
      if (smsBatchId && auditId) {
        try {
          // Espera breve controlada (1.5 segundos) antes de verificar estado de cola
          await new Promise((resolve) => setTimeout(resolve, 1500));
          const batchStatus = await getTextBeeBatchStatus(smsBatchId);

          if (batchStatus.success) {
            if (batchStatus.status === "sent") {
              currentEstadoEnvio = "ENVIADO";
              fechaEnvio = new Date();
            } else if (batchStatus.status === "delivered") {
              currentEstadoEnvio = "ENTREGADO";
              fechaEnvio = new Date();
            } else if (batchStatus.status === "failed") {
              currentEstadoEnvio = "ERROR";
              finalErrorMessage = batchStatus.errorMessage || "Fallo en envío de SMS";
            } else if (batchStatus.status === "dispatched" || batchStatus.status === "pending") {
              currentEstadoEnvio = "PENDIENTE";
            }

            currentEstadoProveedor = batchStatus.rawStatus || batchStatus.status;

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
          console.warn("Advertencia en sincronización inmediata de batch TextBee:", syncErr);
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
        statusCode: sendResult.statusCode,
        message: userMessage,
        errorMessage: finalErrorMessage,
      };
    } else {
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
    console.error("Excepción en processOrderNotification:", error);

    return {
      success: false,
      tipoNotificacion: tipo,
      estadoEnvio: "ERROR",
      errorMessage: errorDetail,
    };
  }
}

/**
 * 1. BIENVENIDA: Automático al crear la OT.
 */
export async function sendWelcomeNotification(
  params: SendNotificationParams
): Promise<SendNotificationResult> {
  return processOrderNotification("BIENVENIDA", params);
}

/**
 * 2. ESTADO: Manual desde botón "Reenviar Notificación" en detalle de OT.
 */
export async function sendStatusNotification(
  params: SendNotificationParams
): Promise<SendNotificationResult> {
  return processOrderNotification("ESTADO", params);
}

/**
 * 3. CIERRE: Automático cuando la OT pasa a estado COMPLETADA.
 */
export async function sendCompletionNotification(
  params: SendNotificationParams
): Promise<SendNotificationResult> {
  return processOrderNotification("CIERRE", params);
}
