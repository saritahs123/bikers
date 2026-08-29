-- =============================================================================
-- MIGRACIÓN TALLER / STORAGE: REGISTRO DURABLE DE OBJETOS EN STAGING S3
-- Archivo: migrations/006_s3_staging_registry.sql
-- =============================================================================

BEGIN;

-- 1. Tabla de registro durable de staging S3
CREATE TABLE IF NOT EXISTS admin.s3_staging_registry (
    staging_id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES admin.empresa(empresa_id),
    usuario_id INTEGER NOT NULL REFERENCES admin.usuario(usuario_id),
    object_key VARCHAR(500) NOT NULL UNIQUE,
    modulo VARCHAR(50) NOT NULL,
    tipo_entidad VARCHAR(50) NOT NULL,
    contexto_id VARCHAR(150),
    estado VARCHAR(30) NOT NULL DEFAULT 'STAGING',
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_consumo TIMESTAMPTZ,
    fecha_expiracion TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    CONSTRAINT chk_s3_staging_estado CHECK (estado IN ('STAGING', 'ASSOCIATED', 'QUEUED', 'CLEANED'))
);

-- 2. Índices de optimización para búsqueda por empresa, clave y contexto
CREATE INDEX IF NOT EXISTS idx_s3_staging_empresa_key
ON admin.s3_staging_registry(empresa_id, object_key);

CREATE INDEX IF NOT EXISTS idx_s3_staging_context
ON admin.s3_staging_registry(empresa_id, contexto_id, estado);

CREATE INDEX IF NOT EXISTS idx_s3_staging_stale_reap
ON admin.s3_staging_registry(estado, fecha_expiracion);

-- 3. Documentación en catálogo PostgreSQL
COMMENT ON TABLE admin.s3_staging_registry IS 'Registro durable de ownership, contexto y ciclo de vida de evidencias en staging S3.';
COMMENT ON COLUMN admin.s3_staging_registry.estado IS 'Ciclo de vida: STAGING (temporal), ASSOCIATED (asociado a BD), QUEUED (encolado para cleanup), CLEANED (limpiado físicamente).';

COMMIT;
