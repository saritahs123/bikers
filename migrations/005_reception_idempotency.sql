-- Migration: 005_reception_idempotency.sql
-- Description: Add idempotency_key and server-controlled idempotency_empresa_id columns with tenant-scoped composite unique index to admin.recepciones.
-- Author: Bikers Core Team
-- Date: 2026-08-29

DO $$
BEGIN
    -- Drop legacy global unique index if exists from previous iteration
    DROP INDEX IF EXISTS admin.uq_recepciones_idempotency_key;

    -- Add idempotency_key column if not exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'admin' 
          AND table_name = 'recepciones' 
          AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE admin.recepciones 
        ADD COLUMN idempotency_key VARCHAR(64) DEFAULT NULL;
    END IF;

    -- Add server-controlled idempotency_empresa_id column if not exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'admin' 
          AND table_name = 'recepciones' 
          AND column_name = 'idempotency_empresa_id'
    ) THEN
        ALTER TABLE admin.recepciones 
        ADD COLUMN idempotency_empresa_id INTEGER DEFAULT NULL REFERENCES admin.empresa(empresa_id);
    END IF;

    COMMENT ON COLUMN admin.recepciones.idempotency_key IS 'Identificador de idempotencia generado por el cliente (UUID) para evitar creaciones duplicadas en reintentos, doble submit o fallos de red.';
    COMMENT ON COLUMN admin.recepciones.idempotency_empresa_id IS 'Empresa asociada a la clave de idempotencia, derivada exclusivamente del servidor (session.empresa_id) para garantizar el aislamiento multi-tenant.';
END $$;

-- Multi-tenant scoped unique index
CREATE UNIQUE INDEX IF NOT EXISTS uq_recepciones_idempotency_empresa_key 
ON admin.recepciones (idempotency_empresa_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL AND idempotency_empresa_id IS NOT NULL;
