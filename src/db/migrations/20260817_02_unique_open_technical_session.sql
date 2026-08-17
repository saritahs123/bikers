-- Migration: 20260817_02_unique_open_technical_session.sql
-- Description: Partial unique index to enforce at most one open technical timer session per service.
-- NOTE: Unexecuted migration prepared for future deployment.

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_open_technical_timer_session
ON admin.orden_servicio_mano_obra (orden_servicio_id)
WHERE (detalle_mano_obra IS NULL OR BTRIM(detalle_mano_obra) = '')
  AND (observacion IS NULL OR BTRIM(observacion) = '')
  AND fecha_finalizacion IS NULL
  AND (activo IS DISTINCT FROM false);
