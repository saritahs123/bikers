/**
 * TEXTBEE SMS GATEWAY SERVICE
 * Centralized server-side client for sending SMS notifications through TextBee API.
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
  providerResponse?: unknown;
  errorMessage?: string | null;
}

const DEFAULT_TEXTBEE_URL = "https://api.textbee.dev/api/v1/gateway/send-sms";
const DEFAULT_TIMEOUT_MS = 12000;

export async function sendTextBeeSms({
  recipient,
  message,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: TextBeeSendSmsParams): Promise<TextBeeSendSmsResult> {
  const apiUrl = process.env.TEXTBEE_API_URL?.trim() || DEFAULT_TEXTBEE_URL;
  const apiKey = process.env.TEXTBEE_API_KEY?.trim();
  const deviceId = process.env.TEXTBEE_DEVICE_ID?.trim();

  // Validate server-side configuration without throwing
  if (!apiKey || !deviceId) {
    return {
      success: false,
      statusCode: null,
      providerResponse: null,
      errorMessage: "TextBee SMS no configurado: faltan TEXTBEE_API_KEY o TEXTBEE_DEVICE_ID.",
    };
  }

  if (!recipient || typeof recipient !== "string" || !recipient.trim()) {
    return {
      success: false,
      statusCode: null,
      providerResponse: null,
      errorMessage: "Destinatario telefónico inválido o vacío.",
    };
  }

  if (!message || typeof message !== "string" || !message.trim()) {
    return {
      success: false,
      statusCode: null,
      providerResponse: null,
      errorMessage: "El mensaje SMS no puede estar vacío.",
    };
  }

  if (message.length > 128) {
    return {
      success: false,
      statusCode: null,
      providerResponse: null,
      errorMessage: `El mensaje excede el límite máximo de 128 caracteres (longitud: ${message.length}).`,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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

      return {
        success: false,
        statusCode: response.status,
        providerResponse: parsedResponse,
        errorMessage: `TextBee respondió con error ${response.status} (${statusText})${detail ? `: ${detail}` : ""}`,
      };
    }

    return {
      success: true,
      statusCode: response.status,
      providerResponse: parsedResponse,
      errorMessage: null,
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        statusCode: null,
        providerResponse: null,
        errorMessage: `Tiempo de espera agotado (${timeoutMs}ms) al conectar con TextBee.`,
      };
    }

    const messageDetail = error instanceof Error ? error.message : "Error de red desconocido";
    return {
      success: false,
      statusCode: null,
      providerResponse: null,
      errorMessage: `Error de red al comunicarse con TextBee: ${messageDetail}`,
    };
  }
}
