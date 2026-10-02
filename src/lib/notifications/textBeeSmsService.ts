/**
 * TEXTBEE SMS GATEWAY SERVICE
 * Centralized server-side client for sending and querying SMS notifications through TextBee API.
 * Never exposes credentials to client or logs.
 */

export interface TextBeeSendSmsParams {
  recipient: string;
  message: string;
  timeoutMs?: number;
}

export interface TextBeeSendSmsResult {
  success: boolean;
  statusCode?: number | null;
  smsBatchId?: string | null;
  providerResponse?: unknown;
  errorMessage?: string | null;
}

export type TextBeeNormalizedStatus =
  | "pending"
  | "dispatched"
  | "sent"
  | "delivered"
  | "failed"
  | "unknown";

export interface TextBeeBatchStatusResult {
  success: boolean;
  statusCode?: number | null;
  status: TextBeeNormalizedStatus;
  rawStatus?: string | null;
  smsBatchId: string;
  providerResponse?: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  dispatchedAt?: Date | null;
}

export interface TextBeeDeviceStatusResult {
  success: boolean;
  statusCode?: number | null;
  enabled: boolean;
  online: boolean;
  brand?: string;
  model?: string;
  name?: string;
  lastHeartbeat?: string | null;
  simReady: boolean;
  simCarrier?: string | null;
  hasSendSmsPermission: boolean;
  providerResponse?: unknown;
  deviceInfo?: unknown;
  errorMessage?: string | null;
}

const DEFAULT_TEXTBEE_URL = "https://api.textbee.dev/api/v1/gateway/send-sms";
const DEFAULT_GATEWAY_BASE = "https://api.textbee.dev/api/v1/gateway";
const DEFAULT_TIMEOUT_MS = 25000;

export function getTextBeeTimeoutMs(): number {
  const envVal = process.env.TEXTBEE_TIMEOUT_MS?.trim();
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed >= 5000 && parsed <= 60000) {
      return parsed;
    }
  }
  return DEFAULT_TIMEOUT_MS;
}

function getGatewayBaseUrl(): string {
  const apiUrl = process.env.TEXTBEE_API_URL?.trim() || DEFAULT_TEXTBEE_URL;
  if (apiUrl.includes("/send-sms")) {
    return apiUrl.replace(/\/send-sms\/?$/, "");
  }
  return DEFAULT_GATEWAY_BASE;
}

/**
 * Enqueues an SMS to TextBee gateway with controlled retries for transient errors.
 * Note: HTTP 200 means the SMS is queued in TextBee (smsBatchId created),
 * NOT that it has been sent by the device SIM yet.
 */
