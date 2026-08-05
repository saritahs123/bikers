// Form validation & formatting utility for Dominican Republic & standard fields

export function validateRNC(rnc: string, isRequired = false): { isValid: boolean; message: string; sanitized: string } {
  if (!rnc || !rnc.trim()) {
    if (isRequired) {
      return { isValid: false, message: "El RNC es obligatorio.", sanitized: "" };
    }
    return { isValid: true, message: "", sanitized: "" };
  }

  const digitsOnly = rnc.replace(/\D/g, "");
  if (digitsOnly.length !== 9 && digitsOnly.length !== 11) {
    return { isValid: false, message: "Debe ingresar un RNC válido de 9 u 11 dígitos.", sanitized: digitsOnly };
  }

  return { isValid: true, message: "", sanitized: digitsOnly };
}

export function formatPhoneDR(phone: string): { formatted: string; digits: string } {
  if (!phone) return { formatted: "", digits: "" };
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("1") && digits.length > 10) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 10);
  
  let formatted = digits;
  if (digits.length > 0) {
    const area = digits.slice(0, 3);
    const prefix = digits.slice(3, 6);
    const line = digits.slice(6, 10);
    if (digits.length <= 3) {
      formatted = `(${area}`;
    } else if (digits.length <= 6) {
      formatted = `(${area}) ${prefix}`;
    } else {
      formatted = `(${area}) ${prefix}-${line}`;
    }
  }
  return { formatted, digits };
}

export function validatePhoneDR(phone: string, isRequired = false): { isValid: boolean; message: string; digits: string } {
  if (!phone || !phone.trim()) {
    if (isRequired) {
      return { isValid: false, message: "El teléfono es obligatorio.", digits: "" };
    }
    return { isValid: true, message: "", digits: "" };
  }

  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("1") && digits.length > 10) {
    digits = digits.slice(1);
  }

  if (digits.length !== 10) {
    return { isValid: false, message: "Debe ingresar un número telefónico válido de 10 dígitos.", digits };
  }

  const areaCode = digits.slice(0, 3);
  if (!["809", "829", "849"].includes(areaCode)) {
    return { isValid: false, message: "Debe ingresar un número telefónico válido (809, 829, 849).", digits };
  }

  return { isValid: true, message: "", digits };
}

export function validateEmail(email: string, isRequired = false): { isValid: boolean; message: string; sanitized: string } {
  if (!email || !email.trim()) {
    if (isRequired) {
      return { isValid: false, message: "El correo electrónico es obligatorio.", sanitized: "" };
    }
    return { isValid: true, message: "", sanitized: "" };
  }

  const sanitized = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(sanitized)) {
    return { isValid: false, message: "Debe ingresar un correo electrónico válido.", sanitized };
  }

  return { isValid: true, message: "", sanitized };
}

export function validateURL(url: string, isRequired = false): { isValid: boolean; message: string; sanitized: string } {
  if (!url || !url.trim()) {
    if (isRequired) {
      return { isValid: false, message: "La URL es obligatoria.", sanitized: "" };
    }
    return { isValid: true, message: "", sanitized: "" };
  }

  // Support all logo paths, blob URLs, data URIs, local paths, and standard HTTP/HTTPS URLs
  return { isValid: true, message: "", sanitized: url.trim() };
}

export function validateRequiredText(text: string, fieldLabel = "Este campo", maxLen = 100): { isValid: boolean; message: string; sanitized: string } {
  const sanitized = (text || "").trim();
  if (!sanitized) {
    return { isValid: false, message: `${fieldLabel} es obligatorio.`, sanitized: "" };
  }
  if (sanitized.length > maxLen) {
    return { isValid: false, message: `${fieldLabel} no puede exceder ${maxLen} caracteres.`, sanitized };
  }
  return { isValid: true, message: "", sanitized };
}
