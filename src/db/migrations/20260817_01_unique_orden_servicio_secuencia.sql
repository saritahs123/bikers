-- =============================================================================
-- MIGRACIÓN PREPARADA: 20260817_01_unique_orden_servicio_secuencia.sql
-- Propósito: Restricción de unicidad para (orden_trabajo_id, secuencia) en admin.orden_servicios
-- ESTADO: PREPARADA Y AUDITADA - NO EJECUTADA (Pendiente de autorización explícita)
-- =============================================================================

BEGIN;

-- 1. Normalización de secuencias duplicadas existentes previo a la restricción
WITH resequenced AS (
  SELECT
    orden_servicio_id,
    ROW_NUMBER() OVER (
      PARTITION BY orden_trabajo_id 
      ORDER BY secuencia ASC, orden_servicio_id ASC
    ) AS nueva_secuencia
  FROM admin.orden_servicios
  WHERE (activo IS DISTINCT FROM false)
)
UPDATE admin.orden_servicios os
SET secuencia = r.nueva_secuencia
FROM resequenced r
WHERE os.orden_servicio_id = r.orden_servicio_id
  AND os.secuencia <> r.nueva_secuencia;

-- 2. Creación del índice de unicidad preventivo para evitar secuencias duplicadas
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_orden_servicio_secuencia
  ON admin.orden_servicios (orden_trabajo_id, secuencia)
  WHERE (activo IS DISTINCT FROM false);

COMMIT;
