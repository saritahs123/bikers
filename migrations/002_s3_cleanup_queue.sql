-- =============================================================================
-- MIGRACIÓN CRM / STORAGE: TABLA COLA DURABLE DE LIMPIEZA ASÍNCRONA S3
-- Archivo: migrations/002_s3_cleanup_queue.sql
-- NOTA: Archivo de migración versionado para producción.
-- =============================================================================

BEGIN;

-- 1. Creación de la tabla de cola durable de limpieza S3
CREATE TABLE IF NOT EXISTS admin.s3_cleanup_queue (
    cleanup_id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    object_key VARCHAR(500) NOT NULL,
    modulo VARCHAR(50) NOT NULL,
    entidad VARCHAR(50) NOT NULL,
    entidad_id INTEGER,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    intentos INTEGER NOT NULL DEFAULT 0,
    ultimo_error TEXT,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_procesamiento TIMESTAMPTZ,
    usuario_creacion INTEGER,
    CONSTRAINT chk_s3_cleanup_estado CHECK (estado IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'))
);

-- 2. Índices para acelerar el barrido por estado, empresa y fecha
CREATE INDEX IF NOT EXISTS idx_s3_cleanup_claim
ON admin.s3_cleanup_queue(estado, intentos, fecha_procesamiento);

CREATE INDEX IF NOT EXISTS idx_s3_cleanup_empresa
ON admin.s3_cleanup_queue(empresa_id);

CREATE INDEX IF NOT EXISTS idx_s3_cleanup_fecha_creacion
ON admin.s3_cleanup_queue(fecha_creacion);

-- 3. Comentarios documentales en catálogo PostgreSQL
COMMENT ON TABLE admin.s3_cleanup_queue IS 'Cola durable transaccional para obligaciones de eliminación asíncrona de objetos S3 sin pérdida de referencias.';
COMMENT ON COLUMN admin.s3_cleanup_queue.object_key IS 'Clave lógica del objeto en S3 (sin URLs presignadas ni credenciales).';
COMMENT ON COLUMN admin.s3_cleanup_queue.estado IS 'Estado del procesamiento: PENDING, PROCESSING, COMPLETED o FAILED.';
COMMENT ON COLUMN admin.s3_cleanup_queue.intentos IS 'Número de reintentos ejecutados contra AWS S3.';

COMMIT;