export async function sendTextBeeSms({
  recipient,
  message,
  timeoutMs,
}: TextBeeSendSmsParams): Promise<TextBeeSendSmsResult> {
  const effectiveTimeout = timeoutMs || getTextBeeTimeoutMs();
  const apiUrl = process.env.TEXTBEE_API_URL?.trim() || DEFAULT_TEXTBEE_URL;
  const apiKey = process.env.TEXTBEE_API_KEY?.trim();
  const deviceId = process.env.TEXTBEE_DEVICE_ID?.trim();

  // Validate server-side configuration without throwing
  if (!apiKey || !deviceId) {
    return {
      success: false,
      statusCode: null,
      smsBatchId: null,
      providerResponse: null,
      errorMessage: "TextBee SMS no configurado: faltan TEXTBEE_API_KEY o TEXTBEE_DEVICE_ID.",
    };
  }

  if (!recipient || typeof recipient !== "string" || !recipient.trim()) {
    return {
      success: false,
      statusCode: null,
      smsBatchId: null,
      providerResponse: null,
      errorMessage: "Destinatario telefónico inválido o vacío.",
    };
  }

  if (!message || typeof message !== "string" || !message.trim()) {
    return {
      success: false,
      statusCode: null,
      smsBatchId: null,
      providerResponse: null,
      errorMessage: "El mensaje SMS no puede estar vacío.",
    };
  }

  if (message.length > 128) {
    return {
      success: false,
      statusCode: null,
      smsBatchId: null,
      providerResponse: null,
      errorMessage: `El mensaje excede el límite máximo de 128 caracteres (longitud: ${message.length}).`,
    };
  }

  const maxAttempts = 3; // 1 initial + up to 2 retries for transient errors
  let lastResult: TextBeeSendSmsResult = {
    success: false,
    statusCode: null,
    smsBatchId: null,
    providerResponse: null,
    errorMessage: "No se pudo conectar con TextBee.",
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

    try {
      const payload = {
        deviceId,
        recipients: [recipient.trim()],
        message,
      };

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      let parsedResponse: unknown = null;
      const responseText = await response.text();
      try {
        parsedResponse = responseText ? JSON.parse(responseText) : null;
      } catch {
        parsedResponse = responseText ? { raw: responseText.slice(0, 500) } : null;
      }

      if (!response.ok) {
        const statusText = response.statusText || "HTTP Error";
        const detail =
          parsedResponse && typeof parsedResponse === "object" && "message" in parsedResponse
            ? String((parsedResponse as Record<string, unknown>).message)
            : responseText.slice(0, 200);

        const errorMsg = `TextBee respondió con error ${response.status} (${statusText})${detail ? `: ${detail}` : ""}`;
        console.warn(`[TextBee SMS] Intento ${attempt}/${maxAttempts} falló (HTTP ${response.status}) en ${durationMs}ms`);

        lastResult = {
          success: false,
          statusCode: response.status,
          smsBatchId: null,
          providerResponse: parsedResponse,
          errorMessage: errorMsg,
        };

        // Only retry transient errors: HTTP 429 or 5xx
        const isTransientStatus = response.status === 429 || response.status >= 500;
        if (isTransientStatus && attempt < maxAttempts) {
          const backoffMs = attempt * 1000; // 1s, 2s
          await new Promise((res) => setTimeout(res, backoffMs));
          continue;
        }

        // Permanent 4xx error (e.g. 400, 401, 403, 404): DO NOT RETRY
        return lastResult;
      }

      // Extract smsBatchId from response structure
      let smsBatchId: string | null = null;
      if (parsedResponse && typeof parsedResponse === "object") {
        const respObj = parsedResponse as Record<string, unknown>;
        const dataObj = respObj.data as Record<string, unknown> | undefined;
        if (dataObj && typeof dataObj.smsBatchId === "string") {
          smsBatchId = dataObj.smsBatchId;
        } else if (typeof respObj.smsBatchId === "string") {
          smsBatchId = respObj.smsBatchId;
        }
      }

      console.info(`[TextBee SMS] Intento ${attempt}/${maxAttempts} exitoso (HTTP ${response.status}) en ${durationMs}ms. BatchId: ${smsBatchId ? "PRESENTE" : "NULL"}`);

      return {
        success: true,
        statusCode: response.status,
        smsBatchId,
        providerResponse: parsedResponse,
        errorMessage: null,
      };
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      const isTimeout = error instanceof Error && error.name === "AbortError";
      const errorDetail = isTimeout
        ? `Tiempo de espera agotado (${effectiveTimeout}ms) al conectar con TextBee.`
        : `Error de red al comunicarse con TextBee: ${error instanceof Error ? error.message : "Error desconocido"}`;

      console.warn(`[TextBee SMS] Intento ${attempt}/${maxAttempts} falló (${isTimeout ? "TIMEOUT" : "RED"}) en ${durationMs}ms`);

      lastResult = {
        success: false,
        statusCode: null,
        smsBatchId: null,
        providerResponse: null,
        errorMessage: attempt === maxAttempts && isTimeout
          ? `Tiempo de espera agotado (${effectiveTimeout}ms) al conectar con TextBee tras ${maxAttempts} intentos.`
          : errorDetail,
      };

      // Timeout or network error is transient: retry if attempts left
      if (attempt < maxAttempts) {
        const backoffMs = attempt * 1000; // 1s, 2s
        await new Promise((res) => setTimeout(res, backoffMs));
        continue;
      }

      return lastResult;
    }
  }

  return lastResult;
}

/**
 * Queries the real status of an SMS batch from TextBee device.
 * Endpoint: GET /api/v1/gateway/devices/{TEXTBEE_DEVICE_ID}/sms-batch/{smsBatchId}
 */
