/**
 * Neutral Customer Validation and Formatter Module
 * Bikers' Fort Core - Shared CRM Utilities
 */

export const normalizeDigits = (value: string | number | null | undefined): string => {
  if (!value) return "";
  return String(value).replace(/\D/g, "");
};

export const formatCedula = (value: string | number | null | undefined): string => {
  const digits = normalizeDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10, 11)}`;
};

export const formatRnc = (value: string | number | null | undefined): string => {
  const digits = normalizeDigits(value).slice(0, 9);
  if (digits.length <= 1) return digits;
  if (digits.length <= 3) return `${digits.slice(0, 1)}-${digits.slice(1)}`;
  if (digits.length <= 8) return `${digits.slice(0, 1)}-${digits.slice(1, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 1)}-${digits.slice(1, 3)}-${digits.slice(3, 8)}-${digits.slice(8, 9)}`;
};

export const formatDominicanPhone = (value: string | number | null | undefined): string => {
  if (!value) return "";
  const str = String(value).trim();
  const hasPlusOne = str.startsWith("+1") || str.startsWith("+ 1");
  const digits = normalizeDigits(value);

  if ((digits.startsWith("1") && digits.length > 10) || hasPlusOne) {
    const main10 = digits.startsWith("1") ? digits.slice(1, 11) : digits.slice(0, 10);
    if (main10.length <= 3) return `+1 ${main10}`;
    if (main10.length <= 6) return `+1 ${main10.slice(0, 3)}-${main10.slice(3)}`;
    return `+1 ${main10.slice(0, 3)}-${main10.slice(3, 6)}-${main10.slice(6, 10)}`;
  } else {
    const main10 = digits.slice(0, 10);
    if (main10.length <= 3) return main10;
    if (main10.length <= 6) return `${main10.slice(0, 3)}-${main10.slice(3)}`;
    return `${main10.slice(0, 3)}-${main10.slice(3, 6)}-${main10.slice(6, 10)}`;
  }
};

export const validateCedula = (value: string | null | undefined): string | null => {
  if (!value || !value.trim()) return null;
  const digits = normalizeDigits(value);
  if (digits.length !== 11) {
    return "La Cédula debe contener 11 dígitos.";
  }
  return null;
};

export const validateRnc = (value: string | null | undefined): string | null => {
  if (!value || !value.trim()) return null;
  const digits = normalizeDigits(value);
  if (digits.length !== 9) {
    return "El RNC debe contener 9 dígitos.";
  }
  return null;
};

export const validateDominicanPhone = (value: string | null | undefined): string | null => {
  if (!value || !value.trim()) {
    return "El Teléfono Principal es obligatorio.";
  }
  const digits = normalizeDigits(value);
  const main10 = digits.startsWith("1") && digits.length >= 11 ? digits.slice(1) : digits;
  if (main10.length !== 10) {
    return "El teléfono debe contener 10 dígitos.";
  }
  const areaCode = main10.slice(0, 3);
  const validAreaCodes = ["809", "829", "849"];
  if (!validAreaCodes.includes(areaCode)) {
    return "Introduce un teléfono válido de República Dominicana (809, 829, 849).";
  }
  return null;
};

export const getContactPreferenceLabel = (whatsapp: any, email: any): string => {
  const isWhatsapp = Boolean(whatsapp);
  const isEmail = Boolean(email);

  if (isWhatsapp && isEmail) return "WhatsApp / Email";
  if (isWhatsapp) return "Solo WhatsApp";
  if (isEmail) return "Solo Email";
  return "Sin preferencia";
};
