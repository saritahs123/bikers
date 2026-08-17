export interface FileTypeRule {
  allowedExtensions: string[];
  maxSizeBytes: number;
}

export const ALLOWED_MIME_TYPES: Record<string, FileTypeRule> = {
  "image/jpeg": {
    allowedExtensions: [".jpg", ".jpeg"],
    maxSizeBytes: 10 * 1024 * 1024 // 10 MiB
  },
  "image/png": {
    allowedExtensions: [".png"],
    maxSizeBytes: 10 * 1024 * 1024 // 10 MiB
  },
  "image/webp": {
    allowedExtensions: [".webp"],
    maxSizeBytes: 10 * 1024 * 1024 // 10 MiB
  },
  "application/pdf": {
    allowedExtensions: [".pdf"],
    maxSizeBytes: 25 * 1024 * 1024 // 25 MiB
  }
};

export const ALLOWED_MODULES = ["crm", "taller", "seguridad", "general"];
export const ALLOWED_ENTITY_TYPES = [
  "bicicletas",
  "recepciones",
  "checklist",
  "evidencias",
  "usuarios",
  "documentos"
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUploadParameters(params: {
  fileName: string;
  contentType: string;
  size: number;
  module: string;
  entityType: string;
}): ValidationResult {
  const { fileName, contentType, size, module, entityType } = params;

  if (!fileName || typeof fileName !== "string" || !fileName.trim()) {
    return { valid: false, error: "El nombre del archivo es requerido." };
  }

  // Check path traversal attempts
  if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return { valid: false, error: "El nombre del archivo contiene caracteres no permitidos." };
  }

  // Validate Module
  const cleanModule = module?.toLowerCase().trim();
  if (!cleanModule || !ALLOWED_MODULES.includes(cleanModule)) {
    return { valid: false, error: `El módulo '${module}' no es válido.` };
  }

  // Validate Entity Type
  const cleanEntityType = entityType?.toLowerCase().trim();
  if (!cleanEntityType || !ALLOWED_ENTITY_TYPES.includes(cleanEntityType)) {
    return { valid: false, error: `El tipo de entidad '${entityType}' no es válido.` };
  }

  // Validate MIME Type
  const cleanContentType = contentType?.toLowerCase().trim();
  const mimeRule = ALLOWED_MIME_TYPES[cleanContentType];
  if (!mimeRule) {
    return { valid: false, error: `El tipo de contenido '${contentType}' no está permitido.` };
  }

  // Validate Extension
  const ext = "." + fileName.split(".").pop()?.toLowerCase();
  if (!mimeRule.allowedExtensions.includes(ext)) {
    return { valid: false, error: `La extensión '${ext}' no coincide con el tipo ${contentType}.` };
  }

  // Validate Size Limit
  if (typeof size !== "number" || size <= 0) {
    return { valid: false, error: "El tamaño del archivo debe ser mayor a 0." };
  }

  if (size > mimeRule.maxSizeBytes) {
    const maxMb = Math.round(mimeRule.maxSizeBytes / (1024 * 1024));
    return { valid: false, error: `El tamaño del archivo excede el límite máximo permitido de ${maxMb} MB.` };
  }

  return { valid: true };
}
