-- ============================================================================
-- MIGRATION: 027_billing_condicion_venta_y_devuelta.sql
-- MODULE: Facturación (FIX-FAC-NEW-2 — Contado/Crédito, Devuelta, Trazabilidad)
-- DESCRIPTION:
--   1. Agrega columna condicion_venta en admin.facturas ('CONTADO', 'CREDITO') NOT NULL.
--   2. Agrega check constraint chk_facturas_condicion_venta.
--   3. Agrega columnas monto_recibido y monto_devuelta en admin.pagos para trazabilidad de caja.
-- IDEMPOTENT: Sí
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Columna condicion_venta en admin.facturas
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'condicion_venta'
    ) THEN
        ALTER TABLE admin.facturas ADD COLUMN condicion_venta VARCHAR(20) DEFAULT 'CONTADO';
    END IF;

    -- Asignar default a registros existentes nulos
    UPDATE admin.facturas
    SET condicion_venta = 'CONTADO'
    WHERE condicion_venta IS NULL;

    -- Garantizar NOT NULL
    ALTER TABLE admin.facturas ALTER COLUMN condicion_venta SET NOT NULL;
END $$;

-- Check constraint en admin.facturas.condicion_venta
DO $$
BEGIN
    ALTER TABLE admin.facturas DROP CONSTRAINT IF EXISTS chk_facturas_condicion_venta;
    ALTER TABLE admin.facturas ADD CONSTRAINT chk_facturas_condicion_venta
        CHECK (condicion_venta IN ('CONTADO', 'CREDITO'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Índice para búsquedas y filtros por condición de venta
CREATE INDEX IF NOT EXISTS idx_facturas_condicion_venta ON admin.facturas (condicion_venta);

-- ----------------------------------------------------------------------------
-- 2. Columnas monto_recibido y monto_devuelta en admin.pagos
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'admin' AND table_name = 'pagos' AND column_name = 'monto_recibido'
    ) THEN
        ALTER TABLE admin.pagos ADD COLUMN monto_recibido NUMERIC(12, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'admin' AND table_name = 'pagos' AND column_name = 'monto_devuelta'
    ) THEN
        ALTER TABLE admin.pagos ADD COLUMN monto_devuelta NUMERIC(12, 2) DEFAULT 0;
    END IF;
END $$;

COMMIT;
