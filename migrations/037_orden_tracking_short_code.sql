-- ============================================================================
-- MIGRATION: 037_orden_tracking_short_code.sql
-- MODULE: Taller / Portal Público de Seguimiento (Short Link /s/[code])
-- DESCRIPTION:
--   1. Agrega columna short_code VARCHAR(32) a admin.orden_tracking.
--   2. Realiza backfill seguro para registros existentes generando un código aleatorio Base62 de 8 caracteres.
--   3. Establece la columna short_code como NOT NULL.
--   4. Agrega restricción UNIQUE sobre short_code.
--   5. Crea índice sobre admin.orden_tracking (short_code).
-- IDEMPOTENT: Sí
-- ============================================================================

BEGIN;

-- 1. Agregar columna si no existe
ALTER TABLE admin.orden_tracking
    ADD COLUMN IF NOT EXISTS short_code VARCHAR(32) NULL;

-- 2. Backfill para cualquier fila existente sin short_code
DO $$
DECLARE
    rec RECORD;
    v_chars TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    v_code VARCHAR(32);
    v_i INT;
BEGIN
    FOR rec IN SELECT orden_tracking_id FROM admin.orden_tracking WHERE short_code IS NULL LOOP
        LOOP
            v_code := '';
            FOR v_i IN 1..8 LOOP
                v_code := v_code || substr(v_chars, floor(random() * 62 + 1)::int, 1);
            END LOOP;
            -- Asegurar unicidad
            IF NOT EXISTS (SELECT 1 FROM admin.orden_tracking WHERE short_code = v_code) THEN
                EXIT;
            END IF;
        END LOOP;

        UPDATE admin.orden_tracking
        SET short_code = v_code
        WHERE orden_tracking_id = rec.orden_tracking_id;
    END LOOP;
END $$;

-- 3. Establecer NOT NULL en short_code
ALTER TABLE admin.orden_tracking
    ALTER COLUMN short_code SET NOT NULL;

-- 4. Constraint UNIQUE sobre short_code si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_orden_tracking_short_code'
    ) THEN
        ALTER TABLE admin.orden_tracking
            ADD CONSTRAINT uq_orden_tracking_short_code UNIQUE (short_code);
    END IF;
END $$;

-- 5. Índice sobre short_code
CREATE INDEX IF NOT EXISTS idx_orden_tracking_short_code
    ON admin.orden_tracking (short_code);

COMMIT;