export async function getTextBeeBatchStatus(
  smsBatchId: string,
  timeoutMs: number = 8000
): Promise<TextBeeBatchStatusResult> {
  const gatewayBase = getGatewayBaseUrl();
  const apiKey = process.env.TEXTBEE_API_KEY?.trim();
  const deviceId = process.env.TEXTBEE_DEVICE_ID?.trim();

  if (!apiKey || !deviceId) {
    return {
      success: false,
      statusCode: null,
      status: "unknown",
      rawStatus: null,
      smsBatchId,
      providerResponse: null,
      errorMessage: "Credenciales de TextBee no configuradas.",
    };
  }

  if (!smsBatchId || typeof smsBatchId !== "string" || !smsBatchId.trim()) {
    return {
      success: false,
      statusCode: null,
      status: "unknown",
      rawStatus: null,
      smsBatchId,
      providerResponse: null,
      errorMessage: "smsBatchId inválido.",
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${gatewayBase}/devices/${deviceId}/sms-batch/${smsBatchId.trim()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let parsedResponse: unknown = null;
    const responseText = await response.text();
    try {
      parsedResponse = responseText ? JSON.parse(responseText) : null;
    } catch {
      parsedResponse = responseText ? { raw: responseText.slice(0, 500) } : null;
    }

    if (!response.ok) {
      return {
        success: false,
        statusCode: response.status,
        status: "unknown",
        rawStatus: null,
        smsBatchId,
        providerResponse: parsedResponse,
        errorMessage: `HTTP ${response.status} al consultar batch TextBee.`,
      };
    }

    // Inspect batch and messages
    let rawStatus: string | null = null;
    let errorCode: string | null = null;
    let errorMessage: string | null = null;
    let sentAt: Date | null = null;
    let deliveredAt: Date | null = null;
    let dispatchedAt: Date | null = null;

    if (parsedResponse && typeof parsedResponse === "object") {
      const respObj = parsedResponse as Record<string, unknown>;
      const dataObj = respObj.data as Record<string, unknown> | undefined;

      const messages = (dataObj?.messages || respObj.messages) as Array<Record<string, unknown>> | undefined;
      const batch = (dataObj?.batch || respObj.batch) as Record<string, unknown> | undefined;

      // Primary: examine first message in batch
      if (Array.isArray(messages) && messages.length > 0) {
        const msg = messages[0];
        if (typeof msg.status === "string") {
          rawStatus = msg.status.toLowerCase().trim();
        }
        if (typeof msg.errorCode === "string" || typeof msg.errorCode === "number") {
          errorCode = String(msg.errorCode);
        }
        if (typeof msg.errorMessage === "string") {
          errorMessage = msg.errorMessage;
        } else if (typeof msg.error === "string") {
          errorMessage = msg.error;
        }

        // Extract real timestamps from TextBee message
        if (typeof msg.sentAt === "string" && msg.sentAt) {
          const d = new Date(msg.sentAt);
          if (!isNaN(d.getTime())) sentAt = d;
        }
        if (typeof msg.deliveredAt === "string" && msg.deliveredAt) {
          const d = new Date(msg.deliveredAt);
          if (!isNaN(d.getTime())) deliveredAt = d;
        }
        if (typeof msg.dispatchedAt === "string" && msg.dispatchedAt) {
          const d = new Date(msg.dispatchedAt);
          if (!isNaN(d.getTime())) dispatchedAt = d;
        }
      }

      // Secondary fallback to batch level status and timestamps
      if (!rawStatus && batch && typeof batch.status === "string") {
        rawStatus = batch.status.toLowerCase().trim();
      }
      if (!sentAt && batch && typeof batch.sentAt === "string") {
        const d = new Date(batch.sentAt);
        if (!isNaN(d.getTime())) sentAt = d;
      }
    }

    // Map to normalized status: pending, dispatched, sent, delivered, failed, unknown
    let normalizedStatus: TextBeeNormalizedStatus = "unknown";
    if (rawStatus === "sent") {
      normalizedStatus = "sent";
    } else if (rawStatus === "delivered") {
      normalizedStatus = "delivered";
    } else if (rawStatus === "failed" || rawStatus === "error") {
      normalizedStatus = "failed";
    } else if (rawStatus === "dispatched") {
      normalizedStatus = "dispatched";
    } else if (rawStatus === "pending" || rawStatus === "in_progress" || rawStatus === "processing") {
      normalizedStatus = "pending";
    } else {
      normalizedStatus = "unknown";
    }

    return {
      success: true,
      statusCode: response.status,
      status: normalizedStatus,
      rawStatus,
      smsBatchId,
      providerResponse: parsedResponse,
      errorCode,
      errorMessage,
      sentAt,
      deliveredAt,
      dispatchedAt,
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    const messageDetail = error instanceof Error ? error.message : "Error de red";
    return {
      success: false,
      statusCode: null,
      status: "unknown",
      rawStatus: null,
      smsBatchId,
      providerResponse: null,
      errorMessage: `Error al consultar estado en TextBee: ${messageDetail}`,
    };
  }
}

/**
 * Checks the TextBee device status and health.
 * Endpoint: GET /api/v1/gateway/devices/{TEXTBEE_DEVICE_ID}
 */
export async function getTextBeeDeviceStatus(timeoutMs: number = 8000): Promise<TextBeeDeviceStatusResult> {
  const gatewayBase = getGatewayBaseUrl();
  const apiKey = process.env.TEXTBEE_API_KEY?.trim();
  const deviceId = process.env.TEXTBEE_DEVICE_ID?.trim();

  if (!apiKey || !deviceId) {
    return {
      success: false,
      statusCode: null,
      enabled: false,
      online: false,
      lastHeartbeat: null,
      simReady: false,
      hasSendSmsPermission: false,
      errorMessage: "Credenciales de TextBee no configuradas.",
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${gatewayBase}/devices/${deviceId}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let parsedResponse: unknown = null;
    const responseText = await response.text();
    try {
      parsedResponse = responseText ? JSON.parse(responseText) : null;
    } catch {
      parsedResponse = responseText ? { raw: responseText.slice(0, 500) } : null;
    }

    if (!response.ok) {
      return {
        success: false,
        statusCode: response.status,
        enabled: false,
        online: false,
        lastHeartbeat: null,
        simReady: false,
        hasSendSmsPermission: false,
        providerResponse: parsedResponse,
        errorMessage: `HTTP ${response.status} al consultar dispositivo TextBee.`,
      };
    }

    const dataObj =
      parsedResponse && typeof parsedResponse === "object" && "data" in parsedResponse
        ? ((parsedResponse as Record<string, unknown>).data as Record<string, unknown>)
        : (parsedResponse as Record<string, unknown>);

    const enabled = Boolean(dataObj?.enabled);
    const lastHeartbeat = typeof dataObj?.lastHeartbeat === "string" ? dataObj.lastHeartbeat : null;

    // Check if device had a heartbeat in the last 2 hours
    let online = false;
    if (lastHeartbeat) {
      const hbTime = new Date(lastHeartbeat).getTime();
      const diffMs = Date.now() - hbTime;
      online = !isNaN(hbTime) && diffMs >= 0 && diffMs < 2 * 60 * 60 * 1000;
    }

    const simInfo = dataObj?.simInfo as Record<string, unknown> | undefined;
    const sims = Array.isArray(simInfo?.sims) ? (simInfo?.sims as Array<Record<string, unknown>>) : [];
    const activeSim = sims[0];
    const simReady = activeSim?.simState === "READY" && activeSim?.serviceState === "IN_SERVICE";
    const simCarrier = typeof activeSim?.carrierName === "string" ? activeSim.carrierName : null;

    const appState = dataObj?.appStateInfo as Record<string, unknown> | undefined;
    const hasSendSmsPermission = Boolean(appState?.hasSendSmsPermission);

    return {
      success: true,
      statusCode: response.status,
      enabled,
      online,
      brand: typeof dataObj?.brand === "string" ? dataObj.brand : undefined,
      model: typeof dataObj?.model === "string" ? dataObj.model : undefined,
      name: typeof dataObj?.name === "string" ? dataObj.name : undefined,
      lastHeartbeat,
      simReady,
      simCarrier,
      hasSendSmsPermission,
      deviceInfo: dataObj,
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    const messageDetail = error instanceof Error ? error.message : "Error de red";
    return {
      success: false,
      statusCode: null,
      enabled: false,
      online: false,
      lastHeartbeat: null,
      simReady: false,
      hasSendSmsPermission: false,
      errorMessage: `Error al consultar dispositivo TextBee: ${messageDetail}`,
    };
  }
}
