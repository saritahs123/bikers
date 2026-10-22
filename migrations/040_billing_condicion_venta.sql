-- ============================================================================
-- MIGRATION: 040_billing_condicion_venta.sql
-- MODULE: Facturación (Modalidad CONTADO / CREDITO y Vencimiento)
-- DESCRIPTION:
--   1. Agrega la columna condicion_venta a admin.facturas con valor por defecto 'CONTADO'.
--   2. Agrega check constraint chk_facturas_condicion_venta ('CONTADO', 'CREDITO').
--   3. Crea índice sobre condicion_venta para optimizar búsquedas y filtros.
--   4. Documenta la reutilización de la columna nativa existente admin.facturas.fecha_vencimiento (TIMESTAMPTZ, NULL permitido).
-- IDEMPOTENT: Sí
-- ============================================================================

BEGIN;

-- 1. Agregar columna condicion_venta si no existe
ALTER TABLE admin.facturas 
ADD COLUMN IF NOT EXISTS condicion_venta VARCHAR(10) DEFAULT 'CONTADO';

-- 2. Check constraint controlado ('CONTADO', 'CREDITO')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_facturas_condicion_venta'
  ) THEN
    ALTER TABLE admin.facturas 
    ADD CONSTRAINT chk_facturas_condicion_venta 
    CHECK (condicion_venta IN ('CONTADO', 'CREDITO'));
  END IF;
END $$;

-- 3. Índice para filtros en listados y estados de cuenta
CREATE INDEX IF NOT EXISTS idx_facturas_condicion_venta 
ON admin.facturas (condicion_venta);

COMMIT;
