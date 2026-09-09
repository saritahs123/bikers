-- ============================================================================
-- MIGRATION: 012_inventory_integrity_and_transfers.sql
-- DESCRIPTION: Inventory integrity constraints, sequences, and transfer tracking:
--              1. Sequence creation, assignment, and sync for existencias_producto PK.
--              2. Sequence creation, assignment, and sync for movimientos_inventario PK.
--              3. Addition of costo_promedio column to admin.existencias_producto.
--              4. Non-negative stock CHECK constraint on admin.existencias_producto(cantidad_actual >= 0).
--              5. Correlation UUID column (transferencia_uuid) and index on admin.movimientos_inventario.
--              6. Addition of permite_decimales column to admin.unidad_medida with catalog classification.
-- IDEMPOTENT: Yes
-- ============================================================================

-- 1. admin.existencias_producto (existencia_producto_id sequence)
CREATE SEQUENCE IF NOT EXISTS admin.existencias_producto_existencia_producto_id_seq;
ALTER SEQUENCE admin.existencias_producto_existencia_producto_id_seq OWNED BY admin.existencias_producto.existencia_producto_id;
ALTER TABLE admin.existencias_producto ALTER COLUMN existencia_producto_id SET DEFAULT nextval('admin.existencias_producto_existencia_producto_id_seq');
SELECT setval(
  'admin.existencias_producto_existencia_producto_id_seq',
  COALESCE((SELECT MAX(existencia_producto_id) FROM admin.existencias_producto), 1),
  (SELECT MAX(existencia_producto_id) FROM admin.existencias_producto) IS NOT NULL
);

-- 2. admin.movimientos_inventario (movimiento_inventario_id sequence)
CREATE SEQUENCE IF NOT EXISTS admin.movimientos_inventario_movimiento_inventario_id_seq;
ALTER SEQUENCE admin.movimientos_inventario_movimiento_inventario_id_seq OWNED BY admin.movimientos_inventario.movimiento_inventario_id;
ALTER TABLE admin.movimientos_inventario ALTER COLUMN movimiento_inventario_id SET DEFAULT nextval('admin.movimientos_inventario_movimiento_inventario_id_seq');
SELECT setval(
  'admin.movimientos_inventario_movimiento_inventario_id_seq',
  COALESCE((SELECT MAX(movimiento_inventario_id) FROM admin.movimientos_inventario), 1),
  (SELECT MAX(movimiento_inventario_id) FROM admin.movimientos_inventario) IS NOT NULL
);

-- 3. Add costo_promedio column to admin.existencias_producto if not present
ALTER TABLE admin.existencias_producto ADD COLUMN IF NOT EXISTS costo_promedio numeric(14,2) NOT NULL DEFAULT 0;

-- Backfill initial costo_promedio from productos.costo_actual where not initialized
UPDATE admin.existencias_producto ep
SET costo_promedio = COALESCE(p.costo_actual, 0)
FROM admin.productos p
WHERE ep.producto_id = p.producto_id
  AND (ep.costo_promedio IS NULL OR ep.costo_promedio = 0);

-- 4. Non-negative stock CHECK constraint on admin.existencias_producto
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'existencias_producto_cantidad_no_negativa_ck'
      AND conrelid = 'admin.existencias_producto'::regclass
  ) THEN
    ALTER TABLE admin.existencias_producto
      ADD CONSTRAINT existencias_producto_cantidad_no_negativa_ck
      CHECK (cantidad_actual >= 0);
  END IF;
END $$;

-- 5. Add correlation transferencia_uuid to admin.movimientos_inventario
ALTER TABLE admin.movimientos_inventario ADD COLUMN IF NOT EXISTS transferencia_uuid UUID NULL;

-- 6. Index for fast lookup and auditing of inventory transfers
CREATE INDEX IF NOT EXISTS movimientos_transferencia_uuid_idx
  ON admin.movimientos_inventario (transferencia_uuid)
  WHERE transferencia_uuid IS NOT NULL;

-- 7. Add permite_decimales column to admin.unidad_medida
ALTER TABLE admin.unidad_medida ADD COLUMN IF NOT EXISTS permite_decimales BOOLEAN NOT NULL DEFAULT false;

-- Configure default continuous / divisible units of measure
UPDATE admin.unidad_medida
SET permite_decimales = true
WHERE UPPER(TRIM(codigo)) IN ('LT', 'ML', 'GR', 'KG', 'MT', 'LITRO', 'METRO', 'KILO', 'GRAMO');

UPDATE admin.unidad_medida
SET permite_decimales = false
WHERE UPPER(TRIM(codigo)) IN ('UND', 'JGO', 'PAR', 'PZA', 'PIEZA', 'UNIDAD');
