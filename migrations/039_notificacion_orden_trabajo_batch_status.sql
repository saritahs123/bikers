-- ============================================================================
-- MIGRATION: 039_notificacion_orden_trabajo_batch_status.sql
-- MODULE: Taller / Notificaciones SMS con TextBee
-- DESCRIPTION:
--   1. Agrega columnas textbee_batch_id, estado_proveedor y fecha_actualizacion
--      a admin.notificacion_orden_trabajo para soportar seguimiento real de lotes.
--   2. Actualiza constraint chk_notif_estado para admitir 'PENDIENTE' y 'ENTREGADO'.
--   3. Crea índices para búsquedas por batch_id y estado_proveedor.
--   4. Mantiene índices únicos parciales de idempotencia.
-- IDEMPOTENT: Sí
-- ============================================================================

BEGIN;

ALTER TABLE admin.notificacion_orden_trabajo
    ADD COLUMN IF NOT EXISTS textbee_batch_id VARCHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS estado_proveedor VARCHAR(32) NULL,
    ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMPTZ NULL;

ALTER TABLE admin.notificacion_orden_trabajo
    DROP CONSTRAINT IF EXISTS chk_notif_estado;

ALTER TABLE admin.notificacion_orden_trabajo
    ADD CONSTRAINT chk_notif_estado
    CHECK (estado_envio IN ('PENDIENTE', 'ENVIADO', 'ENTREGADO', 'ERROR', 'NO_ENVIADO'));

CREATE INDEX IF NOT EXISTS idx_notif_textbee_batch_id
    ON admin.notificacion_orden_trabajo (textbee_batch_id)
    WHERE textbee_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notif_estado_proveedor
    ON admin.notificacion_orden_trabajo (estado_proveedor);

DROP INDEX IF EXISTS admin.uq_notif_ot_bienvenida_enviado;
CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_ot_bienvenida_enviado
    ON admin.notificacion_orden_trabajo (orden_trabajo_id)
    WHERE (tipo_notificacion = 'BIENVENIDA' AND estado_envio IN ('ENVIADO', 'ENTREGADO'));

DROP INDEX IF EXISTS admin.uq_notif_ot_cierre_enviado;
CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_ot_cierre_enviado
    ON admin.notificacion_orden_trabajo (orden_trabajo_id)
    WHERE (tipo_notificacion = 'CIERRE' AND estado_envio IN ('ENVIADO', 'ENTREGADO'));

COMMIT;
