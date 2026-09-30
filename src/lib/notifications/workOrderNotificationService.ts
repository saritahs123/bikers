/**
 * WORK ORDER SMS NOTIFICATION SERVICE
 * Handles business logic, idempotency, phone normalization, public tracking URL resolution,
 * and audit persistence for work order SMS notifications via TextBee.
 */

import { query } from "@/lib/db";
import { sendTextBeeSms, TextBeeSendSmsResult } from "./textBeeSmsService";
import { ensureWorkOrderTracking } from "@/lib/tracking/workOrderTrackingService";

export type NotificationType = "BIENVENIDA" | "ESTADO" | "CIERRE";
export type DeliveryStatus = "ENVIADO" | "ERROR" | "NO_ENVIADO";

export interface SendNotificationParams {
  ordenTrabajoId: number;
  usuarioId?: number | null;
  empresaId?: number | null;
}

export interface SendNotificationResult {
  success: boolean;
  tipoNotificacion: NotificationType;
  estadoEnvio: DeliveryStatus;
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
  codigoHttp?: number | null;
  respuestaProveedor?: unknown;
  errorMensaje?: string | null;
  fechaEnvio?: Date | null;
  usuarioRegistro?: number | null;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO admin.notificacion_orden_trabajo (
        empresa_id,
        orden_trabajo_id,
        tipo_notificacion,
        telefono_destino,
        mensaje,
        estado_envio,
        codigo_http,
        respuesta_proveedor,
        error_mensaje,
        fecha_envio,
        fecha_registro,
        usuario_registro
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11
      )`,
      [
        empresaId,
        ordenTrabajoId,
        tipoNotificacion,
        telefonoDestino,
        mensaje,
        estadoEnvio,
        codigoHttp,
        respuestaProveedor ? JSON.stringify(respuestaProveedor) : null,
        errorMensaje,
        fechaEnvio,
        usuarioRegistro,
      ]
    );
  } catch (auditErr) {
    console.error("Error al registrar auditoría de notificación SMS:", auditErr);
  }
}

/**
 * Core notification dispatcher handling data gathering, phone validation,
 * idempotency checks, TextBee SMS transmission, and audit logging.
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
           AND estado_envio = 'ENVIADO'`,
        [ordenTrabajoId, tipo]
      );

      const alreadySent = parseInt(priorSendRes[0]?.count || "0", 10) > 0;
      if (alreadySent) {
        return {
          success: true,
          tipoNotificacion: tipo,
          estadoEnvio: "ENVIADO",
          skipped: true,
          message: `Notificación ${tipo} ya fue enviada previamente para esta orden.`,
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
       LEFT JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
       WHERE ot.orden_trabajo_id = $1 AND ot.activo = true`,
      [ordenTrabajoId]
    );

    if (!orderRes || orderRes.length === 0) {
      return {
        success: false,
        tipoNotificacion: tipo,
        estadoEnvio: "NO_ENVIADO",
        errorMessage: "La orden de trabajo no existe o está inactiva.",
      };
    }

    const order = orderRes[0];
    const resolvedEmpresaId = empresaId || order.empresa_id || 1;

    // Validate multitenancy if caller provided an empresaId
    if (empresaId && Number(order.empresa_id) !== Number(empresaId)) {
      return {
        success: false,
        tipoNotificacion: tipo,
        estadoEnvio: "NO_ENVIADO",
        errorMessage: "La orden no pertenece a la empresa de la sesión activa.",
      };
    }

    // 3. Resolve public short link from admin.orden_tracking
    let trackingRes = await query<{ short_code: string; activo: boolean }>(
      `SELECT short_code, activo
       FROM admin.orden_tracking
       WHERE orden_trabajo_id = $1
       ORDER BY orden_tracking_id DESC
       LIMIT 1`,
      [ordenTrabajoId]
    );

    // If tracking doesn't exist yet, ensure it using canonical tracking service
    if (!trackingRes || trackingRes.length === 0 || !trackingRes[0].short_code) {
      try {
        await ensureWorkOrderTracking(ordenTrabajoId, usuarioId);
        trackingRes = await query<{ short_code: string; activo: boolean }>(
          `SELECT short_code, activo
           FROM admin.orden_tracking
           WHERE orden_trabajo_id = $1
           ORDER BY orden_tracking_id DESC
           LIMIT 1`,
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
      await recordNotificationAudit({
        empresaId: resolvedEmpresaId,
        ordenTrabajoId,
        tipoNotificacion: tipo,
        telefonoDestino: normalizedPhone,
        mensaje: message,
        estadoEnvio: "ENVIADO",
        codigoHttp: sendResult.statusCode,
        respuestaProveedor: sendResult.providerResponse,
        fechaEnvio: new Date(),
        usuarioRegistro: usuarioId,
      });

      return {
        success: true,
        tipoNotificacion: tipo,
        estadoEnvio: "ENVIADO",
        statusCode: sendResult.statusCode,
        message: "Notificación enviada al cliente.",
      };
    } else {
      await recordNotificationAudit({
        empresaId: resolvedEmpresaId,
        ordenTrabajoId,
        tipoNotificacion: tipo,
        telefonoDestino: normalizedPhone,
        mensaje: message,
        estadoEnvio: "ERROR",
        codigoHttp: sendResult.statusCode,
        respuestaProveedor: sendResult.providerResponse,
        errorMensaje: sendResult.errorMessage,
        usuarioRegistro: usuarioId,
      });

      return {
        success: false,
        tipoNotificacion: tipo,
        estadoEnvio: "ERROR",
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
 * 2. ESTADO: Manual desde botón "Enviar Estado" en detalle de OT.
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
