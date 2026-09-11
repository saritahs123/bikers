import { PoolClient } from "pg";

/**
 * Códigos de sistema funcionales del módulo Inventario en admin.codigo_sistema.
 * Identificadores estables reutilizados por tenant (empresa_id).
 */
export const INVENTORY_SYSTEM_CODES = {
  ENTRADA: 5,
  SALIDA: 6,
  AJUSTE_POSITIVO: 7,
  AJUSTE_NEGATIVO: 8,
  TRANSFERENCIA: 9,
  INVENTARIO_INICIAL: 10,
  CONSUMO_TALLER: 12,
  DEVOLUCION_TALLER: 13,
} as const;

export type InventorySystemCodeKey = keyof typeof INVENTORY_SYSTEM_CODES;

/**
 * Asegura de forma idempotente que la empresa posea los registros de código de sistema
 * para el módulo de inventario (IDs 5 al 10, 12 para consumo y 13 para devolución/reverso de taller).
 */
export async function ensureEmpresaCodigoSistemaProvisioned(
  client: PoolClient,
  empresaId: number
): Promise<void> {
  const sql = `
    INSERT INTO admin.codigo_sistema (
      empresa_id,
      codigo_sistema_id,
      tipo_transaccion,
      prefijo,
      longitud_numero,
      ultimo_numero,
      periodo,
      activo,
      es_catalogo,
      fecha_creacion,
      fecha_actualizacion
    )
    VALUES 
      ($1, 5, 'ENTRADA_INVENTARIO', 'EI', 6, 0, TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santo_Domingo', 'YYYYMM'), true, false, NOW(), NOW()),
      ($1, 6, 'SALIDA_INVENTARIO', 'SI', 6, 0, TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santo_Domingo', 'YYYYMM'), true, false, NOW(), NOW()),
      ($1, 7, 'AJUSTE_POSITIVO_INVENTARIO', 'API', 6, 0, TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santo_Domingo', 'YYYYMM'), true, false, NOW(), NOW()),
      ($1, 8, 'AJUSTE_NEGATIVO_INVENTARIO', 'ANI', 6, 0, TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santo_Domingo', 'YYYYMM'), true, false, NOW(), NOW()),
      ($1, 9, 'TRANSFERENCIA_INVENTARIO', 'TRFI', 6, 0, TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santo_Domingo', 'YYYYMM'), true, false, NOW(), NOW()),
      ($1, 10, 'INVENTARIO_INCIAL', 'INVI', 6, 0, TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santo_Domingo', 'YYYYMM'), true, false, NOW(), NOW()),
      ($1, 12, 'CONSUMO_REPUESTO_TALLER', 'CRT', 6, 0, TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santo_Domingo', 'YYYYMM'), true, false, NOW(), NOW()),
      ($1, 13, 'DEVOLUCION_REPUESTO_TALLER', 'DRT', 6, 0, TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santo_Domingo', 'YYYYMM'), true, false, NOW(), NOW())
    ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING
  `;
  await client.query(sql, [empresaId]);
}

/**
 * Genera el código funcional de operación utilizando la función nativa de PostgreSQL:
 * admin.generar_codigo_sistema(p_empresa_id, p_codigo_sistema_id).
 * Se ejecuta dentro de la transacción activa de la operación.
 */
export async function generarCodigoMovimiento(
  client: PoolClient,
  empresaId: number,
  codigoSistemaId: number
): Promise<string> {
  // Asegurar aprovisionamiento ante cualquier eventualidad de tenant nuevo
  await ensureEmpresaCodigoSistemaProvisioned(client, empresaId);

  const res = await client.query(
    `SELECT admin.generar_codigo_sistema($1, $2) AS codigo`,
    [Number(empresaId), Number(codigoSistemaId)]
  );

  if (!res.rows || res.rows.length === 0 || !res.rows[0].codigo) {
    throw new Error(
      `No se pudo generar el código de movimiento de sistema para la empresa ${empresaId} con código ${codigoSistemaId}.`
    );
  }

  return String(res.rows[0].codigo);
}
