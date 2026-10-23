/**
 * Utilidad compartida de normalización y validación de códigos de módulos para admin.modulo_sistema
 * Garantiza determinismo 100% idéntico entre TypeScript y los triggers en PostgreSQL 18.
 */

export function normalizeModuleCode(name: string): string {
  if (!name || typeof name !== "string") return "";
  const clean = name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return clean.slice(0, 50);
}

export function isValidModuleCode(code: string): boolean {
  if (!code || typeof code !== "string") return false;
  return /^[A-Z0-9_]+$/.test(code) && code.length <= 50;
}
