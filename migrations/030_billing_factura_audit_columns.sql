-- ============================================================================
-- MIGRATION: 030_billing_factura_audit_columns.sql
-- MODULE: Facturación (Auditoría Estructural de Facturas)
-- DESCRIPTION:
--   1. Agrega y alinea columnas canónicas de auditoría en admin.facturas:
--      - usuario_creacion_id INTEGER REFERENCES admin.usuario(usuario_id)
--      - fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
--      - usuario_modificacion_id INTEGER NULL REFERENCES admin.usuario(usuario_id)
--      - fecha_modificacion TIMESTAMPTZ NULL
--      - usuario_anulacion_id INTEGER NULL REFERENCES admin.usuario(usuario_id)
--      - fecha_anulacion TIMESTAMPTZ NULL
--      - motivo_anulacion TEXT NULL
--   2. Agrega llaves foráneas formales hacia admin.usuario(usuario_id)
--   3. Backfill seguro y consistente de registros existentes sin inventar usuarios
-- IDEMPOTENT: Sí
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Columnas canónicas de auditoría en admin.facturas
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    -- usuario_creacion_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'usuario_creacion_id'
    ) THEN
        ALTER TABLE admin.facturas ADD COLUMN usuario_creacion_id INTEGER;
    END IF;

    -- fecha_creacion
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'fecha_creacion'
    ) THEN
        ALTER TABLE admin.facturas ADD COLUMN fecha_creacion TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- usuario_modificacion_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'usuario_modificacion_id'
    ) THEN
        ALTER TABLE admin.facturas ADD COLUMN usuario_modificacion_id INTEGER NULL;
    END IF;

    -- fecha_modificacion
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'fecha_modificacion'
    ) THEN
        ALTER TABLE admin.facturas ADD COLUMN fecha_modificacion TIMESTAMPTZ NULL;
    END IF;

    -- usuario_anulacion_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'usuario_anulacion_id'
    ) THEN
        ALTER TABLE admin.facturas ADD COLUMN usuario_anulacion_id INTEGER NULL;
    END IF;

    -- fecha_anulacion
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'fecha_anulacion'
    ) THEN
        ALTER TABLE admin.facturas ADD COLUMN fecha_anulacion TIMESTAMPTZ NULL;
    END IF;

    -- motivo_anulacion
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'motivo_anulacion'
    ) THEN
        ALTER TABLE admin.facturas ADD COLUMN motivo_anulacion TEXT NULL;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Backfill seguro basado en relaciones reales existentes
-- ----------------------------------------------------------------------------

-- Sincronizar fecha_creacion con fecha_registro o fecha_factura
UPDATE admin.facturas
SET fecha_creacion = COALESCE(fecha_registro, fecha_factura, NOW())
WHERE fecha_creacion IS NULL;

-- Sincronizar usuario_creacion_id con usuario_registro confiable
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'usuario_registro'
    ) THEN
        UPDATE admin.facturas f
        SET usuario_creacion_id = f.usuario_registro
        WHERE f.usuario_creacion_id IS NULL
          AND f.usuario_registro IS NOT NULL
          AND EXISTS (SELECT 1 FROM admin.usuario u WHERE u.usuario_id = f.usuario_registro);
    END IF;
END $$;

-- Sincronizar fecha_modificacion con fecha_actualizacion si existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'fecha_actualizacion'
    ) THEN
        UPDATE admin.facturas f
        SET fecha_modificacion = f.fecha_actualizacion
        WHERE f.fecha_modificacion IS NULL AND f.fecha_actualizacion IS NOT NULL;
    END IF;
END $$;

-- Sincronizar usuario_modificacion_id con usuario_actualizacion si existe y es válido
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'usuario_actualizacion'
    ) THEN
        UPDATE admin.facturas f
        SET usuario_modificacion_id = f.usuario_actualizacion
        WHERE f.usuario_modificacion_id IS NULL
          AND f.usuario_actualizacion IS NOT NULL
          AND EXISTS (SELECT 1 FROM admin.usuario u WHERE u.usuario_id = f.usuario_actualizacion);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Llaves Foráneas formales hacia admin.usuario(usuario_id)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    -- FK usuario_creacion_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'admin' AND table_name = 'facturas' AND constraint_name = 'fk_facturas_usuario_creacion'
    ) THEN
        ALTER TABLE admin.facturas
        ADD CONSTRAINT fk_facturas_usuario_creacion
        FOREIGN KEY (usuario_creacion_id)
        REFERENCES admin.usuario(usuario_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT;
    END IF;

    -- FK usuario_modificacion_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'admin' AND table_name = 'facturas' AND constraint_name = 'fk_facturas_usuario_modificacion'
    ) THEN
        ALTER TABLE admin.facturas
        ADD CONSTRAINT fk_facturas_usuario_modificacion
        FOREIGN KEY (usuario_modificacion_id)
        REFERENCES admin.usuario(usuario_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
    END IF;

    -- FK usuario_anulacion_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'admin' AND table_name = 'facturas' AND constraint_name = 'fk_facturas_usuario_anulacion'
    ) THEN
        ALTER TABLE admin.facturas
        ADD CONSTRAINT fk_facturas_usuario_anulacion
        FOREIGN KEY (usuario_anulacion_id)
        REFERENCES admin.usuario(usuario_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Índices para consultas y auditoría
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_facturas_usuario_creacion ON admin.facturas(usuario_creacion_id);
CREATE INDEX IF NOT EXISTS idx_facturas_usuario_modificacion ON admin.facturas(usuario_modificacion_id);

COMMIT;
