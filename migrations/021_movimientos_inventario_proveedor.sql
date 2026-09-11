-- ============================================================================
-- MIGRATION: 021_movimientos_inventario_proveedor.sql
-- DESCRIPTION: Agrega la columna estructurada proveedor_id a la tabla
--              admin.movimientos_inventario para trazabilidad histórica de compras.
--              1. Agrega proveedor_id integer NULLABLE.
--              2. Establece FK hacia admin.proveedores(proveedor_id) con ON DELETE RESTRICT (sin CASCADE).
--              3. Índice condicional para optimizar consultas históricas con proveedor.
-- IDEMPOTENT: Sí
-- ============================================================================

-- 1. Agregar columna proveedor_id (NULLABLE para preservar históricos previos y permitir movimientos sin proveedor)
ALTER TABLE admin.movimientos_inventario
  ADD COLUMN IF NOT EXISTS proveedor_id integer NULL;

-- 2. Crear Foreign Key segura hacia admin.proveedores (sin CASCADE para preservar inmutabilidad de movimientos)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'movimientos_proveedor_fk'
      AND conrelid = 'admin.movimientos_inventario'::regclass
  ) THEN
    ALTER TABLE admin.movimientos_inventario
      ADD CONSTRAINT movimientos_proveedor_fk
      FOREIGN KEY (proveedor_id) REFERENCES admin.proveedores(proveedor_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- 3. Crear índice para optimizar consultas de trazabilidad por proveedor
CREATE INDEX IF NOT EXISTS movimientos_inventario_proveedor_idx
  ON admin.movimientos_inventario (proveedor_id)
  WHERE proveedor_id IS NOT NULL;
