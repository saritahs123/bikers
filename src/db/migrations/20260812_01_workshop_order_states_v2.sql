-- =============================================================================
-- MIGRACIÓN VERSIONADA: 20260812_01_workshop_order_states_v2.sql
-- Propósito: Reclasificación idempotente de estados de Órdenes de Trabajo de Taller
-- NOTA: Archivo creado únicamente para revisión. NO EJECUTADO.
-- =============================================================================

BEGIN;

-- 1. Crear tabla de registro de versiones de migración si no existe
CREATE TABLE IF NOT EXISTS admin.schema_migrations (
  version varchar(100) PRIMARY KEY,
  ejecutado_en timestamptz NOT NULL DEFAULT NOW(),
  ejecutado_por integer NULL,
  checksum varchar(64) NULL,
  metadata jsonb NULL
);

-- 2. DDL: Crear secuencia segura para orden_historial_estado
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'orden_historial_estado_seq') THEN
    CREATE SEQUENCE admin.orden_historial_estado_seq OWNED BY admin.orden_historial_estado.orden_historial_estado_id;
  END IF;
END $$;

SELECT setval(
  'admin.orden_historial_estado_seq',
  GREATEST(
    COALESCE((SELECT last_value FROM admin.orden_historial_estado_seq), 1),
    COALESCE((SELECT MAX(orden_historial_estado_id) FROM admin.orden_historial_estado), 0) + 1
  ),
  false
);

ALTER TABLE admin.orden_historial_estado 
  ALTER COLUMN orden_historial_estado_id SET DEFAULT nextval('admin.orden_historial_estado_seq');

-- 3. DDL: Añadir columnas auxiliares para trazabilidad en historial
ALTER TABLE admin.orden_historial_estado ADD COLUMN IF NOT EXISTS orden_servicio_id integer NULL REFERENCES admin.orden_servicios(orden_servicio_id);
ALTER TABLE admin.orden_historial_estado ADD COLUMN IF NOT EXISTS motivo text NULL;
ALTER TABLE admin.orden_historial_estado ADD COLUMN IF NOT EXISTS metadata jsonb NULL;

-- 4. DDL: Añadir persona_recibe a ordenes_trabajo
ALTER TABLE admin.ordenes_trabajo ADD COLUMN IF NOT EXISTS persona_recibe character varying(200) NULL;

-- 5. DDL: Añadir activo a orden_productos
ALTER TABLE admin.orden_productos ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

-- 6. DDL: Índice único parcial para prevenir cronómetros/sesiones dobles en un mismo servicio
CREATE UNIQUE INDEX IF NOT EXISTS idx_unicidad_sesion_abierta_mano_obra
ON admin.orden_servicio_mano_obra (orden_servicio_id)
WHERE fecha_finalizacion IS NULL AND (activo IS DISTINCT FROM false);

-- 7. Desactivar catálogos deprecados en estado_orden_trabajo
UPDATE admin.estado_orden_trabajo
SET activo = false
WHERE estado_orden_id IN (2, 3, 4, 6);

UPDATE admin.estado_orden_trabajo
SET activo = true
WHERE estado_orden_id IN (1, 5, 7, 8);

COMMIT;
