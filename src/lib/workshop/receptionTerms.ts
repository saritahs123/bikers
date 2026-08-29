/**
 * Single Source of Truth para los Términos y Condiciones de Recepción en Taller.
 * Garantiza coincidencia exacta e inmutable entre el texto presentado al usuario en UI,
 * la versión enviada en el request, la validación del backend y la persistencia en base de datos.
 */

export const CURRENT_RECEPTION_TERMS_VERSION = "RECEPTION_TERMS_2026_01";

export const RECEPTION_TERMS_DEFINITIONS: Record<
  string,
  {
    version: string;
    effectiveDate: string;
    text: string;
    summary: string;
  }
> = {
  [CURRENT_RECEPTION_TERMS_VERSION]: {
    version: CURRENT_RECEPTION_TERMS_VERSION,
    effectiveDate: "2026-01-01",
    summary: "Aceptación de estado inicial y condiciones generales de servicio de taller.",
    text: "El cliente declara haber entregado la bicicleta en las condiciones descritas en el checklist y acepta los términos del servicio de taller."
  }
};

/**
 * Retorna la versión y texto vigentes de los términos de recepción.
 */
export function getCurrentReceptionTerms() {
  return RECEPTION_TERMS_DEFINITIONS[CURRENT_RECEPTION_TERMS_VERSION];
}

/**
 * Valida si una versión provista corresponde a una versión autorizada por el sistema.
 */
export function isValidReceptionTermsVersion(version: string | null | undefined): boolean {
  if (!version || typeof version !== "string") return false;
  return version.trim() === CURRENT_RECEPTION_TERMS_VERSION;
}
