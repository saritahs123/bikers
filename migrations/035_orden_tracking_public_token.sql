-- ============================================================================
-- MIGRATION: 035_orden_tracking_public_token.sql
-- MODULE: Taller / Portal Público de Seguimiento (Token Público Recuperable)
-- DESCRIPTION:
--   1. Agrega columna public_token VARCHAR(128) a admin.orden_tracking.
--   2. Realiza backfill seguro para registros existentes generando token aleatorio de 64 caracteres hex y actualizando su token_hash.
--   3. Establece la columna public_token como NOT NULL.
--   4. Agrega restricción UNIQUE sobre public_token.
--   5. Crea índice sobre admin.orden_tracking (public_token).
-- IDEMPOTENT: Sí
-- ============================================================================

BEGIN;

-- 1. Agregar columna si no existe
ALTER TABLE admin.orden_tracking
    ADD COLUMN IF NOT EXISTS public_token VARCHAR(128) NULL;

-- 2. Backfill para cualquier fila existente sin public_token
DO $$
DECLARE
    rec RECORD;
    v_new_token VARCHAR(128);
    v_new_hash VARCHAR(128);
BEGIN
    FOR rec IN SELECT orden_tracking_id FROM admin.orden_tracking WHERE public_token IS NULL LOOP
        v_new_token := md5(random()::text || clock_timestamp()::text || rec.orden_tracking_id::text) || 
                       md5(random()::text || clock_timestamp()::text || random()::text);
        v_new_hash := encode(sha256(v_new_token::bytea), 'hex');

        UPDATE admin.orden_tracking
        SET public_token = v_new_token,
            token_hash = v_new_hash
        WHERE orden_tracking_id = rec.orden_tracking_id;
    END LOOP;
END $$;

-- 3. Establecer NOT NULL en public_token
ALTER TABLE admin.orden_tracking
    ALTER COLUMN public_token SET NOT NULL;

-- 4. Constraint UNIQUE sobre public_token si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_orden_tracking_public_token'
    ) THEN
        ALTER TABLE admin.orden_tracking
            ADD CONSTRAINT uq_orden_tracking_public_token UNIQUE (public_token);
    END IF;
END $$;

-- 5. Índice sobre public_token
CREATE INDEX IF NOT EXISTS idx_orden_tracking_public_token
    ON admin.orden_tracking (public_token);

COMMIT;
