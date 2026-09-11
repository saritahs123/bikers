-- =============================================================================
-- Migración: migrations/019_add_codigo_movimiento.sql
-- Módulo: Inventario (INV-2C)
-- Propósito: 
--   1. Agregar campo funcional 'codigo_movimiento' a admin.movimientos_inventario
--      para agrupar operaciones completas (multi-producto).
--   2. Crear índice compuesto (empresa_id, codigo_movimiento) para búsquedas tenant.
-- =============================================================================

BEGIN;

-- 1. Agregar columna codigo_movimiento (nullable para registros históricos)
ALTER TABLE admin.movimientos_inventario
ADD COLUMN IF NOT EXISTS codigo_movimiento VARCHAR(50);

-- 2. Crear índice compuesto orientado a multitenancy
CREATE INDEX IF NOT EXISTS idx_movimientos_inv_empresa_codigo
ON admin.movimientos_inventario (empresa_id, codigo_movimiento);

COMMIT;
